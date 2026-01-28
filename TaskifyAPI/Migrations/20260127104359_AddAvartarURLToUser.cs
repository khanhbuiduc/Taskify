using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace TaskifyAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddAvartarURLToUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "fdc82602-9e48-45a0-b971-68ba0003e27e");

            migrationBuilder.DeleteData(
                table: "AspNetUserRoles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { "733732b2-8ba4-4d57-bc30-79de9a64d5e3", "a09fa0b4-9cf5-4be6-92f7-cbef4e782f74" });

            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "733732b2-8ba4-4d57-bc30-79de9a64d5e3");

            migrationBuilder.DeleteData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: "a09fa0b4-9cf5-4be6-92f7-cbef4e782f74");

            migrationBuilder.AddColumn<string>(
                name: "AvatarUrl",
                table: "AspNetUsers",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.InsertData(
                table: "AspNetRoles",
                columns: new[] { "Id", "ConcurrencyStamp", "Name", "NormalizedName" },
                values: new object[,]
                {
                    { "bc3d9932-cf71-477e-aa81-cf60a339ad99", null, "Admin", "ADMIN" },
                    { "e0c696f1-9145-4a5a-b2c0-b7505829ce8c", null, "User", "USER" }
                });

            migrationBuilder.InsertData(
                table: "AspNetUsers",
                columns: new[] { "Id", "AccessFailedCount", "AvatarUrl", "ConcurrencyStamp", "Email", "EmailConfirmed", "LockoutEnabled", "LockoutEnd", "NormalizedEmail", "NormalizedUserName", "PasswordHash", "PhoneNumber", "PhoneNumberConfirmed", "SecurityStamp", "TwoFactorEnabled", "UserName" },
                values: new object[] { "b2f8acaa-7e35-4f4e-807d-58e77045a4fb", 0, null, "14b2cd2e-8b03-4f76-8982-c3b226a82f95", "admin@taskify.com", true, false, null, "ADMIN@TASKIFY.COM", "ADMIN USER", "AQAAAAIAAYagAAAAEGT8DqySGTeRKBySwFD+8XB/AZPoUVgMEhqfP9VmnYSShEbXlchkRUtBWc605Xg9gg==", null, false, "6e6fdb97-4e26-4c36-8372-32006b1db4f6", false, "Admin User" });

            migrationBuilder.InsertData(
                table: "AspNetUserRoles",
                columns: new[] { "RoleId", "UserId" },
                values: new object[] { "bc3d9932-cf71-477e-aa81-cf60a339ad99", "b2f8acaa-7e35-4f4e-807d-58e77045a4fb" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "e0c696f1-9145-4a5a-b2c0-b7505829ce8c");

            migrationBuilder.DeleteData(
                table: "AspNetUserRoles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { "bc3d9932-cf71-477e-aa81-cf60a339ad99", "b2f8acaa-7e35-4f4e-807d-58e77045a4fb" });

            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "bc3d9932-cf71-477e-aa81-cf60a339ad99");

            migrationBuilder.DeleteData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: "b2f8acaa-7e35-4f4e-807d-58e77045a4fb");

            migrationBuilder.DropColumn(
                name: "AvatarUrl",
                table: "AspNetUsers");

            migrationBuilder.InsertData(
                table: "AspNetRoles",
                columns: new[] { "Id", "ConcurrencyStamp", "Name", "NormalizedName" },
                values: new object[,]
                {
                    { "733732b2-8ba4-4d57-bc30-79de9a64d5e3", null, "Admin", "ADMIN" },
                    { "fdc82602-9e48-45a0-b971-68ba0003e27e", null, "User", "USER" }
                });

            migrationBuilder.InsertData(
                table: "AspNetUsers",
                columns: new[] { "Id", "AccessFailedCount", "ConcurrencyStamp", "Email", "EmailConfirmed", "LockoutEnabled", "LockoutEnd", "NormalizedEmail", "NormalizedUserName", "PasswordHash", "PhoneNumber", "PhoneNumberConfirmed", "SecurityStamp", "TwoFactorEnabled", "UserName" },
                values: new object[] { "a09fa0b4-9cf5-4be6-92f7-cbef4e782f74", 0, "201f2d39-203c-4bf7-a18d-592b8447ee54", "admin@taskify.com", true, false, null, "ADMIN@TASKIFY.COM", "ADMIN@TASKIFY.COM", "AQAAAAIAAYagAAAAEO+gHMmwXaQ1E9BRZNgfjGFiZ8xUuKbuUeBMtRz8EdcnJdpe5M8aayn3LoI4oQwQow==", null, false, "c66e4fbc-ed23-464a-81b6-216b4c224b86", false, "admin@taskify.com" });

            migrationBuilder.InsertData(
                table: "AspNetUserRoles",
                columns: new[] { "RoleId", "UserId" },
                values: new object[] { "733732b2-8ba4-4d57-bc30-79de9a64d5e3", "a09fa0b4-9cf5-4be6-92f7-cbef4e782f74" });
        }
    }
}
