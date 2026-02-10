using TaskifyAPI.Model;

namespace TaskifyAPI.Repositories.IRepositories
{
    /// <summary>
    /// DailyGoal-specific repository interface extending generic repository
    /// </summary>
    public interface IDailyGoalRepository : IRepository<DailyGoal>
    {
        /// <summary>
        /// Get all goals for a user
        /// </summary>
        Task<IEnumerable<DailyGoal>> GetByUserIdAsync(string userId);

        /// <summary>
        /// Get goals for a user on a specific date
        /// </summary>
        Task<IEnumerable<DailyGoal>> GetByUserIdAndDateAsync(string userId, DateTime date);

        /// <summary>
        /// Get today's goals for a user
        /// </summary>
        Task<IEnumerable<DailyGoal>> GetTodayGoalsByUserIdAsync(string userId);
    }
}
