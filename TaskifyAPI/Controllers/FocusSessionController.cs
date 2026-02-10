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
    /// Controller for Focus Session operations
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FocusSessionController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly UserManager<ApplicationUser> _userManager;

        public FocusSessionController(IUnitOfWork unitOfWork, UserManager<ApplicationUser> userManager)
        {
            _unitOfWork = unitOfWork;
            _userManager = userManager;
        }

        /// <summary>
        /// Get all focus sessions for the current user
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<FocusSessionResponseDto>>> GetAll()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not found" });
            }

            var sessions = await _unitOfWork.FocusSessions.GetByUserIdAsync(userId);
            var response = sessions.Select(MapToResponseDto);
            return Ok(response);
        }

        /// <summary>
        /// Get today's focus sessions for the current user
        /// </summary>
        [HttpGet("today")]
        public async Task<ActionResult<IEnumerable<FocusSessionResponseDto>>> GetToday()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not found" });
            }

            var sessions = await _unitOfWork.FocusSessions.GetByUserIdAndDateAsync(userId, DateTime.UtcNow);
            var response = sessions.Select(MapToResponseDto);
            return Ok(response);
        }

        /// <summary>
        /// Get focus session statistics for the current user
        /// </summary>
        [HttpGet("stats")]
        public async Task<ActionResult<FocusStatsDto>> GetStats()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not found" });
            }

            var today = DateTime.UtcNow.Date;
            var startOfWeek = today.AddDays(-(int)today.DayOfWeek);
            var endOfWeek = startOfWeek.AddDays(7);

            var todaySessions = await _unitOfWork.FocusSessions.GetByUserIdAndDateAsync(userId, today);
            var weekSessions = await _unitOfWork.FocusSessions.GetByUserIdAndDateRangeAsync(userId, startOfWeek, endOfWeek);

            var stats = new FocusStatsDto
            {
                TotalSessionsToday = todaySessions.Count(),
                CompletedSessionsToday = todaySessions.Count(s => s.IsCompleted),
                TotalMinutesToday = todaySessions.Sum(s => s.DurationMinutes),
                TotalBreaksToday = todaySessions.Sum(s => s.BreaksTaken),
                TotalSessionsThisWeek = weekSessions.Count(),
                TotalMinutesThisWeek = weekSessions.Sum(s => s.DurationMinutes)
            };

            return Ok(stats);
        }

        /// <summary>
        /// Start a new focus session
        /// </summary>
        [HttpPost("start")]
        public async Task<ActionResult<FocusSessionResponseDto>> Start([FromBody] StartFocusSessionDto dto)
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

            var session = new FocusSession
            {
                UserId = userId,
                DurationMinutes = dto.DurationMinutes,
                StartedAt = DateTime.UtcNow,
                IsCompleted = false,
                BreaksTaken = 0
            };

            await _unitOfWork.FocusSessions.AddAsync(session);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = session.Id }, MapToResponseDto(session));
        }

        /// <summary>
        /// Get a focus session by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<FocusSessionResponseDto>> GetById(int id)
        {
            var session = await _unitOfWork.FocusSessions.GetByIdAsync(id);
            if (session == null)
            {
                return NotFound(new { message = $"Focus session with ID {id} not found" });
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (session.UserId != userId)
            {
                return Forbid("You do not have permission to access this session");
            }

            return Ok(MapToResponseDto(session));
        }

        /// <summary>
        /// End a focus session
        /// </summary>
        [HttpPut("{id}/end")]
        public async Task<ActionResult<FocusSessionResponseDto>> End(int id, [FromBody] EndFocusSessionDto dto)
        {
            var session = await _unitOfWork.FocusSessions.GetByIdAsync(id);
            if (session == null)
            {
                return NotFound(new { message = $"Focus session with ID {id} not found" });
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (session.UserId != userId)
            {
                return Forbid("You do not have permission to modify this session");
            }

            session.EndedAt = DateTime.UtcNow;
            session.IsCompleted = dto.IsCompleted;
            session.BreaksTaken = dto.BreaksTaken;

            _unitOfWork.FocusSessions.Update(session);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapToResponseDto(session));
        }

        /// <summary>
        /// Delete a focus session
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            var session = await _unitOfWork.FocusSessions.GetByIdAsync(id);
            if (session == null)
            {
                return NotFound(new { message = $"Focus session with ID {id} not found" });
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (session.UserId != userId)
            {
                return Forbid("You do not have permission to delete this session");
            }

            _unitOfWork.FocusSessions.Remove(session);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }

        private static FocusSessionResponseDto MapToResponseDto(FocusSession session)
        {
            return new FocusSessionResponseDto
            {
                Id = session.Id,
                DurationMinutes = session.DurationMinutes,
                BreaksTaken = session.BreaksTaken,
                IsCompleted = session.IsCompleted,
                StartedAt = session.StartedAt,
                EndedAt = session.EndedAt
            };
        }
    }
}
