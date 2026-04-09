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
    public class FinanceEntriesController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;

        public FinanceEntriesController(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        private string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

        private static FinanceEntryResponseDto MapToDto(FinanceEntry entry) => new()
        {
            Id = entry.Id.ToString(),
            Date = entry.Date.ToString("o"),
            Category = entry.Category,
            Description = entry.Description ?? string.Empty,
            Amount = entry.Amount,
            CreatedAt = entry.CreatedAt.ToString("o"),
            UpdatedAt = entry.UpdatedAt.ToString("o")
        };

        [HttpGet]
        public async Task<ActionResult<IEnumerable<FinanceEntryResponseDto>>> GetAll(
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] string? category = null,
            [FromQuery] string? search = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var userId = GetUserId();
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            page = Math.Max(1, page);
            pageSize = pageSize <= 0 || pageSize > 100 ? 20 : pageSize;

            var entries = await _unitOfWork.FinanceEntries.GetByUserAsync(
                userId,
                from,
                to,
                string.IsNullOrWhiteSpace(category) ? null : category.Trim(),
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                page,
                pageSize);

            return Ok(entries.Select(MapToDto));
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<FinanceEntryResponseDto>> GetById(int id)
        {
            var userId = GetUserId();
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var entry = await _unitOfWork.FinanceEntries.GetByUserAndIdAsync(userId, id);
            if (entry == null)
            {
                return NotFound();
            }

            return Ok(MapToDto(entry));
        }

        [HttpPost]
        public async Task<ActionResult<FinanceEntryResponseDto>> Create([FromBody] CreateFinanceEntryDto dto)
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

            if (dto.Date == default)
            {
                return BadRequest(new { message = "Date is required." });
            }

            var categoryName = dto.Category.Trim();
            var category = await _unitOfWork.FinanceCategories.GetByUserAndNameAsync(userId, categoryName);
            if (category == null)
            {
                return BadRequest(new { message = "Category does not exist for this user." });
            }

            if (dto.Amount <= 0)
            {
                return BadRequest(new { message = "Amount must be greater than zero." });
            }

            var now = DateTime.UtcNow;
            var entry = new FinanceEntry
            {
                Date = dto.Date,
                Category = category.Name,
                Description = dto.Description?.Trim() ?? string.Empty,
                Amount = dto.Amount,
                UserId = userId,
                CreatedAt = now,
                UpdatedAt = now
            };

            await _unitOfWork.FinanceEntries.AddAsync(entry);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = entry.Id }, MapToDto(entry));
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<FinanceEntryResponseDto>> Update(int id, [FromBody] UpdateFinanceEntryDto dto)
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

            var entry = await _unitOfWork.FinanceEntries.GetByUserAndIdAsync(userId, id);
            if (entry == null)
            {
                return NotFound();
            }

            if (dto.Date == default)
            {
                return BadRequest(new { message = "Date is required." });
            }

            if (dto.Amount <= 0)
            {
                return BadRequest(new { message = "Amount must be greater than zero." });
            }

            var categoryName = dto.Category.Trim();
            var category = await _unitOfWork.FinanceCategories.GetByUserAndNameAsync(userId, categoryName);
            if (category == null)
            {
                return BadRequest(new { message = "Category does not exist for this user." });
            }

            entry.Date = dto.Date;
            entry.Category = category.Name;
            entry.Description = dto.Description?.Trim() ?? string.Empty;
            entry.Amount = dto.Amount;
            entry.UpdatedAt = DateTime.UtcNow;

            _unitOfWork.FinanceEntries.Update(entry);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapToDto(entry));
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = GetUserId();
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var entry = await _unitOfWork.FinanceEntries.GetByUserAndIdAsync(userId, id);
            if (entry == null)
            {
                return NotFound();
            }

            _unitOfWork.FinanceEntries.Remove(entry);
            await _unitOfWork.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("summary")]
        public async Task<ActionResult<FinanceSummaryResponseDto>> GetSummary(
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] string? category = null)
        {
            var userId = GetUserId();
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Unauthorized();
            }

            var (totalAmount, count, dailyTotals) = await _unitOfWork.FinanceEntries.GetSummaryAsync(
                userId,
                from,
                to,
                string.IsNullOrWhiteSpace(category) ? null : category.Trim());

            var response = new FinanceSummaryResponseDto
            {
                TotalAmount = totalAmount,
                Count = count,
                AverageAmount = count == 0 ? 0 : decimal.Round(totalAmount / count, 2),
                DailyTotals = dailyTotals.Select(d => new FinanceSummaryDailyDto
                {
                    Date = d.date.ToString("o"),
                    TotalAmount = d.totalAmount
                }).ToList()
            };

            return Ok(response);
        }
    }
}
