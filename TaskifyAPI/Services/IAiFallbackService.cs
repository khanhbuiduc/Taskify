using TaskifyAPI.Model;
using TaskifyAPI.Model.ViewModel;

namespace TaskifyAPI.Services
{
    public interface IAiFallbackService
    {
        Task<AiFallbackSettingsDto> GetSettingsAsync(string userId, CancellationToken cancellationToken = default);

        Task<AiFallbackSettingsDto> SaveActiveProviderAsync(
            string userId,
            AiProvider provider,
            CancellationToken cancellationToken = default);

        Task<IReadOnlyList<OllamaModelSummaryDto>> GetOllamaModelsAsync(
            string baseUrl,
            CancellationToken cancellationToken = default);

        Task<AiFallbackSettingsDto> SaveOllamaSettingsAsync(
            string userId,
            string baseUrl,
            string model,
            CancellationToken cancellationToken = default);

        Task<AiFallbackSettingsDto> DeleteOllamaSettingsAsync(
            string userId,
            CancellationToken cancellationToken = default);

        Task HandleGeminiDeletedAsync(string userId, CancellationToken cancellationToken = default);

        Task<InternalAiFallbackResponse> GenerateFallbackReplyAsync(
            string userId,
            string messageText,
            string locale,
            CancellationToken cancellationToken = default);
    }

    public sealed class AiFallbackNotConfiguredException : Exception
    {
        public AiFallbackNotConfiguredException(string message)
            : base(message)
        {
        }
    }
}
