using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TaskifyAPI.Model
{
    /// <summary>
    /// Label entity for tagging tasks (user scoped)
    /// </summary>
    public class Label
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(60)]
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Hex color or palette key (e.g., "red", "#F97316")
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string Color { get; set; } = "#38bdf8";

        [Required]
        public string UserId { get; set; } = string.Empty;

        [ForeignKey(nameof(UserId))]
        public ApplicationUser? User { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    }
}
