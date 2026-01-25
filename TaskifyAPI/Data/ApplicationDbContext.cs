using Microsoft.EntityFrameworkCore;
using TaskifyAPI.Model;

namespace TaskifyAPI.Data
{
    /// <summary>
    /// Application database context for Entity Framework Core
    /// </summary>
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) 
            : base(options)
        {
        }

        /// <summary>
        /// DbSet for TaskItem entities
        /// </summary>
        public DbSet<TaskItem> TaskItems { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure TaskItem entity
            modelBuilder.Entity<TaskItem>(entity =>
            {
                entity.HasKey(e => e.Id);
                
                entity.Property(e => e.Title)
                    .IsRequired()
                    .HasMaxLength(200);

                entity.Property(e => e.Description)
                    .HasMaxLength(1000);

                entity.Property(e => e.Priority)
                    .IsRequired();

                entity.Property(e => e.Status)
                    .IsRequired();

                entity.Property(e => e.DueDate)
                    .IsRequired();

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETUTCDATE()");
            });

            // Seed initial data matching frontend sample tasks
            modelBuilder.Entity<TaskItem>().HasData(
                new TaskItem
                {
                    Id = 1,
                    Title = "Design system documentation",
                    Description = "Create comprehensive documentation for the design system components",
                    Priority = TaskPriority.High,
                    Status = TaskItemStatus.InProgress,
                    DueDate = new DateTime(2026, 1, 25),
                    CreatedAt = new DateTime(2026, 1, 15)
                },
                new TaskItem
                {
                    Id = 2,
                    Title = "User authentication flow",
                    Description = "Implement OAuth 2.0 authentication with Google and GitHub providers",
                    Priority = TaskPriority.High,
                    Status = TaskItemStatus.Todo,
                    DueDate = new DateTime(2026, 1, 23),
                    CreatedAt = new DateTime(2026, 1, 14)
                },
                new TaskItem
                {
                    Id = 3,
                    Title = "API endpoint testing",
                    Description = "Write unit tests for all REST API endpoints",
                    Priority = TaskPriority.Medium,
                    Status = TaskItemStatus.Completed,
                    DueDate = new DateTime(2026, 1, 20),
                    CreatedAt = new DateTime(2026, 1, 10)
                },
                new TaskItem
                {
                    Id = 4,
                    Title = "Mobile responsive design",
                    Description = "Ensure all pages are fully responsive on mobile devices",
                    Priority = TaskPriority.Medium,
                    Status = TaskItemStatus.InProgress,
                    DueDate = new DateTime(2026, 1, 28),
                    CreatedAt = new DateTime(2026, 1, 12)
                },
                new TaskItem
                {
                    Id = 5,
                    Title = "Database optimization",
                    Description = "Optimize database queries and add proper indexing",
                    Priority = TaskPriority.Low,
                    Status = TaskItemStatus.Todo,
                    DueDate = new DateTime(2026, 1, 30),
                    CreatedAt = new DateTime(2026, 1, 18)
                },
                new TaskItem
                {
                    Id = 6,
                    Title = "Code review meeting",
                    Description = "Review pull requests and discuss code quality improvements",
                    Priority = TaskPriority.Low,
                    Status = TaskItemStatus.Completed,
                    DueDate = new DateTime(2026, 1, 19),
                    CreatedAt = new DateTime(2026, 1, 16)
                },
                new TaskItem
                {
                    Id = 7,
                    Title = "Performance monitoring setup",
                    Description = "Configure application performance monitoring with alerts",
                    Priority = TaskPriority.Medium,
                    Status = TaskItemStatus.Todo,
                    DueDate = new DateTime(2026, 1, 26),
                    CreatedAt = new DateTime(2026, 1, 17)
                },
                new TaskItem
                {
                    Id = 8,
                    Title = "User feedback analysis",
                    Description = "Analyze user feedback and prioritize feature requests",
                    Priority = TaskPriority.High,
                    Status = TaskItemStatus.Todo,
                    DueDate = new DateTime(2026, 1, 22),
                    CreatedAt = new DateTime(2026, 1, 13)
                }
            );
        }
    }
}
