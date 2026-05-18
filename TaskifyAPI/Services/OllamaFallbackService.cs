using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TaskifyAPI.Model.ViewModel;

namespace TaskifyAPI.Services
{
    public class OllamaFallbackService : IOllamaFallbackService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<OllamaFallbackService> _logger;

        public OllamaFallbackService(HttpClient httpClient, ILogger<OllamaFallbackService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
        }

        public async Task<IReadOnlyList<OllamaModelSummaryDto>> GetModelsAsync(string baseUrl, CancellationToken cancellationToken = default)
        {
            var normalizedBaseUrl = NormalizeBaseUrl(baseUrl);

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, $"{normalizedBaseUrl}/api/tags");
                using var response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
                var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

                if (!response.IsSuccessStatusCode)
                {
                    throw new OllamaValidationException(BuildOllamaErrorMessage(response.StatusCode, body, "Failed to query Ollama models."));
                }

                return ParseModelList(body);
            }
            catch (HttpRequestException ex)
            {
                throw new OllamaValidationException("Could not reach the Ollama server.", ex);
            }
            catch (TaskCanceledException ex)
            {
                throw new OllamaValidationException("The Ollama server did not respond in time.", ex);
            }
        }

        public async Task<string> GenerateFallbackReplyAsync(
            string baseUrl,
            string model,
            string messageText,
            string locale,
            CancellationToken cancellationToken = default)
        {
            var normalizedBaseUrl = NormalizeBaseUrl(baseUrl);
            var normalizedModel = (model ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedModel))
            {
                throw new OllamaStoredConfigurationException("Stored Ollama model is missing.");
            }

            var prompt = AiFallbackPromptBuilder.BuildPrompt(messageText, locale);
            try
            {
                var answer = await CallGenerateAsync(normalizedBaseUrl, normalizedModel, prompt, cancellationToken).ConfigureAwait(false);
                if (AiFallbackPromptBuilder.LooksTruncated(answer))
                {
                    var retryPrompt = AiFallbackPromptBuilder.BuildRetryPrompt(prompt, locale);
                    var retryAnswer = await CallGenerateAsync(normalizedBaseUrl, normalizedModel, retryPrompt, cancellationToken).ConfigureAwait(false);
                    if (!AiFallbackPromptBuilder.LooksTruncated(retryAnswer))
                    {
                        answer = retryAnswer;
                    }
                }

                return answer;
            }
            catch (OllamaStoredConfigurationException)
            {
                throw;
            }
            catch (HttpRequestException ex)
            {
                throw new OllamaRuntimeException("Could not reach the Ollama server.", ex);
            }
            catch (TaskCanceledException ex)
            {
                throw new OllamaRuntimeException("The Ollama server did not respond in time.", ex);
            }
        }

        private async Task<string> CallGenerateAsync(string baseUrl, string model, string prompt, CancellationToken cancellationToken)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/api/generate");
            request.Content = JsonContent.Create(new
            {
                model,
                prompt,
                stream = false
            });

            using var response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
            var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                var message = BuildOllamaErrorMessage(response.StatusCode, body, "Ollama generate failed.");
                if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.NotFound)
                {
                    throw new OllamaStoredConfigurationException(message);
                }

                throw new OllamaRuntimeException(message);
            }

            try
            {
                using var document = JsonDocument.Parse(body);
                var root = document.RootElement;
                var text = root.TryGetProperty("response", out var responseNode) && responseNode.ValueKind == JsonValueKind.String
                    ? responseNode.GetString()?.Trim()
                    : null;

                if (string.IsNullOrWhiteSpace(text))
                {
                    throw new OllamaRuntimeException("Ollama returned empty text.");
                }

                return text;
            }
            catch (JsonException ex)
            {
                throw new OllamaRuntimeException("Ollama returned malformed JSON.", ex);
            }
        }

        private static IReadOnlyList<OllamaModelSummaryDto> ParseModelList(string body)
        {
            try
            {
                using var document = JsonDocument.Parse(body);
                if (!document.RootElement.TryGetProperty("models", out var modelsNode) || modelsNode.ValueKind != JsonValueKind.Array)
                {
                    return Array.Empty<OllamaModelSummaryDto>();
                }

                var models = new List<OllamaModelSummaryDto>();
                foreach (var item in modelsNode.EnumerateArray())
                {
                    var name = item.TryGetProperty("name", out var nameNode) && nameNode.ValueKind == JsonValueKind.String
                        ? nameNode.GetString()
                        : null;
                    if (string.IsNullOrWhiteSpace(name))
                    {
                        continue;
                    }

                    var details = item.TryGetProperty("details", out var detailsNode) && detailsNode.ValueKind == JsonValueKind.Object
                        ? detailsNode
                        : default;

                    models.Add(new OllamaModelSummaryDto
                    {
                        Name = name,
                        Family = details.ValueKind == JsonValueKind.Object && details.TryGetProperty("family", out var familyNode) && familyNode.ValueKind == JsonValueKind.String
                            ? familyNode.GetString()
                            : null,
                        ParameterSize = details.ValueKind == JsonValueKind.Object && details.TryGetProperty("parameter_size", out var parameterNode) && parameterNode.ValueKind == JsonValueKind.String
                            ? parameterNode.GetString()
                            : null,
                        QuantizationLevel = details.ValueKind == JsonValueKind.Object && details.TryGetProperty("quantization_level", out var quantNode) && quantNode.ValueKind == JsonValueKind.String
                            ? quantNode.GetString()
                            : null
                    });
                }

                return models
                    .OrderBy(model => model.Name, StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }
            catch (JsonException ex)
            {
                throw new OllamaValidationException("Ollama returned malformed JSON.", ex);
            }
        }

        public static string NormalizeBaseUrl(string rawBaseUrl)
        {
            var normalized = (rawBaseUrl ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalized))
            {
                throw new OllamaValidationException("Ollama URL is required.");
            }

            if (!Uri.TryCreate(normalized, UriKind.Absolute, out var uri))
            {
                throw new OllamaValidationException("Ollama URL is invalid.");
            }

            if (!string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
            {
                throw new OllamaValidationException("Ollama URL must use http or https.");
            }

            return uri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
        }

        private static string BuildOllamaErrorMessage(HttpStatusCode statusCode, string body, string fallbackMessage)
        {
            var extracted = ExtractErrorMessage(body);
            if (!string.IsNullOrWhiteSpace(extracted))
            {
                return extracted;
            }

            return $"{fallbackMessage} Status code: {(int)statusCode}.";
        }

        private static string ExtractErrorMessage(string body)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return string.Empty;
            }

            try
            {
                using var document = JsonDocument.Parse(body);
                if (document.RootElement.TryGetProperty("error", out var errorNode) && errorNode.ValueKind == JsonValueKind.String)
                {
                    return errorNode.GetString() ?? string.Empty;
                }
            }
            catch (JsonException)
            {
                // Ignore parsing issues and fall back to generic messaging.
            }

            return string.Empty;
        }
    }
}
