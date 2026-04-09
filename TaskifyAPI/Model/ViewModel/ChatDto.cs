using System.ComponentModel.DataAnnotations;
using TaskifyAPI.Model;

namespace TaskifyAPI.Model.ViewModel
{
    /// <summary>
    /// Request body for POST /api/chat (Rasa proxy).
    /// </summary>
    public class ChatRequestDto
    {
        [Required]
        [MaxLength(4000)]
        public string Message { get; set; } = string.Empty;

        /// <summary>
        /// Optional typed metadata payload serialized as JSON string.
        /// Used for structured chat actions (task picker confirm, undo, etc.).
        /// </summary>
        public string? MetadataJson { get; set; }
    }

    /// <summary>
    /// Single message in chat response (from Rasa webhook or history).
    /// </summary>
    public class ChatMessageDto
    {
        public Guid Id { get; set; }
        public ChatMessageRole Role { get; set; }
        public string Text { get; set; } = string.Empty;
        public string? MetadataJson { get; set; }
        public DateTime SentAt { get; set; }
    }

    /// <summary>
    /// Response body for POST /api/chat (legacy).
    /// </summary>
    public class ChatResponseDto
    {
        public IReadOnlyList<ChatMessageDto> Messages { get; set; } = Array.Empty<ChatMessageDto>();
    }

    public class ChatSessionDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class ChatThreadDto
    {
        public ChatSessionDto Session { get; set; } = new ChatSessionDto();
        public IReadOnlyList<ChatMessageDto> Messages { get; set; } = Array.Empty<ChatMessageDto>();
    }
}
