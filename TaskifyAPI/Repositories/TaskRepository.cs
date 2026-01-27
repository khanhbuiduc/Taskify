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
                .Where(t => t.Status == status)
                .OrderBy(t => t.DueDate)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<TaskItem>> GetByPriorityAsync(TaskPriority priority)
        {
            return await _dbSet
                .Where(t => t.Priority == priority)
                .OrderBy(t => t.DueDate)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<TaskItem>> GetOverdueTasksAsync(DateTime date)
        {
            return await _dbSet
                .Where(t => t.DueDate < date && t.Status != TaskItemStatus.Completed)
                .OrderBy(t => t.DueDate)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<TaskItem>> GetAllOrderedByDueDateAsync()
        {
            return await _dbSet
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
                query = query.Where(t => t.UserId == userId);
            }

            return await query
                .OrderBy(t => t.DueDate)
                .ToListAsync();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<TaskItem>> GetByUserIdAsync(string userId)
        {
            return await _dbSet
                .Where(t => t.UserId == userId)
                .OrderBy(t => t.DueDate)
                .ToListAsync();
        }
    }
}
