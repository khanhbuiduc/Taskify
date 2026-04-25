using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using TaskifyAPI.Model;
using TaskifyAPI.Model.ViewModel;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Controllers
{
    /// <summary>
    /// Controller for TaskItem CRUD operations
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TaskItemController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly UserManager<ApplicationUser> _userManager;

        public TaskItemController(IUnitOfWork unitOfWork, UserManager<ApplicationUser> userManager)
        {
            _unitOfWork = unitOfWork;
            _userManager = userManager;
        }

        /// <summary>
        /// Get all tasks
        /// Admin: all tasks, User: only own tasks
        /// </summary>
        /// <returns>List of tasks</returns>
        [HttpGet]
        public async Task<ActionResult> GetAll([FromQuery] TaskQueryParamsDto query)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var isAdmin = User.IsInRole("Admin");

            if (query.DueFrom.HasValue && query.DueTo.HasValue && query.DueFrom.Value > query.DueTo.Value)
            {
                return BadRequest(new { message = "dueFrom must be less than or equal to dueTo." });
            }

            if (!TryParseStatusFilter(query.Status, out var statusFilter))
            {
                return BadRequest(new { message = "Invalid status filter. Allowed values: todo, in-progress, completed." });
            }

            if (!TryParsePriorityFilter(query.Priority, out var priorityFilter))
            {
                return BadRequest(new { message = "Invalid priority filter. Allowed values: low, medium, high." });
            }

            var ownerUserId = isAdmin ? null : userId;
            var search = string.IsNullOrWhiteSpace(query.Search) ? null : query.Search.Trim();

            if (!query.Paged)
            {
                var tasks = await _unitOfWork.Tasks.GetFilteredOrderedByDueDateAsync(
                    ownerUserId,
                    search,
                    statusFilter,
                    priorityFilter,
                    query.LabelId,
                    query.DueFrom,
                    query.DueTo);

                return Ok(tasks.Select(MapToResponseDto));
            }

            var page = Math.Max(1, query.Page);
            var pageSize = query.PageSize <= 0 || query.PageSize > 100 ? 20 : query.PageSize;

            var (items, totalCount) = await _unitOfWork.Tasks.GetFilteredPagedOrderedByDueDateAsync(
                ownerUserId,
                search,
                statusFilter,
                priorityFilter,
                query.LabelId,
                query.DueFrom,
                query.DueTo,
                page,
                pageSize);

            var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling((double)totalCount / pageSize);
            var response = new PagedResultDto<TaskItemResponseDto>
            {
                Items = items.Select(MapToResponseDto).ToList(),
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages
            };

            return Ok(response);
        }

        /// <summary>
        /// Get a task by ID
        /// Admin: any task, User: only own tasks
        /// </summary>
        /// <param name="id">Task ID</param>
        /// <returns>Task details</returns>
        [HttpGet("{id}")]
        public async Task<ActionResult<TaskItemResponseDto>> GetById(int id)
        {
            var task = await _unitOfWork.Tasks.GetByIdWithLabelsAsync(id);

            if (task == null)
            {
                return NotFound(new { message = $"Task with ID {id} not found" });
            }

            // Check authorization: Admin can access any task, User can only access their own
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var isAdmin = User.IsInRole("Admin");

            if (!isAdmin && task.UserId != userId)
            {
                return Forbid("You do not have permission to access this task");
            }

            return Ok(MapToResponseDto(task));
        }

        /// <summary>
        /// Create a new task
        /// Automatically assigns to current user
        /// </summary>
        /// <param name="dto">Task creation data</param>
        /// <returns>Created task</returns>
        [HttpPost]
        public async Task<ActionResult<TaskItemResponseDto>> Create([FromBody] CreateTaskItemDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not found" });
            }

            var task = new TaskItem
            {
                Title = dto.Title,
                Description = dto.Description,
                Priority = ParsePriority(dto.Priority),
                Status = ParseStatus(dto.Status),
                DueDate = ParseDueDateTime(dto.DueDate, dto.DueTime),
                CreatedAt = DateTime.UtcNow,
                UserId = userId
            };

            // Attach labels (validate ownership)
            try
            {
                var labels = await LoadAndValidateLabelsAsync(userId, dto.LabelIds);
                task.Labels = labels.ToList();
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }

            await _unitOfWork.Tasks.AddAsync(task);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetById),
                new { id = task.Id },
                MapToResponseDto(task)
            );
        }

        /// <summary>
        /// Update an existing task
        /// Admin: any task, User: only own tasks
        /// </summary>
        /// <param name="id">Task ID</param>
        /// <param name="dto">Task update data</param>
        /// <returns>Updated task</returns>
        [HttpPut("{id}")]
        public async Task<ActionResult<TaskItemResponseDto>> Update(int id, [FromBody] UpdateTaskItemDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var task = await _unitOfWork.Tasks.GetByIdWithLabelsAsync(id);

            if (task == null)
            {
                return NotFound(new { message = $"Task with ID {id} not found" });
            }

            // Check authorization: Admin can update any task, User can only update their own
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var isAdmin = User.IsInRole("Admin");

            if (!isAdmin && task.UserId != userId)
            {
                return Forbid("You do not have permission to update this task");
            }

            task.Title = dto.Title;
            task.Description = dto.Description;
            task.Priority = ParsePriority(dto.Priority);
            task.Status = ParseStatus(dto.Status);
            task.DueDate = ParseDueDateTime(dto.DueDate, dto.DueTime);

            try
            {
                var labels = await LoadAndValidateLabelsAsync(userId, dto.LabelIds);
                task.Labels.Clear();
                foreach (var label in labels)
                {
                    task.Labels.Add(label);
                }
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }

            _unitOfWork.Tasks.Update(task);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapToResponseDto(task));
        }

        /// <summary>
        /// Update task status only
        /// Admin: any task, User: only own tasks
        /// </summary>
        /// <param name="id">Task ID</param>
        /// <param name="dto">New status</param>
        /// <returns>Updated task</returns>
        [HttpPatch("{id}/status")]
        public async Task<ActionResult<TaskItemResponseDto>> UpdateStatus(int id, [FromBody] UpdateTaskStatusDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var task = await _unitOfWork.Tasks.GetByIdWithLabelsAsync(id);

            if (task == null)
            {
                return NotFound(new { message = $"Task with ID {id} not found" });
            }

            // Check authorization: Admin can update any task, User can only update their own
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var isAdmin = User.IsInRole("Admin");

            if (!isAdmin && task.UserId != userId)
            {
                return Forbid("You do not have permission to update this task");
            }

            task.Status = ParseStatus(dto.Status);

            _unitOfWork.Tasks.Update(task);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapToResponseDto(task));
        }

        /// <summary>
        /// Update task due date only
        /// Admin: any task, User: only own tasks
        /// </summary>
        /// <param name="id">Task ID</param>
        /// <param name="dto">New due date</param>
        /// <returns>Updated task</returns>
        [HttpPatch("{id}/duedate")]
        public async Task<ActionResult<TaskItemResponseDto>> UpdateDueDate(int id, [FromBody] UpdateTaskDueDateDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var task = await _unitOfWork.Tasks.GetByIdWithLabelsAsync(id);

            if (task == null)
            {
                return NotFound(new { message = $"Task with ID {id} not found" });
            }

            // Check authorization: Admin can update any task, User can only update their own
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var isAdmin = User.IsInRole("Admin");

            if (!isAdmin && task.UserId != userId)
            {
                return Forbid("You do not have permission to update this task");
            }

            task.DueDate = ParseDueDateTime(dto.DueDate, dto.DueTime);

            _unitOfWork.Tasks.Update(task);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapToResponseDto(task));
        }

        /// <summary>
        /// Delete a task
        /// Admin: any task, User: only own tasks
        /// </summary>
        /// <param name="id">Task ID</param>
        /// <returns>No content on success</returns>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var task = await _unitOfWork.Tasks.GetByIdAsync(id);

            if (task == null || task.IsDeleted)
            {
                return NotFound(new { message = $"Task with ID {id} not found" });
            }

            // Check authorization: Admin can delete any task, User can only delete their own
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var isAdmin = User.IsInRole("Admin");

            if (!isAdmin && task.UserId != userId)
            {
                return Forbid("You do not have permission to delete this task");
            }

            task.IsDeleted = true;
            task.DeletedAt = DateTime.UtcNow;
            _unitOfWork.Tasks.Update(task);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }

        #region Helper Methods

        /// <summary>
        /// Map TaskItem entity to response DTO (matching frontend interface)
        /// </summary>
        private static TaskItemResponseDto MapToResponseDto(TaskItem task)
        {
            return new TaskItemResponseDto
            {
                Id = task.Id.ToString(),
                Title = task.Title,
                Description = task.Description,
                Priority = MapPriorityToString(task.Priority),
                Status = MapStatusToString(task.Status),
                DueDate = task.DueDate.ToString("yyyy-MM-ddTHH:mm:ss"),
                CreatedAt = task.CreatedAt.ToString("yyyy-MM-dd"),
                Labels = task.Labels?.Select(MapToLabelDto).ToList() ?? new List<LabelDto>()
            };
        }

        private static LabelDto MapToLabelDto(Label label)
        {
            return new LabelDto
            {
                Id = label.Id,
                Name = label.Name,
                Color = label.Color
            };
        }

        /// <summary>
        /// Parse DueDate (yyyy-MM-dd) + optional DueTime (HH:mm). If no time, use end of day (23:59:59).
        /// </summary>
        private static DateTime ParseDueDateTime(string dueDate, string? dueTime)
        {
            var datePart = DateOnly.Parse(dueDate.Trim());
            if (string.IsNullOrWhiteSpace(dueTime))
                return datePart.ToDateTime(new TimeOnly(23, 59, 59));
            var timePart = TimeOnly.ParseExact(dueTime.Trim(), "HH:mm", null);
            return datePart.ToDateTime(timePart);
        }

        /// <summary>
        /// Parse priority string from frontend to enum
        /// </summary>
        private static TaskPriority ParsePriority(string priority)
        {
            return priority.ToLower() switch
            {
                "low" => TaskPriority.Low,
                "high" => TaskPriority.High,
                _ => TaskPriority.Medium
            };
        }

        /// <summary>
        /// Parse status string from frontend to enum
        /// </summary>
        private static TaskItemStatus ParseStatus(string status)
        {
            return status.ToLower() switch
            {
                "in-progress" => TaskItemStatus.InProgress,
                "completed" => TaskItemStatus.Completed,
                _ => TaskItemStatus.Todo
            };
        }

        /// <summary>
        /// Validate label ids belong to current user and return label entities
        /// </summary>
        private async Task<IEnumerable<Label>> LoadAndValidateLabelsAsync(string userId, IEnumerable<int> labelIds)
        {
            var ids = labelIds?.Distinct().ToList() ?? new List<int>();
            if (!ids.Any())
            {
                return Enumerable.Empty<Label>();
            }

            var labels = await _unitOfWork.Labels.GetByIdsForUserAsync(userId, ids);
            var foundIds = labels.Select(l => l.Id).ToHashSet();
            var missing = ids.Where(id => !foundIds.Contains(id)).ToList();
            if (missing.Any())
            {
                throw new ArgumentException($"Invalid labels: {string.Join(",", missing)}");
            }
            return labels;
        }

        /// <summary>
        /// Map priority enum to frontend string format
        /// </summary>
        private static string MapPriorityToString(TaskPriority priority)
        {
            return priority switch
            {
                TaskPriority.Low => "low",
                TaskPriority.High => "high",
                _ => "medium"
            };
        }

        /// <summary>
        /// Map status enum to frontend string format
        /// </summary>
        private static string MapStatusToString(TaskItemStatus status)
        {
            return status switch
            {
                TaskItemStatus.InProgress => "in-progress",
                TaskItemStatus.Completed => "completed",
                _ => "todo"
            };
        }

        private static bool TryParseStatusFilter(string? status, out TaskItemStatus? value)
        {
            value = null;
            if (string.IsNullOrWhiteSpace(status))
            {
                return true;
            }

            var normalized = status.Trim().ToLowerInvariant();
            value = normalized switch
            {
                "todo" => TaskItemStatus.Todo,
                "in-progress" => TaskItemStatus.InProgress,
                "completed" => TaskItemStatus.Completed,
                _ => null
            };

            return value.HasValue;
        }

        private static bool TryParsePriorityFilter(string? priority, out TaskPriority? value)
        {
            value = null;
            if (string.IsNullOrWhiteSpace(priority))
            {
                return true;
            }

            var normalized = priority.Trim().ToLowerInvariant();
            value = normalized switch
            {
                "low" => TaskPriority.Low,
                "medium" => TaskPriority.Medium,
                "high" => TaskPriority.High,
                _ => null
            };

            return value.HasValue;
        }

        #endregion
    }
}
