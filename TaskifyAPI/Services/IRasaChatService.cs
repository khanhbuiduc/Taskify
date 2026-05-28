namespace TaskifyAPI.Services
{
    public class RasaIntentPrediction
    {
        public string Name { get; set; } = string.Empty;
        public double Confidence { get; set; }
    }

    public class RasaParseResult
    {
        public string Text { get; set; } = string.Empty;
        public string? IntentName { get; set; }
        public double Confidence { get; set; }
        public IReadOnlyList<RasaIntentPrediction> IntentRanking { get; set; } = Array.Empty<RasaIntentPrediction>();
    }

    public class RasaAssistantReply
    {
        public string Text { get; set; } = string.Empty;
        public string? MetadataJson { get; set; }
    }

    /// <summary>
    /// Proxies chat messages to Rasa and returns assistant replies.
    /// </summary>
    public interface IRasaChatService
    {
        /// <summary>
        /// Sends user message to Rasa webhook and returns assistant replies
        /// (text + optional typed metadata payload).
        /// </summary>
        /// <param name="userId">Sender ID (e.g. current userId:sessionId) for conversation tracking.</param>
        /// <param name="messageText">User message text.</param>
        /// <param name="metadataJson">Optional metadata payload forwarded to Rasa webhook.</param>
        /// <param name="cancellationToken">Cancellation token.</param>
        /// <returns>List of assistant replies. On Rasa failure, returns one fallback text message.</returns>
        Task<IReadOnlyList<RasaAssistantReply>> SendMessageAsync(
            string userId,
            string messageText,
            string? metadataJson = null,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Parses a user message using Rasa NLU and returns top intent predictions for logging/debugging.
        /// </summary>
        Task<RasaParseResult?> ParseIntentAsync(
            string messageText,
            CancellationToken cancellationToken = default);
    }
}
