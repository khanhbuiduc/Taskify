using TaskifyAPI.Model;

namespace TaskifyAPI.Repositories.IRepositories
{
    /// <summary>
    /// Repository contract for Notes.
    /// </summary>
    public interface INoteRepository : IRepository<Note>
    {
        Task<IEnumerable<Note>> GetByUserAsync(string userId, bool? isPinned, int page, int pageSize);
        Task<IEnumerable<Note>> SearchAsync(string userId, string keyword, int page, int pageSize, bool? isPinned);
        Task<IEnumerable<Note>> GetRecentAsync(string userId, int limit);
        Task TogglePinAsync(Note note, bool? isPinned = null);
    }
}
