namespace TaskifyAPI.Repositories.IRepositories
{
    /// <summary>
    /// Unit of Work interface for managing transactions and repositories
    /// </summary>
    public interface IUnitOfWork : IDisposable
    {
        /// <summary>
        /// Task repository
        /// </summary>
        ITaskRepository Tasks { get; }

        /// <summary>
        /// Focus session repository
        /// </summary>
        IFocusSessionRepository FocusSessions { get; }

        /// <summary>
        /// Daily goal repository
        /// </summary>
        IDailyGoalRepository DailyGoals { get; }

        /// <summary>
        /// Save all changes to the database
        /// </summary>
        Task<int> SaveChangesAsync();

        /// <summary>
        /// Begin a new database transaction
        /// </summary>
        Task BeginTransactionAsync();

        /// <summary>
        /// Commit the current transaction
        /// </summary>
        Task CommitTransactionAsync();

        /// <summary>
        /// Rollback the current transaction
        /// </summary>
        Task RollbackTransactionAsync();
    }
}
