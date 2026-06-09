using TaskifyAPI.Model.ViewModel;

namespace TaskifyAPI.Services
{
    public interface IGeminiCredentialService
    {
        Task<GeminiCredentialStatusDto> GetStatusAsync(string userId, CancellationToken cancellationToken = default);

        Task<GeminiCredentialStatusDto> SaveApiKeyAsync(
            string userId,
            string apiKey,
            CancellationToken cancellationToken = default);

        Task<GeminiCredentialStatusDto> DeleteAsync(string userId, CancellationToken cancellationToken = default);

        Task<string> GenerateFallbackReplyAsync(
            string userId,
            string messageText,
            string locale,
            CancellationToken cancellationToken = default);

        IAsyncEnumerable<string> StreamFallbackReplyAsync(
            string userId,
            string messageText,
            string locale,
            CancellationToken cancellationToken = default);

        Task<string> NormalizeContextAsync(
            string userId,
            string messageText,
            IReadOnlyList<Model.ChatMessage> history,
            CancellationToken cancellationToken = default);

        Task<GeminiEntityExtractionResultDto> ExtractEntitiesAsync(
            string userId,
            string messageText,
            CancellationToken cancellationToken = default);
    }

    public sealed class GeminiNotConfiguredException : Exception
    {
        public GeminiNotConfiguredException()
            : base("Gemini is not configured for this user.")
        {
        }
    }

    public sealed class GeminiInvalidApiKeyException : Exception
    {
        public GeminiInvalidApiKeyException(string message)
            : base(message)
        {
        }
    }

    public sealed class GeminiValidationFailedException : Exception
    {
        public GeminiValidationFailedException(string message, Exception? innerException = null)
            : base(message, innerException)
        {
        }
    }

    public sealed class GeminiStoredCredentialException : Exception
    {
        public GeminiStoredCredentialException(string message, Exception? innerException = null)
            : base(message, innerException)
        {
        }
    }
}
