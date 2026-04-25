using Microsoft.EntityFrameworkCore;
using TaskifyAPI.Data;
using TaskifyAPI.Model;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Repositories
{
    /// <summary>
    /// Task-specific repository implementation
    /// </summary>
    public class TaskRepository : Repository<TaskItem>, ITaskRepository
    {
        public TaskRepository(ApplicationDbContext context) : base(context)
        {
        }

        /// <inheritdoc />
        public async Task<IEnumerable<TaskItem>> GetByStatusAsync(TaskItemStatus status)
        {
            return await _dbSet
                .Where(t => t.Status == status && !t.IsDeleted)
                .OrderBy(t => t.DueDate)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<TaskItem>> GetByPriorityAsync(TaskPriority priority)
        {
            return await _dbSet
                .Where(t => t.Priority == priority && !t.IsDeleted)
                .OrderBy(t => t.DueDate)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<TaskItem>> GetOverdueTasksAsync(DateTime date)
        {
            return await _dbSet
                .Where(t => t.DueDate < date && t.Status != TaskItemStatus.Completed && !t.IsDeleted)
                .OrderBy(t => t.DueDate)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<TaskItem>> GetAllOrderedByDueDateAsync()
        {
            return await _dbSet
                .Where(t => !t.IsDeleted)
                .Include(t => t.Labels)
                .OrderBy(t => t.DueDate)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<TaskItem>> GetAllOrderedByDueDateAsync(string? userId)
        {
            var query = _dbSet.AsQueryable();

            // If userId is provided, filter by it
            if (!string.IsNullOrEmpty(userId))
            {
                query = query.Where(t => t.UserId == userId && !t.IsDeleted);
            }
            else
            {
                query = query.Where(t => !t.IsDeleted);
            }

            return await query
                .Include(t => t.Labels)
                .OrderBy(t => t.DueDate)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<TaskItem>> GetByUserIdAsync(string userId)
        {
            return await _dbSet
                .Where(t => t.UserId == userId && !t.IsDeleted)
                .Include(t => t.Labels)
                .OrderBy(t => t.DueDate)
                .ToListAsync();
        }

        /// <summary>
        /// Get task by id with labels
        /// </summary>
        public async Task<TaskItem?> GetByIdWithLabelsAsync(int id)
        {
            return await _dbSet
                .Include(t => t.Labels)
                .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
        }

        /// <inheritdoc />
        public async Task<IEnumerable<TaskItem>> GetFilteredOrderedByDueDateAsync(
            string? userId,
            string? search,
            TaskItemStatus? status,
            TaskPriority? priority,
            int? labelId,
            DateTime? dueFrom,
            DateTime? dueTo)
        {
            return await BuildFilteredQuery(userId, search, status, priority, labelId, dueFrom, dueTo)
                .OrderBy(t => t.DueDate)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<(IEnumerable<TaskItem> Items, int TotalCount)> GetFilteredPagedOrderedByDueDateAsync(
            string? userId,
            string? search,
            TaskItemStatus? status,
            TaskPriority? priority,
            int? labelId,
            DateTime? dueFrom,
            DateTime? dueTo,
            int page,
            int pageSize)
        {
            var query = BuildFilteredQuery(userId, search, status, priority, labelId, dueFrom, dueTo);

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderBy(t => t.DueDate)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, totalCount);
        }

        private IQueryable<TaskItem> BuildFilteredQuery(
            string? userId,
            string? search,
            TaskItemStatus? status,
            TaskPriority? priority,
            int? labelId,
            DateTime? dueFrom,
            DateTime? dueTo)
        {
            var query = _dbSet
                .Where(t => !t.IsDeleted)
                .Include(t => t.Labels)
                .AsQueryable();

            if (!string.IsNullOrEmpty(userId))
            {
                query = query.Where(t => t.UserId == userId);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchTerm = search.Trim();
                query = query.Where(t =>
                    t.Title.Contains(searchTerm) ||
                    t.Description.Contains(searchTerm));
            }

            if (status.HasValue)
            {
                query = query.Where(t => t.Status == status.Value);
            }

            if (priority.HasValue)
            {
                query = query.Where(t => t.Priority == priority.Value);
            }

            if (labelId.HasValue)
            {
                query = query.Where(t => t.Labels.Any(l => l.Id == labelId.Value));
            }

            if (dueFrom.HasValue)
            {
                query = query.Where(t => t.DueDate >= dueFrom.Value);
            }

            if (dueTo.HasValue)
            {
                query = query.Where(t => t.DueDate <= dueTo.Value);
            }

            return query;
        }
    }
}
