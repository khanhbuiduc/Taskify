using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TaskifyAPI.Model
{
    public enum ChatMessageRole
    {
        User = 0,
        Assistant = 1
    }

    public class ChatMessage
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        public Guid SessionId { get; set; }

        [Required]
        [MaxLength(4000)]
        public string Text { get; set; } = string.Empty;

        [Required]
        public ChatMessageRole Role { get; set; }

        public DateTime SentAt { get; set; }

        [MaxLength(200)]
        public string? RasaMessageId { get; set; }

        public string? MetadataJson { get; set; }

        [ForeignKey(nameof(SessionId))]
        public ChatSession? Session { get; set; }
    }
}
