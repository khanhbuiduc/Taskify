using TaskifyAPI.Model;
using TaskifyAPI.Model.ViewModel;

namespace TaskifyAPI.Services
{
    public sealed class ProcessedChatTurn
    {
        public required ChatSession Session { get; init; }
        public required ChatMessage UserMessage { get; init; }
        public required IReadOnlyList<ChatMessage> AssistantMessages { get; init; }
    }

    public interface IChatOrchestrationService
    {
        Task<ProcessedChatTurn> ProcessMessageAsync(
            Guid sessionId,
            string userId,
            ChatRequestDto dto,
            Func<ChatStreamEventDto, CancellationToken, ValueTask>? onEvent = null,
            CancellationToken cancellationToken = default);
    }
}
