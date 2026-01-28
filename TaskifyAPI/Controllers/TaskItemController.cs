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
        public async Task<ActionResult<IEnumerable<TaskItemResponseDto>>> GetAll()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var isAdmin = User.IsInRole("Admin");

            // Admin sees all tasks, User sees only their own
            var tasks = await _unitOfWork.Tasks.GetAllOrderedByDueDateAsync(isAdmin ? null : userId);
            var response = tasks.Select(MapToResponseDto);
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
            var task = await _unitOfWork.Tasks.GetByIdAsync(id);

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
                DueDate = DateTime.Parse(dto.DueDate),
                CreatedAt = DateTime.UtcNow,
                UserId = userId
            };

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

            var task = await _unitOfWork.Tasks.GetByIdAsync(id);

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
            task.DueDate = DateTime.Parse(dto.DueDate);

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

            var task = await _unitOfWork.Tasks.GetByIdAsync(id);

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

            var task = await _unitOfWork.Tasks.GetByIdAsync(id);

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

            task.DueDate = DateTime.Parse(dto.DueDate);

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

            if (task == null)
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

            _unitOfWork.Tasks.Remove(task);
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
                DueDate = task.DueDate.ToString("yyyy-MM-dd"),
                CreatedAt = task.CreatedAt.ToString("yyyy-MM-dd")
            };
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

        #endregion
    }
}
