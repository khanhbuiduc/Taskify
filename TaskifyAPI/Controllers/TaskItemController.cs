using Microsoft.AspNetCore.Mvc;
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
    public class TaskItemController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;

        public TaskItemController(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        /// <summary>
        /// Get all tasks
        /// </summary>
        /// <returns>List of all tasks</returns>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<TaskItemResponseDto>>> GetAll()
        {
            var tasks = await _unitOfWork.Tasks.GetAllOrderedByDueDateAsync();
            var response = tasks.Select(MapToResponseDto);
            return Ok(response);
        }

        /// <summary>
        /// Get a task by ID
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

            return Ok(MapToResponseDto(task));
        }

        /// <summary>
        /// Create a new task
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

            var task = new TaskItem
            {
                Title = dto.Title,
                Description = dto.Description,
                Priority = ParsePriority(dto.Priority),
                Status = ParseStatus(dto.Status),
                DueDate = DateTime.Parse(dto.DueDate),
                CreatedAt = DateTime.UtcNow
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

            task.Status = ParseStatus(dto.Status);

            _unitOfWork.Tasks.Update(task);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapToResponseDto(task));
        }

        /// <summary>
        /// Update task due date only
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

            task.DueDate = DateTime.Parse(dto.DueDate);

            _unitOfWork.Tasks.Update(task);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapToResponseDto(task));
        }

        /// <summary>
        /// Delete a task
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
