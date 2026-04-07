using Microsoft.EntityFrameworkCore;
using TaskifyAPI.Data;
using TaskifyAPI.Model;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Repositories
{
    /// <summary>
    /// Note repository implementation.
    /// </summary>
    public class NoteRepository : Repository<Note>, INoteRepository
    {
        public NoteRepository(ApplicationDbContext context) : base(context)
        {
        }

        /// <inheritdoc />
        public async Task<IEnumerable<Note>> GetByUserAsync(string userId, bool? isPinned, int page, int pageSize)
        {
            var query = _dbSet.Where(n => n.UserId == userId);
            if (isPinned.HasValue)
            {
                query = query.Where(n => n.IsPinned == isPinned.Value);
            }

            return await query
                .OrderByDescending(n => n.IsPinned)
                .ThenByDescending(n => n.UpdatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<Note>> SearchAsync(string userId, string keyword, int page, int pageSize, bool? isPinned)
        {
            var lowered = keyword.ToLower();
            var query = _dbSet.Where(n => n.UserId == userId &&
                ((n.Title ?? string.Empty).ToLower().Contains(lowered) || (n.Content ?? string.Empty).ToLower().Contains(lowered)));

            if (isPinned.HasValue)
            {
                query = query.Where(n => n.IsPinned == isPinned.Value);
            }

            return await query
                .OrderByDescending(n => n.IsPinned)
                .ThenByDescending(n => n.UpdatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<Note>> GetRecentAsync(string userId, int limit)
        {
            return await _dbSet
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.UpdatedAt)
                .Take(limit)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task TogglePinAsync(Note note, bool? isPinned = null)
        {
            note.IsPinned = isPinned ?? !note.IsPinned;
            note.UpdatedAt = DateTime.UtcNow;
            _dbSet.Update(note);
            await Task.CompletedTask;
        }
    }
}
