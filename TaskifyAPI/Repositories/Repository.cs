using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using TaskifyAPI.Data;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Repositories
{
    /// <summary>
    /// Generic repository implementation for common CRUD operations
    /// </summary>
    /// <typeparam name="T">Entity type</typeparam>
    public class Repository<T> : IRepository<T> where T : class
    {
        protected readonly ApplicationDbContext _context;
        protected readonly DbSet<T> _dbSet;

        public Repository(ApplicationDbContext context)
        {
            _context = context;
            _dbSet = context.Set<T>();
        }

        /// <inheritdoc />
        public async Task<IEnumerable<T>> GetAllAsync()
        {
            return await _dbSet.ToListAsync();
        }

        /// <inheritdoc />
        public async Task<T?> GetByIdAsync(int id)
        {
            return await _dbSet.FindAsync(id);
        }

        /// <inheritdoc />
        public async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate)
        {
            return await _dbSet.Where(predicate).ToListAsync();
        }

        /// <inheritdoc />
        public async Task AddAsync(T entity)
        {
            await _dbSet.AddAsync(entity);
        }

        /// <inheritdoc />
        public void Update(T entity)
        {
            _dbSet.Update(entity);
        }

        /// <inheritdoc />
        public void Remove(T entity)
        {
            _dbSet.Remove(entity);
        }

        /// <inheritdoc />
        public async Task<bool> AnyAsync(Expression<Func<T, bool>> predicate)
        {
            return await _dbSet.AnyAsync(predicate);
        }
    }
}
