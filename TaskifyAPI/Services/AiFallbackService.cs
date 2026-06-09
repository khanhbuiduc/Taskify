using Microsoft.EntityFrameworkCore;
using TaskifyAPI.Data;
using TaskifyAPI.Model;
using TaskifyAPI.Model.ViewModel;

namespace TaskifyAPI.Services
{
    public class AiFallbackService : IAiFallbackService
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IGeminiCredentialService _geminiCredentialService;
        private readonly IOllamaFallbackService _ollamaFallbackService;

        public AiFallbackService(
            ApplicationDbContext dbContext,
            IGeminiCredentialService geminiCredentialService,
            IOllamaFallbackService ollamaFallbackService)
        {
            _dbContext = dbContext;
            _geminiCredentialService = geminiCredentialService;
            _ollamaFallbackService = ollamaFallbackService;
        }

        public async Task<AiFallbackSettingsDto> GetSettingsAsync(string userId, CancellationToken cancellationToken = default)
        {
            var settings = await _dbContext.UserAiFallbackSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken)
                .ConfigureAwait(false);

            var geminiStatus = await _geminiCredentialService.GetStatusAsync(userId, cancellationToken).ConfigureAwait(false);
            return MapSettings(settings, geminiStatus);
        }

        public async Task<AiFallbackSettingsDto> SaveActiveProviderAsync(
            string userId,
            AiProvider provider,
            CancellationToken cancellationToken = default)
        {
            var settings = await GetOrCreateSettingsEntityAsync(userId, cancellationToken).ConfigureAwait(false);
            var geminiStatus = await _geminiCredentialService.GetStatusAsync(userId, cancellationToken).ConfigureAwait(false);

            if (provider == AiProvider.Gemini)
            {
                if (!geminiStatus.Configured || geminiStatus.Status != GeminiCredentialStatus.Valid)
                {
                    throw new GeminiInvalidApiKeyException("A valid Gemini key is required before selecting Gemini.");
                }
            }
            else
            {
                await ValidateStoredOllamaConfigurationAsync(settings, cancellationToken).ConfigureAwait(false);
            }

            settings.ActiveProvider = provider;
            settings.UpdatedAtUtc = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

            return MapSettings(settings, geminiStatus);
        }

        public Task<IReadOnlyList<OllamaModelSummaryDto>> GetOllamaModelsAsync(string baseUrl, CancellationToken cancellationToken = default)
        {
            return _ollamaFallbackService.GetModelsAsync(baseUrl, cancellationToken);
        }

        public async Task<AiFallbackSettingsDto> SaveOllamaSettingsAsync(
            string userId,
            string baseUrl,
            string model,
            CancellationToken cancellationToken = default)
        {
            var normalizedModel = (model ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedModel))
            {
                throw new OllamaValidationException("Ollama model is required.");
            }

            var normalizedBaseUrl = OllamaFallbackService.NormalizeBaseUrl(baseUrl);
            var models = await _ollamaFallbackService.GetModelsAsync(normalizedBaseUrl, cancellationToken).ConfigureAwait(false);
            if (!models.Any(item => string.Equals(item.Name, normalizedModel, StringComparison.OrdinalIgnoreCase)))
            {
                throw new OllamaValidationException("The selected Ollama model was not found on that server.");
            }

            var nowUtc = DateTime.UtcNow;
            var settings = await GetOrCreateSettingsEntityAsync(userId, cancellationToken).ConfigureAwait(false);
            settings.OllamaBaseUrl = normalizedBaseUrl;
            settings.OllamaModel = normalizedModel;
            settings.LastOllamaValidatedAtUtc = nowUtc;
            settings.LastOllamaValidationError = null;
            settings.UpdatedAtUtc = nowUtc;

            await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

            var geminiStatus = await _geminiCredentialService.GetStatusAsync(userId, cancellationToken).ConfigureAwait(false);
            return MapSettings(settings, geminiStatus);
        }

        public async Task<AiFallbackSettingsDto> DeleteOllamaSettingsAsync(
            string userId,
            CancellationToken cancellationToken = default)
        {
            var settings = await _dbContext.UserAiFallbackSettings
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken)
                .ConfigureAwait(false);
            var geminiStatus = await _geminiCredentialService.GetStatusAsync(userId, cancellationToken).ConfigureAwait(false);

            if (settings == null)
            {
                return new AiFallbackSettingsDto
                {
                    ActiveProvider = null,
                    Gemini = geminiStatus,
                    Ollama = new OllamaSettingsStatusDto { Configured = false }
                };
            }

            settings.OllamaBaseUrl = null;
            settings.OllamaModel = null;
            settings.LastOllamaValidatedAtUtc = null;
            settings.LastOllamaValidationError = null;
            settings.UpdatedAtUtc = DateTime.UtcNow;

            if (settings.ActiveProvider == AiProvider.Ollama)
            {
                settings.ActiveProvider = geminiStatus.Configured && geminiStatus.Status == GeminiCredentialStatus.Valid
                    ? AiProvider.Gemini
                    : null;
            }

            await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return MapSettings(settings, geminiStatus);
        }

        public async Task HandleGeminiDeletedAsync(string userId, CancellationToken cancellationToken = default)
        {
            var settings = await _dbContext.UserAiFallbackSettings
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken)
                .ConfigureAwait(false);
            if (settings == null || settings.ActiveProvider != AiProvider.Gemini)
            {
                return;
            }

            settings.ActiveProvider = null;
            settings.UpdatedAtUtc = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        public async Task<InternalAiFallbackResponse> GenerateFallbackReplyAsync(
            string userId,
            string messageText,
            string locale,
            CancellationToken cancellationToken = default)
        {
            var settings = await _dbContext.UserAiFallbackSettings
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken)
                .ConfigureAwait(false);

            if (settings?.ActiveProvider == null)
            {
                throw new AiFallbackNotConfiguredException("No fallback provider is selected for this user.");
            }

            if (settings.ActiveProvider == AiProvider.Gemini)
            {
                var text = await _geminiCredentialService
                    .GenerateFallbackReplyAsync(userId, messageText, locale, cancellationToken)
                    .ConfigureAwait(false);
                return new InternalAiFallbackResponse
                {
                    Text = text,
                    Provider = AiProvider.Gemini
                };
            }

            try
            {
                await ValidateStoredOllamaConfigurationAsync(settings, cancellationToken).ConfigureAwait(false);
                var text = await _ollamaFallbackService
                    .GenerateFallbackReplyAsync(
                        settings.OllamaBaseUrl!,
                        settings.OllamaModel!,
                        messageText,
                        locale,
                        cancellationToken)
                    .ConfigureAwait(false);

                settings.LastOllamaValidatedAtUtc = DateTime.UtcNow;
                settings.LastOllamaValidationError = null;
                settings.UpdatedAtUtc = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

                return new InternalAiFallbackResponse
                {
                    Text = text,
                    Provider = AiProvider.Ollama
                };
            }
            catch (OllamaStoredConfigurationException ex)
            {
                await MarkOllamaErrorAsync(settings, ex.Message, cancellationToken).ConfigureAwait(false);
                throw;
            }
            catch (OllamaRuntimeException ex)
            {
                await MarkOllamaErrorAsync(settings, ex.Message, cancellationToken).ConfigureAwait(false);
                throw;
            }
        }

        public async IAsyncEnumerable<string> StreamFallbackReplyAsync(
            string userId,
            string messageText,
            string locale,
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var settings = await _dbContext.UserAiFallbackSettings
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken)
                .ConfigureAwait(false);

            if (settings?.ActiveProvider == null)
            {
                throw new AiFallbackNotConfiguredException("No fallback provider is selected for this user.");
            }

            if (settings.ActiveProvider == AiProvider.Gemini)
            {
                await using var geminiEnumerator = _geminiCredentialService
                    .StreamFallbackReplyAsync(userId, messageText, locale, cancellationToken)
                    .GetAsyncEnumerator(cancellationToken);

                while (await geminiEnumerator.MoveNextAsync().ConfigureAwait(false))
                {
                    yield return geminiEnumerator.Current;
                }

                yield break;
            }

            await ValidateStoredOllamaConfigurationAsync(settings, cancellationToken).ConfigureAwait(false);
            await using var ollamaEnumerator = _ollamaFallbackService
                .StreamFallbackReplyAsync(
                    settings.OllamaBaseUrl!,
                    settings.OllamaModel!,
                    messageText,
                    locale,
                    cancellationToken)
                .GetAsyncEnumerator(cancellationToken);

            while (true)
            {
                bool hasNext;
                try
                {
                    hasNext = await ollamaEnumerator.MoveNextAsync().ConfigureAwait(false);
                }
                catch (OllamaStoredConfigurationException ex)
                {
                    await MarkOllamaErrorAsync(settings, ex.Message, cancellationToken).ConfigureAwait(false);
                    throw;
                }
                catch (OllamaRuntimeException ex)
                {
                    await MarkOllamaErrorAsync(settings, ex.Message, cancellationToken).ConfigureAwait(false);
                    throw;
                }

                if (!hasNext)
                {
                    break;
                }

                yield return ollamaEnumerator.Current;
            }

            settings.LastOllamaValidatedAtUtc = DateTime.UtcNow;
            settings.LastOllamaValidationError = null;
            settings.UpdatedAtUtc = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        public async Task<string> NormalizeContextAsync(
            string userId,
            string messageText,
            IReadOnlyList<ChatMessage> history,
            CancellationToken cancellationToken = default)
        {
            var settings = await _dbContext.UserAiFallbackSettings
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken)
                .ConfigureAwait(false);

            if (settings?.ActiveProvider == null)
            {
                return messageText;
            }

            if (settings.ActiveProvider == AiProvider.Gemini)
            {
                return await _geminiCredentialService
                    .NormalizeContextAsync(userId, messageText, history, cancellationToken)
                    .ConfigureAwait(false);
            }

            try
            {
                await ValidateStoredOllamaConfigurationAsync(settings, cancellationToken).ConfigureAwait(false);
                var text = await _ollamaFallbackService
                    .NormalizeContextAsync(
                        settings.OllamaBaseUrl!,
                        settings.OllamaModel!,
                        messageText,
                        history,
                        cancellationToken)
                    .ConfigureAwait(false);

                settings.LastOllamaValidatedAtUtc = DateTime.UtcNow;
                settings.LastOllamaValidationError = null;
                settings.UpdatedAtUtc = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

                return text;
            }
            catch (OllamaStoredConfigurationException ex)
            {
                await MarkOllamaErrorAsync(settings, ex.Message, cancellationToken).ConfigureAwait(false);
                return messageText;
            }
            catch (OllamaRuntimeException ex)
            {
                await MarkOllamaErrorAsync(settings, ex.Message, cancellationToken).ConfigureAwait(false);
                return messageText;
            }
        }

        private async Task<UserAiFallbackSettings> GetOrCreateSettingsEntityAsync(string userId, CancellationToken cancellationToken)
        {
            var settings = await _dbContext.UserAiFallbackSettings
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken)
                .ConfigureAwait(false);

            if (settings != null)
            {
                return settings;
            }

            settings = new UserAiFallbackSettings
            {
                UserId = userId,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            await _dbContext.UserAiFallbackSettings.AddAsync(settings, cancellationToken).ConfigureAwait(false);
            return settings;
        }

        private async Task ValidateStoredOllamaConfigurationAsync(UserAiFallbackSettings settings, CancellationToken cancellationToken)
        {
            if (settings == null
                || string.IsNullOrWhiteSpace(settings.OllamaBaseUrl)
                || string.IsNullOrWhiteSpace(settings.OllamaModel))
            {
                throw new AiFallbackNotConfiguredException("Ollama is not configured for this user.");
            }

            IReadOnlyList<OllamaModelSummaryDto> models;
            try
            {
                models = await _ollamaFallbackService.GetModelsAsync(settings.OllamaBaseUrl, cancellationToken).ConfigureAwait(false);
            }
            catch (OllamaValidationException ex)
            {
                throw new OllamaStoredConfigurationException(ex.Message, ex);
            }

            if (!models.Any(item => string.Equals(item.Name, settings.OllamaModel, StringComparison.OrdinalIgnoreCase)))
            {
                throw new OllamaStoredConfigurationException("The stored Ollama model was not found on the configured server.");
            }
        }

        private async Task MarkOllamaErrorAsync(UserAiFallbackSettings settings, string errorMessage, CancellationToken cancellationToken)
        {
            settings.LastOllamaValidationError = errorMessage.Length > 1000
                ? errorMessage[..1000]
                : errorMessage;
            settings.UpdatedAtUtc = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        private static AiFallbackSettingsDto MapSettings(UserAiFallbackSettings? settings, GeminiCredentialStatusDto geminiStatus)
        {
            return new AiFallbackSettingsDto
            {
                ActiveProvider = settings?.ActiveProvider,
                Gemini = geminiStatus,
                Ollama = new OllamaSettingsStatusDto
                {
                    Configured = settings != null
                        && !string.IsNullOrWhiteSpace(settings.OllamaBaseUrl)
                        && !string.IsNullOrWhiteSpace(settings.OllamaModel),
                    BaseUrl = settings?.OllamaBaseUrl,
                    Model = settings?.OllamaModel,
                    LastValidatedAtUtc = settings?.LastOllamaValidatedAtUtc,
                    LastValidationError = settings?.LastOllamaValidationError
                }
            };
        }
    }
}
