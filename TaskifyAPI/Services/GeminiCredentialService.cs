using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using TaskifyAPI.Data;
using TaskifyAPI.Model;
using TaskifyAPI.Model.ViewModel;

namespace TaskifyAPI.Services
{
    public class GeminiCredentialService : IGeminiCredentialService
    {
        private const string DataProtectionPurpose = "Taskify.UserGeminiCredential";
        private const string DefaultModel = "gemini-flash-latest";
        private const int MaxOutputTokens = 1000;

        private readonly HttpClient _httpClient;
        private readonly ApplicationDbContext _dbContext;
        private readonly IDataProtector _protector;
        private readonly ILogger<GeminiCredentialService> _logger;
        private readonly string _model;

        public GeminiCredentialService(
            HttpClient httpClient,
            ApplicationDbContext dbContext,
            IDataProtectionProvider dataProtectionProvider,
            IConfiguration configuration,
            ILogger<GeminiCredentialService> logger)
        {
            _httpClient = httpClient;
            _dbContext = dbContext;
            _protector = dataProtectionProvider.CreateProtector(DataProtectionPurpose);
            _logger = logger;
            _model = configuration["Gemini:Model"]?.Trim() ?? DefaultModel;
        }

        public async Task<GeminiCredentialStatusDto> GetStatusAsync(string userId, CancellationToken cancellationToken = default)
        {
            var credential = await _dbContext.UserGeminiCredentials
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken)
                .ConfigureAwait(false);

            return MapStatus(credential);
        }

        public async Task<GeminiCredentialStatusDto> SaveApiKeyAsync(
            string userId,
            string apiKey,
            CancellationToken cancellationToken = default)
        {
            var normalizedApiKey = (apiKey ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedApiKey))
            {
                throw new GeminiInvalidApiKeyException("Gemini API key is required.");
            }

            await CallGeminiAsync(
                normalizedApiKey,
                BuildValidationPrompt(),
                cancellationToken).ConfigureAwait(false);

