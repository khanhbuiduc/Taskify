using System.ComponentModel.DataAnnotations;

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
    }

    /// <summary>
    /// Single message in chat response (from Rasa webhook).
    /// </summary>
    public class ChatMessageDto
    {
        public string Text { get; set; } = string.Empty;
    }

    /// <summary>
    /// Response body for POST /api/chat.
    /// </summary>
    public class ChatResponseDto
    {
        public IReadOnlyList<ChatMessageDto> Messages { get; set; } = Array.Empty<ChatMessageDto>();
    }
}
