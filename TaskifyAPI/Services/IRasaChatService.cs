namespace TaskifyAPI.Services
{
    /// <summary>
    /// Proxies chat messages to Rasa and returns assistant replies.
    /// </summary>
    public interface IRasaChatService
    {
        /// <summary>
        /// Sends user message to Rasa webhook and returns list of assistant text replies.
        /// </summary>
        /// <param name="userId">Sender ID (e.g. current user ID) for conversation tracking.</param>
        /// <param name="messageText">User message text.</param>
        /// <param name="cancellationToken">Cancellation token.</param>
        /// <returns>List of assistant message texts. On Rasa failure, returns a single friendly error message.</returns>
        Task<IReadOnlyList<string>> SendMessageAsync(string userId, string messageText, CancellationToken cancellationToken = default);
    }
}