            var nowUtc = DateTime.UtcNow;
            var credential = await _dbContext.UserGeminiCredentials
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken)
                .ConfigureAwait(false);

            if (credential == null)
            {
                credential = new UserGeminiCredential
                {
                    UserId = userId,
                    CreatedAtUtc = nowUtc
                };
                await _dbContext.UserGeminiCredentials.AddAsync(credential, cancellationToken).ConfigureAwait(false);
            }

            credential.EncryptedApiKey = _protector.Protect(normalizedApiKey);
            credential.Status = GeminiCredentialStatus.Valid;
            credential.LastValidatedAtUtc = nowUtc;
            credential.LastValidationError = null;
            credential.UpdatedAtUtc = nowUtc;

            await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return MapStatus(credential);
        }

        public async Task<GeminiCredentialStatusDto> DeleteAsync(string userId, CancellationToken cancellationToken = default)
        {
            var credential = await _dbContext.UserGeminiCredentials
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken)
                .ConfigureAwait(false);

            if (credential != null)
            {
                _dbContext.UserGeminiCredentials.Remove(credential);
                await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            }

            return new GeminiCredentialStatusDto
            {
                Configured = false,
                Status = GeminiCredentialStatus.NotConfigured
            };
        }

        public async Task<string> GenerateFallbackReplyAsync(
            string userId,
            string messageText,
            string locale,
            CancellationToken cancellationToken = default)
        {
            var credential = await _dbContext.UserGeminiCredentials
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken)
                .ConfigureAwait(false);

            if (credential == null || string.IsNullOrWhiteSpace(credential.EncryptedApiKey))
            {
                throw new GeminiNotConfiguredException();
            }

            string apiKey;
            try
            {
                apiKey = _protector.Unprotect(credential.EncryptedApiKey);
            }
            catch (CryptographicException ex)
            {
                await MarkCredentialStateAsync(
                    credential,
                    GeminiCredentialStatus.ValidationFailed,
                    "Stored Gemini API key could not be decrypted.",
                    cancellationToken).ConfigureAwait(false);
                throw new GeminiStoredCredentialException("Stored Gemini API key could not be decrypted.", ex);
            }

            var prompt = AiFallbackPromptBuilder.BuildPrompt(messageText, locale);

            try
            {
                var answer = await CallGeminiAsync(apiKey, prompt, cancellationToken).ConfigureAwait(false);
                if (AiFallbackPromptBuilder.LooksTruncated(answer))
                {
                    var retryPrompt = AiFallbackPromptBuilder.BuildRetryPrompt(prompt, locale);
                    var retryAnswer = await CallGeminiAsync(apiKey, retryPrompt, cancellationToken).ConfigureAwait(false);
                    if (!AiFallbackPromptBuilder.LooksTruncated(retryAnswer))
                    {
                        answer = retryAnswer;
                    }
                }

                credential.Status = GeminiCredentialStatus.Valid;
                credential.LastValidatedAtUtc = DateTime.UtcNow;
                credential.LastValidationError = null;
                credential.UpdatedAtUtc = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

                return answer;
            }
            catch (GeminiInvalidApiKeyException ex)
            {
                await MarkCredentialStateAsync(
                    credential,
                    GeminiCredentialStatus.Invalid,
                    ex.Message,
                    cancellationToken).ConfigureAwait(false);
                throw;
            }
            catch (GeminiStoredCredentialException)
            {
                throw;
            }
            catch (GeminiValidationFailedException ex)
            {
                await MarkCredentialStateAsync(
                    credential,
                    GeminiCredentialStatus.ValidationFailed,
                    ex.Message,
                    cancellationToken).ConfigureAwait(false);
                throw;
            }
        }

        private async Task<string> CallGeminiAsync(string apiKey, string prompt, CancellationToken cancellationToken)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"/v1beta/models/{_model}:generateContent");
            request.Headers.TryAddWithoutValidation("X-goog-api-key", apiKey);
            request.Content = JsonContent.Create(new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new[]
                        {
                            new { text = prompt }
                        }
                    }
                },
                generationConfig = new
                {
                    temperature = 0.4,
                    maxOutputTokens = MaxOutputTokens
                }
            });

            using var response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
            var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                throw CreateGeminiException(response.StatusCode, body);
            }

            try
            {
                using var document = JsonDocument.Parse(body);
                var root = document.RootElement;
                if (!root.TryGetProperty("candidates", out var candidates) || candidates.ValueKind != JsonValueKind.Array || candidates.GetArrayLength() == 0)
                {
                    throw new GeminiValidationFailedException("Gemini returned no candidates.");
                }

                var firstCandidate = candidates[0];
                if (!firstCandidate.TryGetProperty("content", out var content)
                    || !content.TryGetProperty("parts", out var parts)
                    || parts.ValueKind != JsonValueKind.Array)
                {
                    throw new GeminiValidationFailedException("Gemini returned no text content.");
                }

                var text = string.Concat(
                    parts.EnumerateArray()
                        .Where(item => item.TryGetProperty("text", out _))
                        .Select(item => item.GetProperty("text").GetString() ?? string.Empty))
                    .Trim();

                if (string.IsNullOrWhiteSpace(text))
                {
                    throw new GeminiValidationFailedException("Gemini returned empty text.");
                }

                return text;
            }
            catch (JsonException ex)
            {
                throw new GeminiValidationFailedException("Gemini returned malformed JSON.", ex);
            }
        }

        private Exception CreateGeminiException(HttpStatusCode statusCode, string responseBody)
        {
            var normalizedBody = responseBody ?? string.Empty;
            var responseMessage = ExtractErrorMessage(normalizedBody);
            var isApiKeyIssue =
                statusCode is HttpStatusCode.BadRequest or HttpStatusCode.Unauthorized
                || (statusCode == HttpStatusCode.Forbidden
                    && ContainsAny(responseMessage, "api key", "credential", "permission", "access"));

            if (isApiKeyIssue)
            {
                return new GeminiInvalidApiKeyException(
                    string.IsNullOrWhiteSpace(responseMessage)
                        ? "The Gemini API key is invalid or no longer authorized."
                        : responseMessage);
            }

            _logger.LogWarning("Gemini request failed with status code {StatusCode}.", (int)statusCode);
            return new GeminiValidationFailedException(
                string.IsNullOrWhiteSpace(responseMessage)
                    ? "Gemini request failed."
                    : responseMessage);
        }

        private static string ExtractErrorMessage(string responseBody)
        {
            if (string.IsNullOrWhiteSpace(responseBody))
            {
                return string.Empty;
            }

            try
            {
                using var document = JsonDocument.Parse(responseBody);
                if (document.RootElement.TryGetProperty("error", out var error))
                {
                    if (error.TryGetProperty("message", out var message) && message.ValueKind == JsonValueKind.String)
                    {
                        return message.GetString() ?? string.Empty;
                    }
                }
            }
            catch (JsonException)
            {
                // Ignore and fall back to a generic message.
            }

            return string.Empty;
        }

        private static string BuildValidationPrompt()
        {
            return "Reply with exactly OK.";
        }

        private async Task MarkCredentialStateAsync(
            UserGeminiCredential credential,
            GeminiCredentialStatus status,
            string errorMessage,
            CancellationToken cancellationToken)
        {
            credential.Status = status;
            credential.LastValidationError = errorMessage.Length > 1000
                ? errorMessage[..1000]
                : errorMessage;
            credential.UpdatedAtUtc = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        private static GeminiCredentialStatusDto MapStatus(UserGeminiCredential? credential)
        {
            if (credential == null)
            {
                return new GeminiCredentialStatusDto
                {
                    Configured = false,
                    Status = GeminiCredentialStatus.NotConfigured
                };
            }

            return new GeminiCredentialStatusDto
            {
                Configured = !string.IsNullOrWhiteSpace(credential.EncryptedApiKey),
                Status = credential.Status,
                LastValidatedAtUtc = credential.LastValidatedAtUtc,
                LastValidationError = credential.LastValidationError
            };
        }

        private static bool ContainsAny(string value, params string[] fragments)
        {
            return fragments.Any(fragment => value.Contains(fragment, StringComparison.OrdinalIgnoreCase));
        }
    }
}
