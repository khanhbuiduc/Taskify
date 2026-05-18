namespace TaskifyAPI.Services
{
    internal static class AiFallbackPromptBuilder
    {
        public static string BuildPrompt(string userText, string locale)
        {
            if (locale.StartsWith("vi", StringComparison.OrdinalIgnoreCase))
            {
                return
                    "Bạn là trợ lý của Taskify. Câu nói của người dùng nằm ngoài những ý định mà bot được lập trình sẵn.\n"
                    + "Hãy trả lời bằng tiếng Việt, đầy đủ ý, dễ hiểu trong 2-4 câu hoàn chỉnh.\n"
                    + "Không được trả lời dở dang, không kết thúc bằng dấu mở ngoặc hoặc câu chưa tròn nghĩa.\n"
                    + "Nếu phù hợp, hãy thêm một câu gợi ý quay lại chức năng của Taskify (tạo task, lọc task, tóm tắt tuần).\n"
                    + $"Câu của người dùng: {userText}";
            }

            return
                "You are Taskify assistant. The user's message is out of current bot intents.\n"
                + "Reply clearly in 2-4 complete sentences and do not end mid-sentence.\n"
                + "If relevant, suggest Taskify features: create task, filter tasks, weekly summary.\n"
                + $"User message: {userText}";
        }

        public static string BuildRetryPrompt(string prompt, string locale)
        {
            return locale.StartsWith("vi", StringComparison.OrdinalIgnoreCase)
                ? $"{prompt}\n\nTrả lời lại đầy đủ hơn và bắt buộc kết thúc bằng một câu hoàn chỉnh."
                : $"{prompt}\n\nReply again more completely and end with a complete sentence.";
        }

        public static bool LooksTruncated(string text)
        {
            if (string.IsNullOrWhiteSpace(text) || text.Trim().Length < 24)
            {
                return true;
            }

            return text.TrimEnd().EndsWith('(')
                || text.TrimEnd().EndsWith('[')
                || text.TrimEnd().EndsWith('{')
                || text.TrimEnd().EndsWith(':')
                || text.TrimEnd().EndsWith('-')
                || text.TrimEnd().EndsWith(',');
        }
    }
}
