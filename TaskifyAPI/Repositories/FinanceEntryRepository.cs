using Microsoft.EntityFrameworkCore;
using TaskifyAPI.Data;
using TaskifyAPI.Model;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Repositories
{
    public class FinanceEntryRepository : Repository<FinanceEntry>, IFinanceEntryRepository
    {
        public FinanceEntryRepository(ApplicationDbContext context) : base(context)
        {
        }

        public async Task<IEnumerable<FinanceEntry>> GetByUserAsync(
            string userId,
            DateTime? from,
            DateTime? to,
            string? category,
            string? search,
            int page,
            int pageSize)
        {
            var query = ApplyFilters(_dbSet.Where(e => e.UserId == userId), from, to, category, search);
            return await query
                .OrderByDescending(e => e.Date)
                .ThenByDescending(e => e.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        public async Task<FinanceEntry?> GetByUserAndIdAsync(string userId, int id)
        {
            return await _dbSet.FirstOrDefaultAsync(e => e.UserId == userId && e.Id == id);
        }

        public async Task<bool> IsCategoryUsedAsync(string userId, string categoryName)
        {
            return await _dbSet.AnyAsync(e => e.UserId == userId && e.Category == categoryName);
        }

        public async Task RenameCategoryAsync(string userId, string oldCategoryName, string newCategoryName)
        {
            var items = await _dbSet
                .Where(e => e.UserId == userId && e.Category == oldCategoryName)
                .ToListAsync();

            foreach (var item in items)
            {
                item.Category = newCategoryName;
                item.UpdatedAt = DateTime.UtcNow;
            }
        }

        public async Task<(decimal totalAmount, int count, List<(DateTime date, decimal totalAmount)> dailyTotals)> GetSummaryAsync(
            string userId,
            DateTime? from,
            DateTime? to,
            string? category)
        {
            var query = ApplyFilters(_dbSet.Where(e => e.UserId == userId), from, to, category, null);

            var aggregate = await query
                .GroupBy(_ => 1)
                .Select(g => new
                {
                    Total = g.Sum(x => x.Amount),
                    Count = g.Count()
                })
                .FirstOrDefaultAsync();

            var daily = await query
                .GroupBy(x => x.Date.Date)
                .Select(g => new
                {
                    Date = g.Key,
                    Total = g.Sum(x => x.Amount)
                })
                .OrderBy(g => g.Date)
                .ToListAsync();

            return (
                aggregate?.Total ?? 0m,
                aggregate?.Count ?? 0,
                daily.Select(d => (d.Date, d.Total)).ToList());
        }

        private static IQueryable<FinanceEntry> ApplyFilters(
            IQueryable<FinanceEntry> query,
            DateTime? from,
            DateTime? to,
            string? category,
            string? search)
        {
            if (from.HasValue)
            {
                var fromDate = from.Value.Date;
                query = query.Where(e => e.Date >= fromDate);
            }

            if (to.HasValue)
            {
                var toDateExclusive = to.Value.Date.AddDays(1);
                query = query.Where(e => e.Date < toDateExclusive);
            }

            if (!string.IsNullOrWhiteSpace(category))
            {
                query = query.Where(e => e.Category == category);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var keyword = search.Trim().ToLower();
                query = query.Where(e => (e.Description ?? string.Empty).ToLower().Contains(keyword));
            }

            return query;
        }
    }
}
