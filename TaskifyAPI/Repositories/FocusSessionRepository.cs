using Microsoft.EntityFrameworkCore;
using TaskifyAPI.Data;
using TaskifyAPI.Model;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Repositories
{
    /// <summary>
    /// FocusSession-specific repository implementation
    /// </summary>
    public class FocusSessionRepository : Repository<FocusSession>, IFocusSessionRepository
    {
        public FocusSessionRepository(ApplicationDbContext context) : base(context)
        {
        }

        /// <inheritdoc />
        public async Task<IEnumerable<FocusSession>> GetByUserIdAsync(string userId)
        {
            return await _dbSet
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.StartedAt)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<FocusSession>> GetByUserIdAndDateAsync(string userId, DateTime date)
        {
            var startOfDay = date.Date;
            var endOfDay = startOfDay.AddDays(1);

            return await _dbSet
                .Where(s => s.UserId == userId && s.StartedAt >= startOfDay && s.StartedAt < endOfDay)
                .OrderByDescending(s => s.StartedAt)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<FocusSession>> GetByUserIdAndDateRangeAsync(string userId, DateTime startDate, DateTime endDate)
        {
            return await _dbSet
                .Where(s => s.UserId == userId && s.StartedAt >= startDate && s.StartedAt < endDate)
                .OrderByDescending(s => s.StartedAt)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<FocusSession?> GetLatestByUserIdAsync(string userId)
        {
            return await _dbSet
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.StartedAt)
                .FirstOrDefaultAsync();
        }
    }
}
