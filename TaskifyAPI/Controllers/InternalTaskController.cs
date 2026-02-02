using Microsoft.AspNetCore.Mvc;
using TaskifyAPI.Model;
using TaskifyAPI.Model.ViewModel;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Controllers
{
    /// <summary>
    /// Internal API for Rasa action server to access tasks.
    /// Protected by API key authentication (X-Rasa-Token header).
    /// </summary>
    [Route("api/internal/tasks")]
    [ApiController]
    public class InternalTaskController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IConfiguration _configuration;
        private readonly ILogger<InternalTaskController> _logger;

        public InternalTaskController(
            IUnitOfWork unitOfWork,
            IConfiguration configuration,
            ILogger<InternalTaskController> logger)
        {
            _unitOfWork = unitOfWork;
            _configuration = configuration;
            _logger = logger;
        }

        /// <summary>
        /// Validates the X-Rasa-Token header against configured API key.
        /// </summary>
        private bool ValidateApiKey()
        {
            var configuredKey = _configuration["Rasa:ApiKey"];
            if (string.IsNullOrEmpty(configuredKey))
            {
                _logger.LogWarning("Rasa:ApiKey is not configured");
                return false;
            }

            var providedKey = Request.Headers["X-Rasa-Token"].FirstOrDefault();
            return !string.IsNullOrEmpty(providedKey) && providedKey == configuredKey;
        }

        /// <summary>
        /// Get all tasks for a specific user (for Rasa action_list_tasks).
        /// </summary>
        /// <param name="userId">User ID from Rasa sender</param>
        /// <returns>List of tasks</returns>
        [HttpGet("{userId}")]
        public async Task<ActionResult<InternalTaskListResponse>> GetTasksByUser(string userId)
        {
            if (!ValidateApiKey())
            {
                _logger.LogWarning("Invalid or missing X-Rasa-Token for user {UserId}", userId);
                return Unauthorized(new { message = "Invalid API key" });
            }

            try
            {
                var tasks = await _unitOfWork.Tasks.GetAllOrderedByDueDateAsync(userId);
                var taskList = tasks.Select(t => new InternalTaskDto
                {
                    Id = t.Id,
                    Title = t.Title,
                    Description = t.Description,
                    Priority = MapPriorityToString(t.Priority),
                    Status = MapStatusToString(t.Status),
                    DueDate = t.DueDate,
                    CreatedAt = t.CreatedAt,
                    IsOverdue = t.DueDate < DateTime.UtcNow && t.Status != TaskItemStatus.Completed
                }).ToList();

                // Calculate summary stats
                var now = DateTime.UtcNow;
                var weekStart = now.AddDays(-(int)now.DayOfWeek);
                var weekEnd = weekStart.AddDays(7);

                var response = new InternalTaskListResponse
                {
                    Tasks = taskList,
                    TotalCount = taskList.Count,
                    OverdueCount = taskList.Count(t => t.IsOverdue),
                    CompletedThisWeek = tasks.Count(t => 
                        t.Status == TaskItemStatus.Completed && 
                        t.CreatedAt >= weekStart && 
                        t.CreatedAt < weekEnd),
                    PendingCount = taskList.Count(t => t.Status == "todo" || t.Status == "in-progress"),
                    HighPriorityCount = taskList.Count(t => t.Priority == "high" && t.Status != "completed")
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching tasks for user {UserId}", userId);
                return StatusCode(500, new { message = "Internal server error" });
            }
        }

        /// <summary>
        /// Create a new task for a specific user (for Rasa action_create_task).
        /// </summary>
        /// <param name="userId">User ID from Rasa sender</param>
        /// <param name="dto">Task creation data</param>
        /// <returns>Created task</returns>
        [HttpPost("{userId}")]
        public async Task<ActionResult<InternalTaskDto>> CreateTaskForUser(
            string userId, 
            [FromBody] InternalCreateTaskDto dto)
        {
            if (!ValidateApiKey())
            {
                _logger.LogWarning("Invalid or missing X-Rasa-Token for user {UserId}", userId);
                return Unauthorized(new { message = "Invalid API key" });
            }

            try
            {
                // Parse due date, default to tomorrow if not specified
                DateTime dueDate;
                if (!string.IsNullOrEmpty(dto.DueDate))
                {
                    if (!DateTime.TryParse(dto.DueDate, out dueDate))
                    {
                        dueDate = DateTime.UtcNow.AddDays(1).Date.AddHours(23).AddMinutes(59);
                    }
                }
                else
                {
                    dueDate = DateTime.UtcNow.AddDays(1).Date.AddHours(23).AddMinutes(59);
                }

                var task = new TaskItem
                {
                    Title = dto.Title ?? "New Task",
                    Description = dto.Description ?? "",
                    Priority = ParsePriority(dto.Priority),
                    Status = TaskItemStatus.Todo,
                    DueDate = dueDate,
                    CreatedAt = DateTime.UtcNow,
                    UserId = userId
                };

                await _unitOfWork.Tasks.AddAsync(task);
                await _unitOfWork.SaveChangesAsync();

                _logger.LogInformation("Created task {TaskId} for user {UserId} via Rasa", task.Id, userId);

                return CreatedAtAction(nameof(GetTasksByUser), new { userId }, new InternalTaskDto
                {
                    Id = task.Id,
                    Title = task.Title,
                    Description = task.Description,
                    Priority = MapPriorityToString(task.Priority),
                    Status = MapStatusToString(task.Status),
                    DueDate = task.DueDate,
                    CreatedAt = task.CreatedAt,
                    IsOverdue = false
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating task for user {UserId}", userId);
                return StatusCode(500, new { message = "Internal server error" });
            }
        }

        #region Helper Methods

        private static string MapPriorityToString(TaskPriority priority)
        {
            return priority switch
            {
                TaskPriority.Low => "low",
                TaskPriority.High => "high",
                _ => "medium"
            };
        }

        private static string MapStatusToString(TaskItemStatus status)
        {
            return status switch
            {
                TaskItemStatus.InProgress => "in-progress",
                TaskItemStatus.Completed => "completed",
                _ => "todo"
            };
        }

        private static TaskPriority ParsePriority(string? priority)
        {
            return priority?.ToLower() switch
            {
                "low" => TaskPriority.Low,
                "high" => TaskPriority.High,
                _ => TaskPriority.Medium
            };
        }

        #endregion
    }

    #region DTOs for Internal API

    /// <summary>
    /// Task DTO for internal API responses.
    /// </summary>
    public class InternalTaskDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime DueDate { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsOverdue { get; set; }
    }

    /// <summary>
    /// Response DTO for task list with summary stats.
    /// </summary>
    public class InternalTaskListResponse
    {
        public List<InternalTaskDto> Tasks { get; set; } = new();
        public int TotalCount { get; set; }
        public int OverdueCount { get; set; }
        public int CompletedThisWeek { get; set; }
        public int PendingCount { get; set; }
        public int HighPriorityCount { get; set; }
    }

    /// <summary>
    /// DTO for creating a task via internal API.
    /// </summary>
    public class InternalCreateTaskDto
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Priority { get; set; }
        public string? DueDate { get; set; }
    }

    #endregion
}
