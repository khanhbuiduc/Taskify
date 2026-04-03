using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskifyAPI.Migrations
{
    /// <summary>
    /// Adds Labels table and TaskItemLabels junction (many-to-many)
    /// </summary>
    public partial class AddLabelsAndRelations : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Clean up if a previous failed attempt left tables
            migrationBuilder.Sql("IF OBJECT_ID('dbo.TaskItemLabels', 'U') IS NOT NULL DROP TABLE dbo.TaskItemLabels;");
            migrationBuilder.Sql("IF OBJECT_ID('dbo.Labels', 'U') IS NOT NULL DROP TABLE dbo.Labels;");

            // Create Labels table
            migrationBuilder.CreateTable(
                name: "Labels",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Color = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Labels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Labels_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Junction table TaskItemLabels
            migrationBuilder.CreateTable(
                name: "TaskItemLabels",
                columns: table => new
                {
                    TaskItemId = table.Column<int>(type: "int", nullable: false),
                    LabelId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskItemLabels", x => new { x.TaskItemId, x.LabelId });
                    table.ForeignKey(
                        name: "FK_TaskItemLabels_Labels_LabelId",
                        column: x => x.LabelId,
                        principalTable: "Labels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.NoAction);
                    table.ForeignKey(
                        name: "FK_TaskItemLabels_TaskItems_TaskItemId",
                        column: x => x.TaskItemId,
                        principalTable: "TaskItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Labels_UserId",
                table: "Labels",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Labels_UserId_Name",
                table: "Labels",
                columns: new[] { "UserId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaskItemLabels_LabelId",
                table: "TaskItemLabels",
                column: "LabelId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TaskItemLabels");

            migrationBuilder.DropTable(
                name: "Labels");
        }
    }
}
