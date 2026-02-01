using System.ComponentModel.DataAnnotations;

namespace TaskifyAPI.Model.ViewModel
{
    /// <summary>
    /// DTO for creating a new task
    /// </summary>
    public class CreateTaskItemDto
    {
        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(4000)]
        public string Description { get; set; } = string.Empty;

        [Required]
        public string Priority { get; set; } = "medium";

        [Required]
        public string Status { get; set; } = "todo";

        [Required]
        public string DueDate { get; set; } = string.Empty;

        /// <summary>Optional time "HH:mm". If null/empty, deadline is end of that day (23:59:59).</summary>
        public string? DueTime { get; set; }
    }

    /// <summary>
    /// DTO for updating an existing task
    /// </summary>
    public class UpdateTaskItemDto
    {
        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(4000)]
        public string Description { get; set; } = string.Empty;

        [Required]
        public string Priority { get; set; } = "medium";

        [Required]
        public string Status { get; set; } = "todo";

        [Required]
        public string DueDate { get; set; } = string.Empty;

        /// <summary>Optional time "HH:mm". If null/empty, deadline is end of that day (23:59:59).</summary>
        public string? DueTime { get; set; }
    }

    /// <summary>
    /// DTO for updating task status only
    /// </summary>
    public class UpdateTaskStatusDto
    {
        [Required]
        public string Status { get; set; } = string.Empty;
    }

    /// <summary>
    /// DTO for updating task due date only
    /// </summary>
    public class UpdateTaskDueDateDto
    {
        [Required]
        public string DueDate { get; set; } = string.Empty;

        /// <summary>Optional time "HH:mm". If null/empty, deadline is end of that day (23:59:59).</summary>
        public string? DueTime { get; set; }
    }

    /// <summary>
    /// Response DTO matching frontend Task interface
    /// </summary>
    public class TaskItemResponseDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string DueDate { get; set; } = string.Empty;
        public string CreatedAt { get; set; } = string.Empty;
    }
}
