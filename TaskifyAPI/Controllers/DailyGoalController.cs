using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using TaskifyAPI.Model;
using TaskifyAPI.Model.ViewModel;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Controllers
{
    /// <summary>
    /// Controller for Daily Goal operations
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DailyGoalController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly UserManager<ApplicationUser> _userManager;

        public DailyGoalController(IUnitOfWork unitOfWork, UserManager<ApplicationUser> userManager)
        {
            _unitOfWork = unitOfWork;
            _userManager = userManager;
        }

        /// <summary>
        /// Get all daily goals for the current user
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DailyGoalResponseDto>>> GetAll()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not found" });
            }

            var goals = await _unitOfWork.DailyGoals.GetByUserIdAsync(userId);
            var response = goals.Select(MapToResponseDto);
            return Ok(response);
        }

        /// <summary>
        /// Get today's goals for the current user
        /// </summary>
        [HttpGet("today")]
        public async Task<ActionResult<IEnumerable<DailyGoalResponseDto>>> GetToday()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not found" });
            }

            var goals = await _unitOfWork.DailyGoals.GetTodayGoalsByUserIdAsync(userId);
            var response = goals.Select(MapToResponseDto);
            return Ok(response);
        }

        /// <summary>
        /// Create a new daily goal
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<DailyGoalResponseDto>> Create([FromBody] CreateDailyGoalDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not found" });
            }

            var goal = new DailyGoal
            {
                UserId = userId,
                Title = dto.Title,
                IsCompleted = false,
                CreatedAt = DateTime.UtcNow
            };

            await _unitOfWork.DailyGoals.AddAsync(goal);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = goal.Id }, MapToResponseDto(goal));
        }

        /// <summary>
        /// Get a daily goal by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<DailyGoalResponseDto>> GetById(int id)
        {
            var goal = await _unitOfWork.DailyGoals.GetByIdAsync(id);
            if (goal == null)
            {
                return NotFound(new { message = $"Goal with ID {id} not found" });
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (goal.UserId != userId)
            {
                return Forbid("You do not have permission to access this goal");
            }

            return Ok(MapToResponseDto(goal));
        }

        /// <summary>
        /// Update a daily goal
        /// </summary>
        [HttpPut("{id}")]
        public async Task<ActionResult<DailyGoalResponseDto>> Update(int id, [FromBody] UpdateDailyGoalDto dto)
        {
            var goal = await _unitOfWork.DailyGoals.GetByIdAsync(id);
            if (goal == null)
            {
                return NotFound(new { message = $"Goal with ID {id} not found" });
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (goal.UserId != userId)
            {
                return Forbid("You do not have permission to modify this goal");
            }

            if (!string.IsNullOrEmpty(dto.Title))
            {
                goal.Title = dto.Title;
            }

            if (dto.IsCompleted.HasValue)
            {
                goal.IsCompleted = dto.IsCompleted.Value;
            }

            _unitOfWork.DailyGoals.Update(goal);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapToResponseDto(goal));
        }

        /// <summary>
        /// Toggle goal completion status
        /// </summary>
        [HttpPut("{id}/toggle")]
        public async Task<ActionResult<DailyGoalResponseDto>> Toggle(int id)
        {
            var goal = await _unitOfWork.DailyGoals.GetByIdAsync(id);
            if (goal == null)
            {
                return NotFound(new { message = $"Goal with ID {id} not found" });
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (goal.UserId != userId)
            {
                return Forbid("You do not have permission to modify this goal");
            }

            goal.IsCompleted = !goal.IsCompleted;

            _unitOfWork.DailyGoals.Update(goal);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapToResponseDto(goal));
        }

        /// <summary>
        /// Delete a daily goal
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            var goal = await _unitOfWork.DailyGoals.GetByIdAsync(id);
            if (goal == null)
            {
                return NotFound(new { message = $"Goal with ID {id} not found" });
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (goal.UserId != userId)
            {
                return Forbid("You do not have permission to delete this goal");
            }

            _unitOfWork.DailyGoals.Remove(goal);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>
        /// Clear all completed goals for today
        /// </summary>
        [HttpDelete("clear-completed")]
        public async Task<ActionResult> ClearCompleted()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not found" });
            }

            var goals = await _unitOfWork.DailyGoals.GetTodayGoalsByUserIdAsync(userId);
            var completedGoals = goals.Where(g => g.IsCompleted).ToList();

            foreach (var goal in completedGoals)
            {
                _unitOfWork.DailyGoals.Remove(goal);
            }

            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }

        private static DailyGoalResponseDto MapToResponseDto(DailyGoal goal)
        {
            return new DailyGoalResponseDto
            {
                Id = goal.Id,
                Title = goal.Title,
                IsCompleted = goal.IsCompleted,
                CreatedAt = goal.CreatedAt
            };
        }
    }
}
