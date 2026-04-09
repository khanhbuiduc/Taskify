using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TaskifyAPI.Model
{
    /// <summary>
    /// User-defined finance category.
    /// </summary>
    public class FinanceCategory
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(60)]
        public string Name { get; set; } = string.Empty;

        [Required]
        public string UserId { get; set; } = string.Empty;

        [ForeignKey(nameof(UserId))]
        public ApplicationUser? User { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
