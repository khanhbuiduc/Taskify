using System.Net.Http.Json;
using System.Text.Json;

namespace TaskifyAPI.Services
{
    /// <summary>
    /// Proxies chat to Rasa REST webhook. Handles timeouts and errors with friendly fallback message.
    /// </summary>
    public class RasaChatService : IRasaChatService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<RasaChatService> _logger;

        private const string FallbackMessage = "The assistant is temporarily unavailable. Please try again later.";

        public RasaChatService(HttpClient httpClient, IConfiguration configuration, ILogger<RasaChatService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<IReadOnlyList<string>> SendMessageAsync(string userId, string messageText, CancellationToken cancellationToken = default)
        {
            var token = _configuration["Rasa:Token"];
            var query = string.IsNullOrWhiteSpace(token) ? "" : $"?token={Uri.EscapeDataString(token)}";
            var url = $"/webhooks/rest/webhook{query}";

            var body = new { sender = userId, message = messageText };

            try
            {
                var response = await _httpClient.PostAsJsonAsync(url, body, cancellationToken).ConfigureAwait(false);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Rasa webhook returned {StatusCode} for sender {SenderId}", response.StatusCode, userId);
                    return new[] { FallbackMessage };
                }

                // Rasa returns array of { "recipient_id", "text" }
                var list = await response.Content.ReadFromJsonAsync<List<RasaWebhookMessage>>(cancellationToken).ConfigureAwait(false);
                if (list == null || list.Count == 0)
                    return new[] { FallbackMessage };

                return list
                    .Where(m => !string.IsNullOrWhiteSpace(m?.text))
                    .Select(m => m!.text!.Trim())
                    .ToList();
            }
            catch (TaskCanceledException)
            {
                _logger.LogWarning("Rasa request timed out for sender {SenderId}", userId);
                return new[] { FallbackMessage };
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "Rasa request failed for sender {SenderId}", userId);
                return new[] { FallbackMessage };
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Rasa response was not valid JSON for sender {SenderId}", userId);
                return new[] { FallbackMessage };
            }
        }

        private class RasaWebhookMessage
        {
            public string? recipient_id { get; set; }
            public string? text { get; set; }
        }
    }
}
