using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
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

        public async Task<string> NormalizeContextAsync(
            string userId,
            string messageText,
            IReadOnlyList<ChatMessage> history,
            CancellationToken cancellationToken = default)
        {
            var credential = await _dbContext.UserGeminiCredentials
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken)
                .ConfigureAwait(false);

            if (credential == null || string.IsNullOrWhiteSpace(credential.EncryptedApiKey))
            {
                return messageText;
            }

            string apiKey;
            try
            {
                apiKey = _protector.Unprotect(credential.EncryptedApiKey);
            }
            catch (CryptographicException)
            {
                return messageText;
            }

            var prompt = AiFallbackPromptBuilder.BuildNormalizationPrompt(messageText, history);

            try
            {
                var answer = await CallGeminiAsync(apiKey, prompt, cancellationToken).ConfigureAwait(false);
                return string.IsNullOrWhiteSpace(answer) ? messageText : answer;
            }
            catch (Exception)
            {
                return messageText;
            }
        }

        public async Task<GeminiEntityExtractionResultDto> ExtractEntitiesAsync(
            string userId,
            string messageText,
            CancellationToken cancellationToken = default)
        {
            var credential = await _dbContext.UserGeminiCredentials
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken)
                .ConfigureAwait(false);

            if (credential == null || string.IsNullOrWhiteSpace(credential.EncryptedApiKey))
            {
                throw new GeminiNotConfiguredException();
            }

            if (string.IsNullOrWhiteSpace(messageText))
            {
                return new GeminiEntityExtractionResultDto();
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

            var prompt = BuildEntityExtractionPrompt(messageText);

            try
            {
                var answer = await CallGeminiAsync(apiKey, prompt, cancellationToken).ConfigureAwait(false);
                var entities = ParseEntityExtractionResponse(answer, messageText);

                credential.Status = GeminiCredentialStatus.Valid;
                credential.LastValidatedAtUtc = DateTime.UtcNow;
                credential.LastValidationError = null;
                credential.UpdatedAtUtc = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

                return new GeminiEntityExtractionResultDto
                {
                    Entities = entities
                };
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

        private static string BuildEntityExtractionPrompt(string messageText)
        {
            return
                "You are an entity extraction engine for the Taskify assistant.\n"
                + "Extract only these entities when they are explicitly present as exact spans from the user message:\n"
                + "- object_name: exact task or note name\n"
                + "- keyword: search/reference phrase for task, note, finance entry, or old finance category name\n"
                + "- content: note body or finance description\n"
                + "- category: finance category OR task label\n"
                + "- amount: money amount\n\n"
                + "Do NOT extract time/date, priority, task status, overdue state, or pin state.\n"
                + "Return JSON only with this exact shape:\n"
                + "{\"entities\":[{\"entity\":\"object_name\",\"value\":\"...\"}]}\n"
                + "Rules:\n"
                + "- value must be copied exactly from the user message.\n"
                + "- if no entity exists, return {\"entities\":[]}.\n"
                + "- do not add explanations, markdown, or code fences.\n\n"
                + $"User message: {messageText}";
        }

        private static IReadOnlyList<GeminiExtractedEntityDto> ParseEntityExtractionResponse(
            string answer,
            string originalText)
        {
            var normalized = ExtractJsonPayload(answer);

            try
            {
                using var document = JsonDocument.Parse(normalized);
                var root = document.RootElement;
                if (!root.TryGetProperty("entities", out var entitiesNode)
                    || entitiesNode.ValueKind != JsonValueKind.Array)
                {
                    throw new GeminiValidationFailedException("Gemini entity extraction returned invalid JSON shape.");
                }

                var extracted = new List<GeminiExtractedEntityDto>();
                var occupiedSpans = new List<(int Start, int End)>();

                foreach (var item in entitiesNode.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    var entity = item.TryGetProperty("entity", out var entityNode)
                        && entityNode.ValueKind == JsonValueKind.String
                        ? (entityNode.GetString() ?? string.Empty).Trim()
                        : string.Empty;
                    var value = item.TryGetProperty("value", out var valueNode)
                        && valueNode.ValueKind == JsonValueKind.String
                        ? (valueNode.GetString() ?? string.Empty).Trim()
                        : string.Empty;

                    if (!IsSupportedEntity(entity) || string.IsNullOrWhiteSpace(value))
                    {
                        continue;
                    }

                    if (!TryLocateSpan(originalText, value, occupiedSpans, out var start, out var end))
                    {
                        continue;
                    }

                    occupiedSpans.Add((start, end));
                    extracted.Add(new GeminiExtractedEntityDto
                    {
                        Entity = entity,
                        Value = originalText.Substring(start, end - start),
                        Start = start,
                        End = end,
                        Confidence = 1.0d,
                    });
                }

                return extracted
                    .OrderBy(item => item.Start)
                    .ThenBy(item => item.End)
                    .ToArray();
            }
            catch (JsonException ex)
            {
                throw new GeminiValidationFailedException("Gemini entity extraction returned malformed JSON.", ex);
            }
        }

        private static string ExtractJsonPayload(string answer)
        {
            var trimmed = (answer ?? string.Empty).Trim();
            if (trimmed.StartsWith("```", StringComparison.Ordinal))
            {
                trimmed = Regex.Replace(trimmed, "^```(?:json)?\\s*", string.Empty, RegexOptions.IgnoreCase);
                trimmed = Regex.Replace(trimmed, "\\s*```$", string.Empty, RegexOptions.IgnoreCase);
            }

            var start = trimmed.IndexOf('{');
            var end = trimmed.LastIndexOf('}');
            if (start >= 0 && end >= start)
            {
                return trimmed[start..(end + 1)];
            }

            return trimmed;
        }

        private static bool IsSupportedEntity(string entity)
        {
            return entity is "object_name" or "keyword" or "content" or "category" or "amount";
        }

        private static bool TryLocateSpan(
            string originalText,
            string value,
            IReadOnlyList<(int Start, int End)> occupiedSpans,
            out int start,
            out int end)
        {
            start = -1;
            end = -1;
            if (string.IsNullOrWhiteSpace(originalText) || string.IsNullOrWhiteSpace(value))
            {
                return false;
            }

            var searchIndex = 0;
            while (searchIndex < originalText.Length)
            {
                var index = originalText.IndexOf(value, searchIndex, StringComparison.OrdinalIgnoreCase);
                if (index < 0)
                {
                    return false;
                }

                var candidateEnd = index + value.Length;
                var overlaps = occupiedSpans.Any(span => index < span.End && candidateEnd > span.Start);
                if (!overlaps)
                {
                    start = index;
                    end = candidateEnd;
                    return true;
                }

                searchIndex = index + 1;
            }

            return false;
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
