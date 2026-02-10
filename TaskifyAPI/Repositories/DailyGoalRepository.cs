using Microsoft.EntityFrameworkCore;
using TaskifyAPI.Data;
using TaskifyAPI.Model;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Repositories
{
    /// <summary>
    /// DailyGoal-specific repository implementation
    /// </summary>
    public class DailyGoalRepository : Repository<DailyGoal>, IDailyGoalRepository
    {
        public DailyGoalRepository(ApplicationDbContext context) : base(context)
        {
        }

        /// <inheritdoc />
        public async Task<IEnumerable<DailyGoal>> GetByUserIdAsync(string userId)
        {
            return await _dbSet
                .Where(g => g.UserId == userId)
                .OrderByDescending(g => g.CreatedAt)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<DailyGoal>> GetByUserIdAndDateAsync(string userId, DateTime date)
        {
            var startOfDay = date.Date;
            var endOfDay = startOfDay.AddDays(1);

            return await _dbSet
                .Where(g => g.UserId == userId && g.CreatedAt >= startOfDay && g.CreatedAt < endOfDay)
                .OrderBy(g => g.CreatedAt)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<DailyGoal>> GetTodayGoalsByUserIdAsync(string userId)
        {
            var today = DateTime.UtcNow.Date;
            var tomorrow = today.AddDays(1);

            return await _dbSet
                .Where(g => g.UserId == userId && g.CreatedAt >= today && g.CreatedAt < tomorrow)
                .OrderBy(g => g.CreatedAt)
                .ToListAsync();
        }
    }
}
