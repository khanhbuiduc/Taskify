using Microsoft.EntityFrameworkCore;
using TaskifyAPI.Data;
using TaskifyAPI.Model;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Repositories
{
    /// <summary>
    /// Repository for labels
    /// </summary>
    public class LabelRepository : Repository<Label>, ILabelRepository
    {
        public LabelRepository(ApplicationDbContext context) : base(context)
        {
        }

        public async Task<IEnumerable<Label>> GetByUserAsync(string userId)
        {
            return await _dbSet
                .Where(l => l.UserId == userId)
                .OrderBy(l => l.Name)
                .ToListAsync();
        }

        public async Task<IEnumerable<Label>> GetByIdsForUserAsync(string userId, IEnumerable<int> ids)
        {
            var idList = ids.ToList();
            return await _dbSet
                .Where(l => l.UserId == userId && idList.Contains(l.Id))
                .ToListAsync();
        }

        public async Task<bool> NameExistsAsync(string userId, string name, int? excludeId = null)
        {
            var query = _dbSet.Where(l => l.UserId == userId && l.Name == name);
            if (excludeId.HasValue)
            {
                query = query.Where(l => l.Id != excludeId.Value);
            }
            return await query.AnyAsync();
        }
    }
}
