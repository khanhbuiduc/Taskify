using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using TaskifyAPI.Model;
using TaskifyAPI.Model.ViewModel;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FinanceCategoriesController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;

        public FinanceCategoriesController(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        private string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

        private static FinanceCategoryResponseDto MapToDto(FinanceCategory category) => new()
        {
            Id = category.Id.ToString(),
            Name = category.Name,
            CreatedAt = category.CreatedAt.ToString("o")
        };

        [HttpGet]
        public async Task<ActionResult<IEnumerable<FinanceCategoryResponseDto>>> GetAll()
        {
            var userId = GetUserId();
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var categories = await _unitOfWork.FinanceCategories.GetByUserAsync(userId);
            return Ok(categories.Select(MapToDto));
        }

        [HttpPost]
        public async Task<ActionResult<FinanceCategoryResponseDto>> Create([FromBody] CreateFinanceCategoryDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userId = GetUserId();
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var name = dto.Name.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                return BadRequest(new { message = "Category name is required." });
            }

            var existing = await _unitOfWork.FinanceCategories.GetByUserAndNameAsync(userId, name);
            if (existing != null)
            {
                return Conflict(new { message = "Category already exists." });
            }

            var category = new FinanceCategory
            {
                Name = name,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            await _unitOfWork.FinanceCategories.AddAsync(category);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAll), MapToDto(category));
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<FinanceCategoryResponseDto>> Update(int id, [FromBody] UpdateFinanceCategoryDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userId = GetUserId();
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var category = await _unitOfWork.FinanceCategories.GetByUserAndIdAsync(userId, id);
            if (category == null)
            {
                return NotFound();
            }

            var name = dto.Name.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                return BadRequest(new { message = "Category name is required." });
            }

            var duplicate = await _unitOfWork.FinanceCategories.GetByUserAndNameAsync(userId, name);
            if (duplicate != null && duplicate.Id != category.Id)
            {
                return Conflict(new { message = "Category already exists." });
            }

            var oldName = category.Name;
            category.Name = name;
            _unitOfWork.FinanceCategories.Update(category);
            await _unitOfWork.FinanceEntries.RenameCategoryAsync(userId, oldName, name);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapToDto(category));
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = GetUserId();
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var category = await _unitOfWork.FinanceCategories.GetByUserAndIdAsync(userId, id);
            if (category == null)
            {
                return NotFound();
            }

            var isUsed = await _unitOfWork.FinanceEntries.IsCategoryUsedAsync(userId, category.Name);
            if (isUsed)
            {
                return Conflict(new { message = "Cannot delete category that is currently used by finance entries." });
            }

            _unitOfWork.FinanceCategories.Remove(category);
            await _unitOfWork.SaveChangesAsync();
            return NoContent();
        }
    }
}
