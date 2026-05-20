using TaskifyAPI.Model.ViewModel;

namespace TaskifyAPI.Services
{
    public interface IOllamaFallbackService
    {
        Task<IReadOnlyList<OllamaModelSummaryDto>> GetModelsAsync(string baseUrl, CancellationToken cancellationToken = default);

        Task<string> GenerateFallbackReplyAsync(
            string baseUrl,
            string model,
            string messageText,
            string locale,
            CancellationToken cancellationToken = default);

        Task<string> NormalizeContextAsync(
            string baseUrl,
            string model,
            string messageText,
            IReadOnlyList<Model.ChatMessage> history,
            CancellationToken cancellationToken = default);
    }

    public sealed class OllamaValidationException : Exception
    {
        public OllamaValidationException(string message, Exception? innerException = null)
            : base(message, innerException)
        {
        }
    }

    public sealed class OllamaStoredConfigurationException : Exception
    {
        public OllamaStoredConfigurationException(string message, Exception? innerException = null)
            : base(message, innerException)
        {
        }
    }

    public sealed class OllamaRuntimeException : Exception
    {
        public OllamaRuntimeException(string message, Exception? innerException = null)
            : base(message, innerException)
        {
        }
    }
}
