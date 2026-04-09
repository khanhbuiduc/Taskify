using System.ComponentModel.DataAnnotations;

namespace TaskifyAPI.Model
{
    /// <summary>
    /// Persisted undo token for soft-deleted tasks.
    /// A token can reference multiple deleted tasks (batch delete).
    /// </summary>
    public class TaskDeleteUndoToken
    {
        [Key]
        [MaxLength(120)]
        public string Token { get; set; } = string.Empty;

        [Required]
        [MaxLength(450)]
        public string UserId { get; set; } = string.Empty;

        [MaxLength(120)]
        public string? SessionId { get; set; }

        [Required]
        public DateTime ExpiresAtUtc { get; set; }

        [Required]
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        [Required]
        public bool IsUsed { get; set; } = false;

        /// <summary>
        /// Comma-separated task ids for this delete batch.
        /// </summary>
        [Required]
        [MaxLength(2000)]
        public string TaskIdsCsv { get; set; } = string.Empty;
    }
}
