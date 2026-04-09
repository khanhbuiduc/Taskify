using TaskifyAPI.Model;

namespace TaskifyAPI.Repositories.IRepositories
{
    public interface IFinanceCategoryRepository : IRepository<FinanceCategory>
    {
        Task<IEnumerable<FinanceCategory>> GetByUserAsync(string userId);
        Task<FinanceCategory?> GetByUserAndIdAsync(string userId, int id);
        Task<FinanceCategory?> GetByUserAndNameAsync(string userId, string name);
    }
}
