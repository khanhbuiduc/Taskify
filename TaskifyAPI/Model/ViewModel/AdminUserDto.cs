using System.ComponentModel.DataAnnotations;

namespace TaskifyAPI.Model.ViewModel
{
    public class AdminUserQueryDto
    {
        public string? Search { get; set; }
        public string? Role { get; set; }
        public string? Status { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public class AdminUserResponseDto
    {
        public string UserId { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public List<string> Roles { get; set; } = new();
        public bool IsBanned { get; set; }
        public DateTimeOffset? LockoutEndUtc { get; set; }
        public string Status { get; set; } = "Active";
    }

    public class CreateAdminUserDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [StringLength(100, MinimumLength = 1)]
        public string DisplayName { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string Password { get; set; } = string.Empty;

        [Required]
        public string Role { get; set; } = string.Empty;
    }

    public class UpdateAdminUserDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [StringLength(100, MinimumLength = 1)]
        public string DisplayName { get; set; } = string.Empty;

        [Required]
        public string Role { get; set; } = string.Empty;

        [MinLength(6)]
        public string? NewPassword { get; set; }

        public string? ConfirmNewPassword { get; set; }
    }
}
