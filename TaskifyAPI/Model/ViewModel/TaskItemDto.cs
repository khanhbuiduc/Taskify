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

        /// <summary>Label ids to attach (must belong to current user)</summary>
        public List<int> LabelIds { get; set; } = new();
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

        /// <summary>Label ids to attach (must belong to current user)</summary>
        public List<int> LabelIds { get; set; } = new();
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

    public class TaskQueryParamsDto
    {
        public bool Paged { get; set; } = false;
        public string? Search { get; set; }
        public string? Status { get; set; }
        public string? Priority { get; set; }
        public int? LabelId { get; set; }
        public DateTime? DueFrom { get; set; }
        public DateTime? DueTo { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
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
        public List<LabelDto> Labels { get; set; } = new();
    }

    public class LabelDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
    }

    public class CreateLabelDto
    {
        [Required]
        [MaxLength(60)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Color { get; set; } = "#38bdf8";
    }

    public class UpdateLabelDto
    {
        [Required]
        [MaxLength(60)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Color { get; set; } = "#38bdf8";
    }
}
