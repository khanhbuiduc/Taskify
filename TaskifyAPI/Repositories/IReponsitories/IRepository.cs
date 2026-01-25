using System.Linq.Expressions;

namespace TaskifyAPI.Repositories.IRepositories
{
    /// <summary>
    /// Generic repository interface for common CRUD operations
    /// </summary>
    /// <typeparam name="T">Entity type</typeparam>
    public interface IRepository<T> where T : class
    {
        /// <summary>
        /// Get all entities
        /// </summary>
        Task<IEnumerable<T>> GetAllAsync();

        /// <summary>
        /// Get entity by id
        /// </summary>
        Task<T?> GetByIdAsync(int id);

        /// <summary>
        /// Find entities matching a predicate
        /// </summary>
        Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate);

        /// <summary>
        /// Add a new entity
        /// </summary>
        Task AddAsync(T entity);

        /// <summary>
        /// Update an existing entity
        /// </summary>
        void Update(T entity);

        /// <summary>
        /// Remove an entity
        /// </summary>
        void Remove(T entity);

        /// <summary>
        /// Check if any entity matches the predicate
        /// </summary>
        Task<bool> AnyAsync(Expression<Func<T, bool>> predicate);
    }
}
