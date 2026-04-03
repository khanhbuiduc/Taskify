using TaskifyAPI.Model;

namespace TaskifyAPI.Repositories.IRepositories
{
    /// <summary>
    /// Repository for label operations
    /// </summary>
    public interface ILabelRepository : IRepository<Label>
    {
        Task<IEnumerable<Label>> GetByUserAsync(string userId);
        Task<IEnumerable<Label>> GetByIdsForUserAsync(string userId, IEnumerable<int> ids);
        Task<bool> NameExistsAsync(string userId, string name, int? excludeId = null);
    }
}
