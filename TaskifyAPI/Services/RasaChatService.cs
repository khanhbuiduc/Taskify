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
            var locale = DetectLocale(messageText);
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
                    .Select(m => LocalizeStaticReply(m!.text!.Trim(), locale))
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
            public string? message_id { get; set; }
        }

        private static string DetectLocale(string messageText)
        {
            if (string.IsNullOrWhiteSpace(messageText))
            {
                return "en";
            }

            var lower = messageText.ToLowerInvariant();
            var vietnameseMarkers = new[]
            {
                "xin", "chao", "toi", "ban", "minh", "giup", "nhiem", "viec", "ngay",
                "hom", "mai", "tuan", "uu", "xoa", "ghim", "khong", "co",
                "ă", "â", "đ", "ê", "ô", "ơ", "ư"
            };

            return vietnameseMarkers.Any(lower.Contains) ? "vi" : "en";
        }

        private static string LocalizeStaticReply(string reply, string locale)
        {
            if (locale != "vi")
            {
                return reply;
            }

            return reply switch
            {
                "Hello! I'm your AI assistant for Taskify. I can help you manage tasks, analyze your productivity, and answer questions about your projects."
                    => "Xin chào! Tôi là trợ lý AI của Taskify. Tôi có thể giúp bạn quản lý task, theo dõi tiến độ và trả lời các câu hỏi về công việc của bạn.",
                "How can I help you today? You can ask about overdue tasks, get a weekly summary, prioritize work, or create a new task."
                    => "Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi về task quá hạn, tóm tắt tuần, sắp xếp ưu tiên hoặc tạo task mới.",
                "Goodbye! Feel free to come back when you need help with your tasks."
                    => "Tạm biệt! Khi cần hỗ trợ về task, bạn cứ quay lại nhé.",
                "I'm not sure how to help with that. Try asking about your tasks, a weekly summary, or creating a new task."
                    => "Mình chưa chắc có thể giúp với yêu cầu đó. Bạn hãy thử hỏi về task, tóm tắt tuần hoặc tạo task mới.",
                "What would you like to name this task?"
                    => "Bạn muốn đặt tên task này là gì?",
                "Cancelled task creation."
                    => "Đã hủy tạo task.",
                "Which task should I delete? Please give the title."
                    => "Bạn muốn xóa task nào? Hãy cho mình tên task.",
                _ => reply,
            };
        }
    }
}
