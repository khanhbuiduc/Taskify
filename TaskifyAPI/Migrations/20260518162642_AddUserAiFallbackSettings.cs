using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskifyAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAiFallbackSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserAiFallbackSettings",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    ActiveProvider = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    OllamaBaseUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    OllamaModel = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    LastOllamaValidatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastOllamaValidationError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserAiFallbackSettings", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_UserAiFallbackSettings_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserAiFallbackSettings");
        }
    }
}
