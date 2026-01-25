using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace TaskifyAPI.Migrations
{
    /// <inheritdoc />
    public partial class InitialMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TaskItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Priority = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    DueDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskItems", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "TaskItems",
                columns: new[] { "Id", "CreatedAt", "Description", "DueDate", "Priority", "Status", "Title" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 1, 15, 0, 0, 0, 0, DateTimeKind.Unspecified), "Create comprehensive documentation for the design system components", new DateTime(2026, 1, 25, 0, 0, 0, 0, DateTimeKind.Unspecified), 2, 1, "Design system documentation" },
                    { 2, new DateTime(2026, 1, 14, 0, 0, 0, 0, DateTimeKind.Unspecified), "Implement OAuth 2.0 authentication with Google and GitHub providers", new DateTime(2026, 1, 23, 0, 0, 0, 0, DateTimeKind.Unspecified), 2, 0, "User authentication flow" },
                    { 3, new DateTime(2026, 1, 10, 0, 0, 0, 0, DateTimeKind.Unspecified), "Write unit tests for all REST API endpoints", new DateTime(2026, 1, 20, 0, 0, 0, 0, DateTimeKind.Unspecified), 1, 2, "API endpoint testing" },
                    { 4, new DateTime(2026, 1, 12, 0, 0, 0, 0, DateTimeKind.Unspecified), "Ensure all pages are fully responsive on mobile devices", new DateTime(2026, 1, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), 1, 1, "Mobile responsive design" },
                    { 5, new DateTime(2026, 1, 18, 0, 0, 0, 0, DateTimeKind.Unspecified), "Optimize database queries and add proper indexing", new DateTime(2026, 1, 30, 0, 0, 0, 0, DateTimeKind.Unspecified), 0, 0, "Database optimization" },
                    { 6, new DateTime(2026, 1, 16, 0, 0, 0, 0, DateTimeKind.Unspecified), "Review pull requests and discuss code quality improvements", new DateTime(2026, 1, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), 0, 2, "Code review meeting" },
                    { 7, new DateTime(2026, 1, 17, 0, 0, 0, 0, DateTimeKind.Unspecified), "Configure application performance monitoring with alerts", new DateTime(2026, 1, 26, 0, 0, 0, 0, DateTimeKind.Unspecified), 1, 0, "Performance monitoring setup" },
                    { 8, new DateTime(2026, 1, 13, 0, 0, 0, 0, DateTimeKind.Unspecified), "Analyze user feedback and prioritize feature requests", new DateTime(2026, 1, 22, 0, 0, 0, 0, DateTimeKind.Unspecified), 2, 0, "User feedback analysis" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TaskItems");
        }
    }
}
