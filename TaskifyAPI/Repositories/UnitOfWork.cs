using Microsoft.EntityFrameworkCore.Storage;
using TaskifyAPI.Data;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Repositories
{
    /// <summary>
    /// Unit of Work implementation for managing transactions and repositories
    /// </summary>
    public class UnitOfWork : IUnitOfWork
    {
        private readonly ApplicationDbContext _context;
        private IDbContextTransaction? _transaction;
        private ITaskRepository? _taskRepository;
        private IFocusSessionRepository? _focusSessionRepository;
        private IDailyGoalRepository? _dailyGoalRepository;
        private bool _disposed = false;

        public UnitOfWork(ApplicationDbContext context)
        {
            _context = context;
        }

        /// <inheritdoc />
        public ITaskRepository Tasks
        {
            get
            {
                _taskRepository ??= new TaskRepository(_context);
                return _taskRepository;
            }
        }

        /// <inheritdoc />
        public IFocusSessionRepository FocusSessions
        {
            get
            {
                _focusSessionRepository ??= new FocusSessionRepository(_context);
                return _focusSessionRepository;
            }
        }

        /// <inheritdoc />
        public IDailyGoalRepository DailyGoals
        {
            get
            {
                _dailyGoalRepository ??= new DailyGoalRepository(_context);
                return _dailyGoalRepository;
            }
        }

        /// <inheritdoc />
        public async Task<int> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync();
        }

        /// <inheritdoc />
        public async Task BeginTransactionAsync()
        {
            _transaction = await _context.Database.BeginTransactionAsync();
        }

        /// <inheritdoc />
        public async Task CommitTransactionAsync()
        {
            if (_transaction != null)
            {
                await _transaction.CommitAsync();
                await _transaction.DisposeAsync();
                _transaction = null;
            }
        }

        /// <inheritdoc />
        public async Task RollbackTransactionAsync()
        {
            if (_transaction != null)
            {
                await _transaction.RollbackAsync();
                await _transaction.DisposeAsync();
                _transaction = null;
            }
        }

        protected virtual void Dispose(bool disposing)
        {
            if (!_disposed)
            {
                if (disposing)
                {
                    _transaction?.Dispose();
                    _context.Dispose();
                }
                _disposed = true;
            }
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }
    }
}
