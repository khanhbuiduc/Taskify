using System.ComponentModel.DataAnnotations;

namespace TaskifyAPI.Model.ViewModel
{
    /// <summary>
    /// DTO for creating a daily goal
    /// </summary>
    public class CreateDailyGoalDto
    {
        [Required]
        [MaxLength(500)]
        public string Title { get; set; } = string.Empty;
    }

    /// <summary>
    /// DTO for updating a daily goal
    /// </summary>
    public class UpdateDailyGoalDto
    {
        [MaxLength(500)]
        public string? Title { get; set; }
        public bool? IsCompleted { get; set; }
    }

    /// <summary>
    /// Response DTO for daily goal
    /// </summary>
    public class DailyGoalResponseDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public bool IsCompleted { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
