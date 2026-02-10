using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TaskifyAPI.Model
{
    /// <summary>
    /// DailyGoal entity representing a daily goal in the database
    /// </summary>
    public class DailyGoal
    {
        [Key]
        public int Id { get; set; }

        /// <summary>
        /// User ID who owns this goal
        /// </summary>
        [Required]
        public string UserId { get; set; } = string.Empty;

        /// <summary>
        /// Goal title/description
        /// </summary>
        [Required]
        [MaxLength(500)]
        public string Title { get; set; } = string.Empty;

        /// <summary>
        /// Whether the goal has been completed
        /// </summary>
        public bool IsCompleted { get; set; } = false;

        /// <summary>
        /// Date the goal was created (used to filter by day)
        /// </summary>
        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Navigation property to the user who owns this goal
        /// </summary>
        [ForeignKey(nameof(UserId))]
        public ApplicationUser? User { get; set; }
    }
}
