using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using TaskifyAPI.Model;
using TaskifyAPI.Model.ViewModel;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Controllers
{
    /// <summary>
    /// Controller for managing labels (user scoped)
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class LabelController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;

        public LabelController(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        /// <summary>
        /// Get all labels for current user
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<LabelDto>>> GetAll()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not found" });
            }

            var labels = await _unitOfWork.Labels.GetByUserAsync(userId);
            return Ok(labels.Select(MapToDto));
        }

        /// <summary>
        /// Create a new label
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<LabelDto>> Create([FromBody] CreateLabelDto dto)
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

            if (await _unitOfWork.Labels.NameExistsAsync(userId, dto.Name))
            {
                return Conflict(new { message = "Label name already exists" });
            }

            var label = new Label
            {
                Name = dto.Name,
                Color = dto.Color,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            await _unitOfWork.Labels.AddAsync(label);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAll), new { id = label.Id }, MapToDto(label));
        }

        /// <summary>
        /// Update an existing label
        /// </summary>
        [HttpPut("{id}")]
        [HttpPatch("{id}")]
        public async Task<ActionResult<LabelDto>> Update(int id, [FromBody] UpdateLabelDto dto)
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

            var label = await _unitOfWork.Labels.GetByIdAsync(id);
            if (label == null || label.UserId != userId)
            {
                return NotFound(new { message = "Label not found" });
            }

            if (await _unitOfWork.Labels.NameExistsAsync(userId, dto.Name, id))
            {
                return Conflict(new { message = "Label name already exists" });
            }

            label.Name = dto.Name;
            label.Color = dto.Color;
            _unitOfWork.Labels.Update(label);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapToDto(label));
        }

        /// <summary>
        /// Delete a label (blocked if still used by tasks)
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not found" });
            }

            var label = await _unitOfWork.Labels.GetByIdAsync(id);
            if (label == null || label.UserId != userId)
            {
                return NotFound(new { message = "Label not found" });
            }

            // Prevent delete if still attached to tasks
            var inUse = await _unitOfWork.Tasks.AnyAsync(t => t.Labels.Any(l => l.Id == id));
            if (inUse)
            {
                return Conflict(new { message = "Cannot delete label: it is still assigned to tasks" });
            }

            _unitOfWork.Labels.Remove(label);
            await _unitOfWork.SaveChangesAsync();
            return NoContent();
        }

        private static LabelDto MapToDto(Label label) => new LabelDto
        {
            Id = label.Id,
            Name = label.Name,
            Color = label.Color
        };
    }
}
