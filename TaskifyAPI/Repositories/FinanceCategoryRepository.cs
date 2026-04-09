using Microsoft.EntityFrameworkCore;
using TaskifyAPI.Data;
using TaskifyAPI.Model;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Repositories
{
    public class FinanceCategoryRepository : Repository<FinanceCategory>, IFinanceCategoryRepository
    {
        public FinanceCategoryRepository(ApplicationDbContext context) : base(context)
        {
        }

        public async Task<IEnumerable<FinanceCategory>> GetByUserAsync(string userId)
        {
            return await _dbSet
                .Where(c => c.UserId == userId)
                .OrderBy(c => c.Name)
                .ToListAsync();
        }

        public async Task<FinanceCategory?> GetByUserAndIdAsync(string userId, int id)
        {
            return await _dbSet.FirstOrDefaultAsync(c => c.UserId == userId && c.Id == id);
        }

        public async Task<FinanceCategory?> GetByUserAndNameAsync(string userId, string name)
        {
            var normalized = name.Trim().ToLower();
            return await _dbSet.FirstOrDefaultAsync(c =>
                c.UserId == userId && c.Name.ToLower() == normalized);
        }
    }
}
