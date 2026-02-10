using TaskifyAPI.Model;

namespace TaskifyAPI.Repositories.IRepositories
{
    /// <summary>
    /// FocusSession-specific repository interface extending generic repository
    /// </summary>
    public interface IFocusSessionRepository : IRepository<FocusSession>
    {
        /// <summary>
        /// Get all sessions for a user
        /// </summary>
        Task<IEnumerable<FocusSession>> GetByUserIdAsync(string userId);

        /// <summary>
        /// Get sessions for a user on a specific date
        /// </summary>
        Task<IEnumerable<FocusSession>> GetByUserIdAndDateAsync(string userId, DateTime date);

        /// <summary>
        /// Get sessions for a user within a date range
        /// </summary>
        Task<IEnumerable<FocusSession>> GetByUserIdAndDateRangeAsync(string userId, DateTime startDate, DateTime endDate);

        /// <summary>
        /// Get the most recent session for a user
        /// </summary>
        Task<FocusSession?> GetLatestByUserIdAsync(string userId);
    }
}
