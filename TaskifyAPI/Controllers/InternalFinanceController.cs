using Microsoft.AspNetCore.Mvc;
using TaskifyAPI.Model;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Controllers
{
    /// <summary>
    /// Internal API for Rasa to manage finance entries and categories.
    /// </summary>
    [Route("api/internal/finance")]
    [ApiController]
    public class InternalFinanceController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IConfiguration _configuration;
        private readonly ILogger<InternalFinanceController> _logger;

        public InternalFinanceController(
            IUnitOfWork unitOfWork,
            IConfiguration configuration,
            ILogger<InternalFinanceController> logger)
        {
            _unitOfWork = unitOfWork;
            _configuration = configuration;
            _logger = logger;
        }

        private bool ValidateApiKey()
        {
            var configuredKey = _configuration["Rasa:ApiKey"];
            if (string.IsNullOrEmpty(configuredKey))
            {
                _logger.LogWarning("Rasa:ApiKey is not configured");
                return false;
            }

            var providedKey = Request.Headers["X-Rasa-Token"].FirstOrDefault();
            return !string.IsNullOrEmpty(providedKey) && providedKey == configuredKey;
        }

        private static InternalFinanceEntryDto MapEntry(FinanceEntry entry) => new()
        {
            Id = entry.Id.ToString(),
            Date = entry.Date.ToString("o"),
            Category = entry.Category,
            Description = entry.Description ?? string.Empty,
            Amount = entry.Amount,
            CreatedAt = entry.CreatedAt.ToString("o"),
            UpdatedAt = entry.UpdatedAt.ToString("o")
        };

        private static InternalFinanceCategoryDto MapCategory(FinanceCategory category) => new()
        {
            Id = category.Id.ToString(),
            Name = category.Name,
            CreatedAt = category.CreatedAt.ToString("o")
        };

        [HttpGet("{userId}/entries")]
        public async Task<ActionResult<IEnumerable<InternalFinanceEntryDto>>> GetEntries(
            string userId,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] string? category = null,
            [FromQuery] string? search = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            if (!ValidateApiKey())
            {
                return Unauthorized(new { message = "Invalid API key" });
            }

            page = Math.Max(1, page);
            pageSize = pageSize <= 0 || pageSize > 50 ? 10 : pageSize;

            var entries = await _unitOfWork.FinanceEntries.GetByUserAsync(
                userId,
                from,
                to,
                string.IsNullOrWhiteSpace(category) ? null : category.Trim(),
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                page,
                pageSize);

            return Ok(entries.Select(MapEntry));
        }

        [HttpGet("{userId}/entries/{entryId:int}")]
        public async Task<ActionResult<InternalFinanceEntryDto>> GetEntry(string userId, int entryId)
        {
            if (!ValidateApiKey())
            {
                return Unauthorized(new { message = "Invalid API key" });
            }

            var entry = await _unitOfWork.FinanceEntries.GetByUserAndIdAsync(userId, entryId);
            return entry == null ? NotFound() : Ok(MapEntry(entry));
        }

        [HttpPost("{userId}/entries")]
        public async Task<ActionResult<InternalFinanceEntryDto>> CreateEntry(
            string userId,
            [FromBody] InternalFinanceEntryRequest dto)
        {
            if (!ValidateApiKey())
            {
                return Unauthorized(new { message = "Invalid API key" });
            }

            if (dto.Amount <= 0)
            {
                return BadRequest(new { message = "Amount must be greater than zero." });
            }

            var categoryName = string.IsNullOrWhiteSpace(dto.Category)
                ? "Khac"
                : dto.Category.Trim();

            await EnsureCategoryAsync(userId, categoryName);

            var now = DateTime.UtcNow;
            var entry = new FinanceEntry
            {
                UserId = userId,
                Date = dto.Date == default ? now.Date : dto.Date,
                Category = categoryName,
                Description = dto.Description?.Trim() ?? string.Empty,
                Amount = dto.Amount,
                CreatedAt = now,
                UpdatedAt = now
            };

            await _unitOfWork.FinanceEntries.AddAsync(entry);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetEntry), new { userId, entryId = entry.Id }, MapEntry(entry));
        }

        [HttpPut("{userId}/entries/{entryId:int}")]
        public async Task<ActionResult<InternalFinanceEntryDto>> UpdateEntry(
            string userId,
            int entryId,
            [FromBody] InternalFinanceEntryRequest dto)
        {
            if (!ValidateApiKey())
            {
                return Unauthorized(new { message = "Invalid API key" });
            }

            if (dto.Amount <= 0)
            {
                return BadRequest(new { message = "Amount must be greater than zero." });
            }

            var entry = await _unitOfWork.FinanceEntries.GetByUserAndIdAsync(userId, entryId);
            if (entry == null)
            {
                return NotFound();
            }

            var categoryName = string.IsNullOrWhiteSpace(dto.Category)
                ? entry.Category
                : dto.Category.Trim();

            await EnsureCategoryAsync(userId, categoryName);

            entry.Date = dto.Date == default ? entry.Date : dto.Date;
            entry.Category = categoryName;
            entry.Description = dto.Description?.Trim() ?? string.Empty;
            entry.Amount = dto.Amount;
            entry.UpdatedAt = DateTime.UtcNow;

            _unitOfWork.FinanceEntries.Update(entry);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapEntry(entry));
        }

        [HttpDelete("{userId}/entries/{entryId:int}")]
        public async Task<IActionResult> DeleteEntry(string userId, int entryId)
        {
            if (!ValidateApiKey())
            {
                return Unauthorized(new { message = "Invalid API key" });
            }

            var entry = await _unitOfWork.FinanceEntries.GetByUserAndIdAsync(userId, entryId);
            if (entry == null)
            {
                return NotFound();
            }

            _unitOfWork.FinanceEntries.Remove(entry);
            await _unitOfWork.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("{userId}/summary")]
        public async Task<ActionResult<InternalFinanceSummaryDto>> GetSummary(
            string userId,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] string? category = null)
        {
            if (!ValidateApiKey())
            {
                return Unauthorized(new { message = "Invalid API key" });
            }

            var (totalAmount, count, dailyTotals) = await _unitOfWork.FinanceEntries.GetSummaryAsync(
                userId,
                from,
                to,
                string.IsNullOrWhiteSpace(category) ? null : category.Trim());

            return Ok(new InternalFinanceSummaryDto
            {
                TotalAmount = totalAmount,
                Count = count,
                AverageAmount = count == 0 ? 0 : decimal.Round(totalAmount / count, 2),
                DailyTotals = dailyTotals.Select(item => new InternalFinanceDailyDto
                {
                    Date = item.date.ToString("o"),
                    TotalAmount = item.totalAmount
                }).ToList()
            });
        }

        [HttpGet("{userId}/categories")]
        public async Task<ActionResult<IEnumerable<InternalFinanceCategoryDto>>> GetCategories(string userId)
        {
            if (!ValidateApiKey())
            {
                return Unauthorized(new { message = "Invalid API key" });
            }

            var categories = await _unitOfWork.FinanceCategories.GetByUserAsync(userId);
            return Ok(categories.Select(MapCategory));
        }

        [HttpPost("{userId}/categories")]
        public async Task<ActionResult<InternalFinanceCategoryDto>> CreateCategory(
            string userId,
            [FromBody] InternalFinanceCategoryRequest dto)
        {
            if (!ValidateApiKey())
            {
                return Unauthorized(new { message = "Invalid API key" });
            }

            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                return BadRequest(new { message = "Category name is required." });
            }

            var category = await EnsureCategoryAsync(userId, dto.Name.Trim());
            await _unitOfWork.SaveChangesAsync();
            return Ok(MapCategory(category));
        }

        [HttpPut("{userId}/categories/{categoryId:int}")]
        public async Task<ActionResult<InternalFinanceCategoryDto>> UpdateCategory(
            string userId,
            int categoryId,
            [FromBody] InternalFinanceCategoryRequest dto)
        {
            if (!ValidateApiKey())
            {
                return Unauthorized(new { message = "Invalid API key" });
            }

            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                return BadRequest(new { message = "Category name is required." });
            }

            var category = await _unitOfWork.FinanceCategories.GetByUserAndIdAsync(userId, categoryId);
            if (category == null)
            {
                return NotFound();
            }

            var name = dto.Name.Trim();
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

            return Ok(MapCategory(category));
        }

        [HttpDelete("{userId}/categories/{categoryId:int}")]
        public async Task<IActionResult> DeleteCategory(string userId, int categoryId)
        {
            if (!ValidateApiKey())
            {
                return Unauthorized(new { message = "Invalid API key" });
            }

            var category = await _unitOfWork.FinanceCategories.GetByUserAndIdAsync(userId, categoryId);
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

        private async Task<FinanceCategory> EnsureCategoryAsync(string userId, string name)
        {
            var existing = await _unitOfWork.FinanceCategories.GetByUserAndNameAsync(userId, name);
            if (existing != null)
            {
                return existing;
            }

            var category = new FinanceCategory
            {
                UserId = userId,
                Name = name,
                CreatedAt = DateTime.UtcNow
            };
            await _unitOfWork.FinanceCategories.AddAsync(category);
            return category;
        }
    }

    public class InternalFinanceEntryRequest
    {
        public DateTime Date { get; set; }
        public string? Category { get; set; }
        public string? Description { get; set; }
        public decimal Amount { get; set; }
    }

    public class InternalFinanceEntryDto
    {
        public string Id { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string CreatedAt { get; set; } = string.Empty;
        public string UpdatedAt { get; set; } = string.Empty;
    }

    public class InternalFinanceCategoryRequest
    {
        public string Name { get; set; } = string.Empty;
    }

    public class InternalFinanceCategoryDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string CreatedAt { get; set; } = string.Empty;
    }

    public class InternalFinanceDailyDto
    {
        public string Date { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
    }

    public class InternalFinanceSummaryDto
    {
        public decimal TotalAmount { get; set; }
        public int Count { get; set; }
        public decimal AverageAmount { get; set; }
        public List<InternalFinanceDailyDto> DailyTotals { get; set; } = new();
    }
}
