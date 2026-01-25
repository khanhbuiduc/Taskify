using System.ComponentModel.DataAnnotations;

namespace TaskifyAPI.Model
{
    /// <summary>
    /// TaskItem entity representing a task in the database
    /// </summary>
    public class TaskItem
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        [Required]
        public TaskPriority Priority { get; set; } = TaskPriority.Medium;

        [Required]
        public TaskItemStatus Status { get; set; } = TaskItemStatus.Todo;

        [Required]
        public DateTime DueDate { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
