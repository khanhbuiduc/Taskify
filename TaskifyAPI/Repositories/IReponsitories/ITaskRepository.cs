using TaskifyAPI.Model;

namespace TaskifyAPI.Repositories.IRepositories
{
    /// <summary>
    /// Task-specific repository interface extending generic repository
    /// </summary>
    public interface ITaskRepository : IRepository<TaskItem>
    {
        /// <summary>
        /// Get tasks by status
        /// </summary>
        Task<IEnumerable<TaskItem>> GetByStatusAsync(TaskItemStatus status);

        /// <summary>
        /// Get tasks by priority
        /// </summary>
        Task<IEnumerable<TaskItem>> GetByPriorityAsync(TaskPriority priority);

        /// <summary>
        /// Get tasks due before a specific date
        /// </summary>
        Task<IEnumerable<TaskItem>> GetOverdueTasksAsync(DateTime date);

        /// <summary>
        /// Get all tasks ordered by due date
        /// </summary>
        Task<IEnumerable<TaskItem>> GetAllOrderedByDueDateAsync();

        /// <summary>
        /// Get all tasks ordered by due date, optionally filtered by user ID
        /// </summary>
        /// <param name="userId">User ID to filter by. If null, returns all tasks (for Admin)</param>
        Task<IEnumerable<TaskItem>> GetAllOrderedByDueDateAsync(string? userId);

        /// <summary>
        /// Get tasks by user ID
        /// </summary>
        /// <param name="userId">User ID</param>
        Task<IEnumerable<TaskItem>> GetByUserIdAsync(string userId);
    }
}
