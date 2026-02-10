using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TaskifyAPI.Model
{
    /// <summary>
    /// FocusSession entity representing a focus session in the database
    /// </summary>
    public class FocusSession
    {
        [Key]
        public int Id { get; set; }

        /// <summary>
        /// User ID who owns this session
        /// </summary>
        [Required]
        public string UserId { get; set; } = string.Empty;

        /// <summary>
        /// Duration of the session in minutes
        /// </summary>
        [Required]
        public int DurationMinutes { get; set; }

        /// <summary>
        /// Number of breaks taken during this session
        /// </summary>
        public int BreaksTaken { get; set; } = 0;

        /// <summary>
        /// Whether the session was completed or ended early
        /// </summary>
        public bool IsCompleted { get; set; } = false;

        /// <summary>
        /// When the session started
        /// </summary>
        [Required]
        public DateTime StartedAt { get; set; }

        /// <summary>
        /// When the session ended (null if not ended yet)
        /// </summary>
        public DateTime? EndedAt { get; set; }

        /// <summary>
        /// Navigation property to the user who owns this session
        /// </summary>
        [ForeignKey(nameof(UserId))]
        public ApplicationUser? User { get; set; }
    }
}
