using TaskifyAPI.Model;

namespace TaskifyAPI.Repositories.IRepositories
{
    public interface IFinanceEntryRepository : IRepository<FinanceEntry>
    {
        Task<IEnumerable<FinanceEntry>> GetByUserAsync(
            string userId,
            DateTime? from,
            DateTime? to,
            string? category,
            string? search,
            int page,
            int pageSize);

        Task<FinanceEntry?> GetByUserAndIdAsync(string userId, int id);
        Task<bool> IsCategoryUsedAsync(string userId, string categoryName);
        Task RenameCategoryAsync(string userId, string oldCategoryName, string newCategoryName);
        Task<(decimal totalAmount, int count, List<(DateTime date, decimal totalAmount)> dailyTotals)> GetSummaryAsync(
            string userId,
            DateTime? from,
            DateTime? to,
            string? category);
    }
}
