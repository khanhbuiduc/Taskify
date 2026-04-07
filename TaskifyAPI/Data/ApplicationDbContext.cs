using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TaskifyAPI.Model;

namespace TaskifyAPI.Data
{
    /// <summary>
    /// Application database context for Entity Framework Core with Identity support
    /// </summary>
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        /// <summary>
        /// DbSet for TaskItem entities
        /// </summary>
        public DbSet<TaskItem> TaskItems { get; set; }

        /// <summary>
        /// DbSet for Label entities
        /// </summary>
        public DbSet<Label> Labels { get; set; }

        /// <summary>
        /// DbSet for FocusSession entities
        /// </summary>
        public DbSet<FocusSession> FocusSessions { get; set; }

        /// <summary>
        /// DbSet for DailyGoal entities
        /// </summary>
        public DbSet<DailyGoal> DailyGoals { get; set; }

        /// <summary>
        /// DbSet for chat sessions (per user)
        /// </summary>
        public DbSet<ChatSession> ChatSessions { get; set; }

        /// <summary>
        /// DbSet for chat messages (per session)
        /// </summary>
        public DbSet<ChatMessage> ChatMessages { get; set; }

        /// <summary>
        /// DbSet for user notes
        /// </summary>
        public DbSet<Note> Notes { get; set; }

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

                entity.Property(e => e.UserId)
                    .IsRequired()
                    .HasMaxLength(450);

                // Configure relationship with IdentityUser
                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure Label entity
            modelBuilder.Entity<Label>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Name)
                    .IsRequired()
                    .HasMaxLength(60);

                entity.Property(e => e.Color)
                    .IsRequired()
                    .HasMaxLength(20);

                entity.Property(e => e.UserId)
                    .IsRequired()
                    .HasMaxLength(450);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETUTCDATE()");

                entity.HasIndex(e => new { e.UserId, e.Name }).IsUnique();

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure many-to-many TaskItem <-> Label
            modelBuilder.Entity<TaskItem>()
                .HasMany(t => t.Labels)
                .WithMany(l => l.Tasks)
                .UsingEntity<Dictionary<string, object>>(
                    "TaskItemLabels",
                    j => j
                        .HasOne<Label>()
                        .WithMany()
                        .HasForeignKey("LabelId")
                        .OnDelete(DeleteBehavior.Cascade),
                    j => j
                        .HasOne<TaskItem>()
                        .WithMany()
                        .HasForeignKey("TaskItemId")
                        .OnDelete(DeleteBehavior.Cascade),
                    j =>
                    {
                        j.HasKey("TaskItemId", "LabelId");
                        j.HasIndex("LabelId");
                    });

            // Configure FocusSession entity
            modelBuilder.Entity<FocusSession>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.DurationMinutes)
                    .IsRequired();

                entity.Property(e => e.StartedAt)
                    .IsRequired();

                entity.Property(e => e.UserId)
                    .IsRequired()
                    .HasMaxLength(450);

                // Configure relationship with IdentityUser
                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure DailyGoal entity
            modelBuilder.Entity<DailyGoal>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Title)
                    .IsRequired()
                    .HasMaxLength(500);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETUTCDATE()");

                entity.Property(e => e.UserId)
                    .IsRequired()
                    .HasMaxLength(450);

                // Configure relationship with IdentityUser
                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure ChatSession entity
            modelBuilder.Entity<ChatSession>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Title)
                    .IsRequired()
                    .HasMaxLength(120);

                entity.Property(e => e.UserId)
                    .IsRequired()
                    .HasMaxLength(450);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETUTCDATE()");

                entity.Property(e => e.UpdatedAt)
                    .HasDefaultValueSql("GETUTCDATE()");

                entity.HasIndex(e => new { e.UserId, e.UpdatedAt });

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure ChatMessage entity
            modelBuilder.Entity<ChatMessage>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Text)
                    .IsRequired()
                    .HasMaxLength(4000);

                entity.Property(e => e.Role)
                    .IsRequired();

                entity.Property(e => e.SentAt)
                    .HasDefaultValueSql("GETUTCDATE()");

                entity.Property(e => e.RasaMessageId)
                    .HasMaxLength(200);

                entity.HasIndex(e => new { e.SessionId, e.SentAt });

                entity.HasOne(e => e.Session)
                    .WithMany(s => s.Messages)
                    .HasForeignKey(e => e.SessionId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure Note entity
            modelBuilder.Entity<Note>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Title)
                    .IsRequired()
                    .HasMaxLength(200);

                entity.Property(e => e.Content)
                    .HasMaxLength(4000);

                entity.Property(e => e.IsPinned)
                    .IsRequired()
                    .HasDefaultValue(false);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETUTCDATE()");

                entity.Property(e => e.UpdatedAt)
                    .HasDefaultValueSql("GETUTCDATE()");

                entity.Property(e => e.UserId)
                    .IsRequired()
                    .HasMaxLength(450);

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                // Sort helpers
                entity.HasIndex(e => new { e.UserId, e.IsPinned, e.UpdatedAt });
                entity.HasIndex(e => new { e.UserId, e.Title });
            });

            // Seed roles with deterministic IDs to avoid duplicate inserts on migrations
            const string adminRoleId = "bfb1eb83-6140-44a3-8e52-6bab400f7085";
            const string userRoleId = "cf187569-1e10-4881-a7fc-4aedae86c37a";

            modelBuilder.Entity<IdentityRole>().HasData(
                new IdentityRole
                {
                    Id = adminRoleId,
                    Name = "Admin",
                    NormalizedName = "ADMIN"
                },
                new IdentityRole
                {
                    Id = userRoleId,
                    Name = "User",
                    NormalizedName = "USER"
                }
            );

            // Seed admin user with fixed ID/hash to keep snapshots stable
            const string adminUserId = "26555ba2-5071-4baf-8447-e6bbb2a12fbf";
            modelBuilder.Entity<ApplicationUser>().HasData(
                new ApplicationUser
                {
                    Id = adminUserId,
                    UserName = "Admin User",
                    NormalizedUserName = "ADMIN USER",
                    Email = "admin@taskify.com",
                    NormalizedEmail = "ADMIN@TASKIFY.COM",
                    EmailConfirmed = true,
                    PasswordHash = "AQAAAAIAAYagAAAAEAahbrgm09MbJaxI88eiPOhDTEFGKc2baTBdfvEPUA6rWnnMu3w0zxKFq8ONeNl0fA==",
                    SecurityStamp = "a340e891-0382-490e-b8af-185feacf2cc9",
                    ConcurrencyStamp = "d110a0c9-495c-4b7c-b03d-32a65bfa2417",
                    AvatarUrl = null,
                    PhoneNumberConfirmed = false,
                    TwoFactorEnabled = false,
                    LockoutEnabled = false,
                    AccessFailedCount = 0
                }
            );

            // Assign admin role to admin user
            modelBuilder.Entity<IdentityUserRole<string>>().HasData(
                new IdentityUserRole<string>
                {
                    UserId = adminUserId,
                    RoleId = adminRoleId
                }
            );

            // Note: Seed data for TaskItems will be removed as they need UserId

        }
    }
}
