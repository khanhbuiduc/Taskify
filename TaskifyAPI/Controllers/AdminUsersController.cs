using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TaskifyAPI.Data;
using TaskifyAPI.Model;
using TaskifyAPI.Model.ViewModel;

namespace TaskifyAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Policy = "AdminOnly")]
    public class AdminUsersController : ControllerBase
    {
        private const string AdminRole = "Admin";
        private const string UserRole = "User";

        private static readonly HashSet<string> AllowedRoles = new(StringComparer.OrdinalIgnoreCase)
        {
            AdminRole,
            UserRole
        };

        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ApplicationDbContext _dbContext;

        public AdminUsersController(
            UserManager<ApplicationUser> userManager,
            ApplicationDbContext dbContext)
        {
            _userManager = userManager;
            _dbContext = dbContext;
        }

        [HttpGet]
        public async Task<ActionResult<PagedResultDto<AdminUserResponseDto>>> GetAll([FromQuery] AdminUserQueryDto query)
        {
            var normalizedRole = NormalizeRole(query.Role);
            if (!string.IsNullOrWhiteSpace(query.Role) && normalizedRole == null)
            {
                return BadRequest(new { message = "Invalid role filter. Allowed values: Admin, User." });
            }

            var normalizedStatus = NormalizeStatus(query.Status);
            if (!string.IsNullOrWhiteSpace(query.Status) && normalizedStatus == null)
            {
                return BadRequest(new { message = "Invalid status filter. Allowed values: active, banned." });
            }

            var usersQuery = _userManager.Users.AsNoTracking();
            var search = query.Search?.Trim();

            if (!string.IsNullOrWhiteSpace(search))
            {
                usersQuery = usersQuery.Where(u =>
                    (u.Email != null && u.Email.Contains(search)) ||
                    (u.UserName != null && u.UserName.Contains(search)));
            }

            if (!string.IsNullOrWhiteSpace(normalizedRole))
            {
                usersQuery =
                    from user in usersQuery
                    join userRole in _dbContext.Set<IdentityUserRole<string>>() on user.Id equals userRole.UserId
                    join role in _dbContext.Roles on userRole.RoleId equals role.Id
                    where role.Name == normalizedRole
                    select user;
            }

            var now = DateTimeOffset.UtcNow;

            if (normalizedStatus == "banned")
            {
                usersQuery = usersQuery.Where(u => u.LockoutEnabled && u.LockoutEnd.HasValue && u.LockoutEnd > now);
            }
            else if (normalizedStatus == "active")
            {
                usersQuery = usersQuery.Where(u => !u.LockoutEnabled || !u.LockoutEnd.HasValue || u.LockoutEnd <= now);
            }

            usersQuery = usersQuery.OrderBy(u => u.Email);

            var page = Math.Max(1, query.Page);
            var pageSize = query.PageSize <= 0 || query.PageSize > 100 ? 20 : query.PageSize;
            var totalCount = await usersQuery.CountAsync();
            var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling((double)totalCount / pageSize);

            var users = await usersQuery
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var rolesByUserId = await GetRolesByUserIdsAsync(users.Select(u => u.Id));
            var items = users
                .Select(user => MapToDto(
                    user,
                    rolesByUserId.TryGetValue(user.Id, out var roles) ? roles : new List<string>()))
                .ToList();

            return Ok(new PagedResultDto<AdminUserResponseDto>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages
            });
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<AdminUserResponseDto>> GetById(string id)
        {
            var user = await _userManager.FindByIdAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found." });
            }

            var roles = await _userManager.GetRolesAsync(user);
            return Ok(MapToDto(user, roles));
        }

        [HttpPost]
        public async Task<ActionResult<AdminUserResponseDto>> Create([FromBody] CreateAdminUserDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var role = NormalizeRole(dto.Role);
            if (role == null)
            {
                return BadRequest(new { message = "Role must be either Admin or User." });
            }

            var email = dto.Email.Trim();
            var displayName = dto.DisplayName.Trim();

            var existingUser = await _userManager.FindByEmailAsync(email);
            if (existingUser != null)
            {
                return BadRequest(new { message = "User with this email already exists." });
            }

            var user = new ApplicationUser
            {
                Email = email,
                UserName = displayName,
                EmailConfirmed = true,
                LockoutEnabled = true
            };

            var createResult = await _userManager.CreateAsync(user, dto.Password);
            if (!createResult.Succeeded)
            {
                return BadRequest(new { message = "Failed to create user.", errors = createResult.Errors });
            }

            var roleResult = await _userManager.AddToRoleAsync(user, role);
            if (!roleResult.Succeeded)
            {
                await _userManager.DeleteAsync(user);
                return BadRequest(new { message = "Failed to assign role.", errors = roleResult.Errors });
            }

            return CreatedAtAction(nameof(GetById), new { id = user.Id }, MapToDto(user, new[] { role }));
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<AdminUserResponseDto>> Update(string id, [FromBody] UpdateAdminUserDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var user = await _userManager.FindByIdAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found." });
            }

            var role = NormalizeRole(dto.Role);
            if (role == null)
            {
                return BadRequest(new { message = "Role must be either Admin or User." });
            }

            if (!string.IsNullOrWhiteSpace(dto.NewPassword) && dto.NewPassword != dto.ConfirmNewPassword)
            {
                return BadRequest(new { message = "New password and confirmation password do not match." });
            }

            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var email = dto.Email.Trim();
            var displayName = dto.DisplayName.Trim();
            var existingUser = await _userManager.FindByEmailAsync(email);

            if (existingUser != null && existingUser.Id != user.Id)
            {
                return BadRequest(new { message = "User with this email already exists." });
            }

            var currentRoles = await _userManager.GetRolesAsync(user);
            var currentRole = currentRoles.FirstOrDefault(r => AllowedRoles.Contains(r)) ?? UserRole;

            if (currentUserId == user.Id && !string.Equals(currentRole, role, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "You cannot change your own role from the admin console." });
            }

            if (string.Equals(currentRole, AdminRole, StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(role, AdminRole, StringComparison.OrdinalIgnoreCase) &&
                await IsLastActiveAdminAsync(user.Id))
            {
                return BadRequest(new { message = "You cannot remove the last active admin." });
            }

            user.Email = email;
            user.UserName = displayName;

            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                return BadRequest(new { message = "Failed to update user.", errors = updateResult.Errors });
            }

            if (!string.Equals(currentRole, role, StringComparison.OrdinalIgnoreCase))
            {
                if (!currentRoles.Contains(role))
                {
                    var addRoleResult = await _userManager.AddToRoleAsync(user, role);
                    if (!addRoleResult.Succeeded)
                    {
                        return BadRequest(new { message = "Failed to update user role.", errors = addRoleResult.Errors });
                    }
                }

                var removableRoles = currentRoles
                    .Where(r => AllowedRoles.Contains(r) && !string.Equals(r, role, StringComparison.OrdinalIgnoreCase))
                    .ToList();

                if (removableRoles.Count > 0)
                {
                    var removeResult = await _userManager.RemoveFromRolesAsync(user, removableRoles);
                    if (!removeResult.Succeeded)
                    {
                        return BadRequest(new { message = "Failed to update user role.", errors = removeResult.Errors });
                    }
                }
            }

            if (!string.IsNullOrWhiteSpace(dto.NewPassword))
            {
                var token = await _userManager.GeneratePasswordResetTokenAsync(user);
                var passwordResult = await _userManager.ResetPasswordAsync(user, token, dto.NewPassword);
                if (!passwordResult.Succeeded)
                {
                    return BadRequest(new { message = "Failed to reset password.", errors = passwordResult.Errors });
                }

                await _userManager.UpdateSecurityStampAsync(user);
            }

            var updatedRoles = await _userManager.GetRolesAsync(user);
            return Ok(MapToDto(user, updatedRoles));
        }

        [HttpPost("{id}/ban")]
        public async Task<ActionResult<AdminUserResponseDto>> Ban(string id)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (currentUserId == id)
            {
                return BadRequest(new { message = "You cannot ban your own account." });
            }

            var user = await _userManager.FindByIdAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found." });
            }

            var roles = await _userManager.GetRolesAsync(user);
            if (roles.Contains(AdminRole) && await IsLastActiveAdminAsync(user.Id))
            {
                return BadRequest(new { message = "You cannot ban the last active admin." });
            }

            user.LockoutEnabled = true;
            user.LockoutEnd = DateTimeOffset.MaxValue;

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
            {
                return BadRequest(new { message = "Failed to ban user.", errors = result.Errors });
            }

            await _userManager.UpdateSecurityStampAsync(user);
            return Ok(MapToDto(user, roles));
        }

        [HttpPost("{id}/unban")]
        public async Task<ActionResult<AdminUserResponseDto>> Unban(string id)
        {
            var user = await _userManager.FindByIdAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found." });
            }

            user.LockoutEnabled = true;
            user.LockoutEnd = null;

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
            {
                return BadRequest(new { message = "Failed to unban user.", errors = result.Errors });
            }

            await _userManager.ResetAccessFailedCountAsync(user);
            var roles = await _userManager.GetRolesAsync(user);
            return Ok(MapToDto(user, roles));
        }

        private async Task<Dictionary<string, List<string>>> GetRolesByUserIdsAsync(IEnumerable<string> userIds)
        {
            var userIdList = userIds.Distinct().ToList();
            if (userIdList.Count == 0)
            {
                return new Dictionary<string, List<string>>();
            }

            var roleRows = await (
                from userRole in _dbContext.Set<IdentityUserRole<string>>()
                join role in _dbContext.Roles on userRole.RoleId equals role.Id
                where userIdList.Contains(userRole.UserId)
                select new { userRole.UserId, role.Name }
            ).ToListAsync();

            return roleRows
                .GroupBy(row => row.UserId)
                .ToDictionary(
                    group => group.Key,
                    group => group
                        .Select(row => row.Name)
                        .Where(name => !string.IsNullOrWhiteSpace(name))
                        .Cast<string>()
                        .OrderBy(name => name)
                        .ToList());
        }

        private async Task<bool> IsLastActiveAdminAsync(string userId)
        {
            var now = DateTimeOffset.UtcNow;
            var activeAdminIds = await (
                from user in _userManager.Users
                join userRole in _dbContext.Set<IdentityUserRole<string>>() on user.Id equals userRole.UserId
                join role in _dbContext.Roles on userRole.RoleId equals role.Id
                where role.Name == AdminRole &&
                      (!user.LockoutEnabled || !user.LockoutEnd.HasValue || user.LockoutEnd <= now)
                select user.Id
            )
            .Distinct()
            .ToListAsync();

            return activeAdminIds.Count == 1 && activeAdminIds[0] == userId;
        }

        private static AdminUserResponseDto MapToDto(ApplicationUser user, IEnumerable<string> roles)
        {
            var isBanned = IsBanned(user);

            return new AdminUserResponseDto
            {
                UserId = user.Id,
                Email = user.Email ?? string.Empty,
                UserName = user.UserName ?? string.Empty,
                AvatarUrl = user.AvatarUrl,
                Roles = roles.OrderBy(role => role).ToList(),
                IsBanned = isBanned,
                LockoutEndUtc = isBanned ? user.LockoutEnd : null,
                Status = isBanned ? "Banned" : "Active"
            };
        }

        private static bool IsBanned(ApplicationUser user)
        {
            return user.LockoutEnabled &&
                   user.LockoutEnd.HasValue &&
                   user.LockoutEnd.Value > DateTimeOffset.UtcNow;
        }

        private static string? NormalizeRole(string? role)
        {
            if (string.IsNullOrWhiteSpace(role))
            {
                return null;
            }

            return AllowedRoles.FirstOrDefault(candidate => string.Equals(candidate, role.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        private static string? NormalizeStatus(string? status)
        {
            if (string.IsNullOrWhiteSpace(status))
            {
                return null;
            }

            var normalized = status.Trim().ToLowerInvariant();
            return normalized is "active" or "banned" ? normalized : null;
        }
    }
}
