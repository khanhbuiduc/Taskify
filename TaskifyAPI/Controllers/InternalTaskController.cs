using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using TaskifyAPI.Model;
using TaskifyAPI.Model.ViewModel;
using TaskifyAPI.Data;
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
        private readonly ApplicationDbContext _dbContext;
        private readonly IConfiguration _configuration;
        private readonly ILogger<InternalTaskController> _logger;

        public InternalTaskController(
            IUnitOfWork unitOfWork,
            ApplicationDbContext dbContext,
            IConfiguration configuration,
            ILogger<InternalTaskController> logger)
        {
            _unitOfWork = unitOfWork;
            _dbContext = dbContext;
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
                // Parse due date, default to end of today if not specified
                DateTime dueDate;
                if (!string.IsNullOrEmpty(dto.DueDate))
                {
                    if (!DateTime.TryParse(dto.DueDate, out dueDate))
                    {
                        dueDate = DateTime.UtcNow.Date.AddHours(23).AddMinutes(59).AddSeconds(59);
                    }
                }
                else
                {
                    dueDate = DateTime.UtcNow.Date.AddHours(23).AddMinutes(59).AddSeconds(59);
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

        [HttpPost("{userId}/delete")]
        public async Task<ActionResult<InternalDeleteTasksResponse>> DeleteTasksForUser(
            string userId,
            [FromBody] InternalDeleteTasksRequest? request)
        {
            if (!ValidateApiKey())
            {
                _logger.LogWarning("Invalid or missing X-Rasa-Token for user {UserId}", userId);
                return Unauthorized(new { message = "Invalid API key" });
            }

            var taskIds = request?.TaskIds?.Distinct().ToList() ?? new List<int>();
            if (taskIds.Count == 0)
            {
                return BadRequest(new { message = "TaskIds is required." });
            }

            var tasks = await _dbContext.TaskItems
                .Where(t => t.UserId == userId && taskIds.Contains(t.Id) && !t.IsDeleted)
                .ToListAsync();

            if (tasks.Count == 0)
            {
                return NotFound(new { message = "No matching tasks found to delete." });
            }

            var nowUtc = DateTime.UtcNow;
            foreach (var task in tasks)
            {
                task.IsDeleted = true;
                task.DeletedAt = nowUtc;
            }

            var undoToken = GenerateUndoToken();
            var expiresAtUtc = nowUtc.AddSeconds(10);
            _dbContext.TaskDeleteUndoTokens.Add(new TaskDeleteUndoToken
            {
                Token = undoToken,
                UserId = userId,
                SessionId = request?.SessionId,
                ExpiresAtUtc = expiresAtUtc,
                CreatedAtUtc = nowUtc,
                IsUsed = false,
                TaskIdsCsv = string.Join(",", tasks.Select(t => t.Id))
            });

            await _unitOfWork.SaveChangesAsync();

            _logger.LogInformation(
                "Soft-deleted {Count} task(s) for user {UserId} via Rasa",
                tasks.Count,
                userId);

            return Ok(new InternalDeleteTasksResponse
            {
                DeletedCount = tasks.Count,
                DeletedTaskIds = tasks.Select(t => t.Id).ToList(),
                DeletedTasks = tasks.Select(t => new InternalDeleteTaskItem
                {
                    Id = t.Id,
                    Title = t.Title
                }).ToList(),
                UndoToken = undoToken,
                ExpiresAtUtc = expiresAtUtc
            });
        }

        [HttpPost("{userId}/undo-delete")]
        public async Task<ActionResult<InternalUndoDeleteResponse>> UndoDeleteForUser(
            string userId,
            [FromBody] InternalUndoDeleteRequest? request)
        {
            if (!ValidateApiKey())
            {
                _logger.LogWarning("Invalid or missing X-Rasa-Token for user {UserId}", userId);
                return Unauthorized(new { message = "Invalid API key" });
            }

            if (string.IsNullOrWhiteSpace(request?.UndoToken))
            {
                return BadRequest(new { message = "UndoToken is required." });
            }

            var nowUtc = DateTime.UtcNow;
            var tokenEntry = await _dbContext.TaskDeleteUndoTokens
                .FirstOrDefaultAsync(x => x.Token == request.UndoToken && x.UserId == userId);

            if (tokenEntry == null)
            {
                return NotFound(new { message = "Undo token not found." });
            }

            if (tokenEntry.IsUsed)
            {
                return BadRequest(new { message = "Undo token has already been used." });
            }

            if (tokenEntry.ExpiresAtUtc < nowUtc)
            {
                return BadRequest(new { message = "Undo token expired." });
            }

            if (!string.IsNullOrWhiteSpace(tokenEntry.SessionId)
                && !string.IsNullOrWhiteSpace(request!.SessionId)
                && !string.Equals(tokenEntry.SessionId, request.SessionId, StringComparison.Ordinal))
            {
                return Forbid();
            }

            var taskIds = ParseTaskIds(tokenEntry.TaskIdsCsv);
            if (taskIds.Count == 0)
            {
                return BadRequest(new { message = "Undo token has no tasks." });
            }

            var tasks = await _dbContext.TaskItems
                .Where(t => t.UserId == userId && taskIds.Contains(t.Id) && t.IsDeleted)
                .ToListAsync();

            foreach (var task in tasks)
            {
                task.IsDeleted = false;
                task.DeletedAt = null;
            }

            tokenEntry.IsUsed = true;
            await _unitOfWork.SaveChangesAsync();

            _logger.LogInformation(
                "Undo restored {Count} task(s) for user {UserId} via Rasa",
                tasks.Count,
                userId);

            return Ok(new InternalUndoDeleteResponse
            {
                RestoredCount = tasks.Count,
                RestoredTaskIds = tasks.Select(t => t.Id).ToList(),
            });
        }

        /// <summary>
        /// Backward-compatible route for single delete, now soft-delete.
        /// </summary>
        [HttpDelete("{userId}/{taskId:int}")]
        public async Task<IActionResult> DeleteTaskForUser(string userId, int taskId)
        {
            var response = await DeleteTasksForUser(userId, new InternalDeleteTasksRequest
            {
                TaskIds = new List<int> { taskId }
            });

            if (response.Result is ObjectResult objectResult && objectResult.StatusCode != 200)
            {
                return objectResult;
            }

            return NoContent();
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

        private static string GenerateUndoToken()
        {
            Span<byte> bytes = stackalloc byte[24];
            RandomNumberGenerator.Fill(bytes);
            return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
        }

        private static List<int> ParseTaskIds(string taskIdsCsv)
        {
            if (string.IsNullOrWhiteSpace(taskIdsCsv))
            {
                return new List<int>();
            }

            return taskIdsCsv
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(id => int.TryParse(id, out var parsed) ? parsed : (int?)null)
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();
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

    public class InternalDeleteTasksRequest
    {
        public List<int> TaskIds { get; set; } = new();
        public string? SessionId { get; set; }
    }

    public class InternalDeleteTaskItem
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
    }

    public class InternalDeleteTasksResponse
    {
        public int DeletedCount { get; set; }
        public List<int> DeletedTaskIds { get; set; } = new();
        public List<InternalDeleteTaskItem> DeletedTasks { get; set; } = new();
        public string UndoToken { get; set; } = string.Empty;
        public DateTime ExpiresAtUtc { get; set; }
    }

    public class InternalUndoDeleteRequest
    {
        public string UndoToken { get; set; } = string.Empty;
        public string? SessionId { get; set; }
    }

    public class InternalUndoDeleteResponse
    {
        public int RestoredCount { get; set; }
        public List<int> RestoredTaskIds { get; set; } = new();
    }

    #endregion
}
