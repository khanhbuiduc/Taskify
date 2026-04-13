using Microsoft.AspNetCore.Mvc;
using TaskifyAPI.Model;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Controllers
{
    /// <summary>
    /// Internal API for Rasa to manage notes (API key via X-Rasa-Token).
    /// </summary>
    [Route("api/internal/notes")]
    [ApiController]
    public class InternalNoteController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IConfiguration _configuration;
        private readonly ILogger<InternalNoteController> _logger;

        public InternalNoteController(IUnitOfWork unitOfWork, IConfiguration configuration, ILogger<InternalNoteController> logger)
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

        private static InternalNoteDto MapToDto(Note note) => new()
        {
            Id = note.Id,
            Title = note.Title,
            Content = note.Content,
            IsPinned = note.IsPinned,
            CreatedAt = note.CreatedAt,
            UpdatedAt = note.UpdatedAt
        };

        [HttpGet("{userId}")]
        public async Task<ActionResult<IEnumerable<InternalNoteDto>>> GetRecent(
            string userId,
            [FromQuery] int limit = 5,
            [FromQuery] string? search = null)
        {
            if (!ValidateApiKey())
            {
                return Unauthorized(new { message = "Invalid API key" });
            }

            limit = limit <= 0 || limit > 50 ? 5 : limit;

            IEnumerable<Note> notes;
            if (!string.IsNullOrWhiteSpace(search))
            {
                notes = await _unitOfWork.Notes.SearchAsync(userId, search, 1, limit, null);
            }
            else
            {
                notes = await _unitOfWork.Notes.GetRecentAsync(userId, limit);
            }

            return Ok(notes.Select(MapToDto));
        }

        [HttpPost("{userId}")]
        public async Task<ActionResult<InternalNoteDto>> Create(string userId, [FromBody] InternalCreateNoteDto dto)
        {
            if (!ValidateApiKey())
            {
                return Unauthorized(new { message = "Invalid API key" });
            }

            if (string.IsNullOrWhiteSpace(dto.Title))
            {
                dto.Title = (dto.Content ?? "New note").Trim();
                if (dto.Title.Length > 80)
                {
                    dto.Title = dto.Title[..80];
                }
            }

            var note = new Note
            {
                Title = dto.Title ?? "New note",
                Content = dto.Content ?? string.Empty,
                IsPinned = dto.IsPinned ?? false,
                UserId = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _unitOfWork.Notes.AddAsync(note);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetRecent), new { userId }, MapToDto(note));
        }

        [HttpPatch("{userId}/{noteId:int}/pin")]
        public async Task<ActionResult<InternalNoteDto>> TogglePin(string userId, int noteId, [FromBody] bool? isPinned = null)
        {
            if (!ValidateApiKey())
            {
                return Unauthorized(new { message = "Invalid API key" });
            }

            var note = await _unitOfWork.Notes.GetByIdAsync(noteId);
            if (note == null || note.UserId != userId)
            {
                return NotFound();
            }

            await _unitOfWork.Notes.TogglePinAsync(note, isPinned);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapToDto(note));
        }
        [HttpPut("{userId}/{noteId:int}")]
        public async Task<ActionResult<InternalNoteDto>> Update(string userId, int noteId, [FromBody] InternalCreateNoteDto dto)
        {
            if (!ValidateApiKey())
                return Unauthorized(new { message = "Invalid API key" });

            var note = await _unitOfWork.Notes.GetByIdAsync(noteId);
            if (note == null || note.UserId != userId)
                return NotFound();

            if (dto.Title != null) note.Title = dto.Title;
            if (dto.Content != null) note.Content = dto.Content;
            if (dto.IsPinned.HasValue) note.IsPinned = dto.IsPinned.Value;
            
            note.UpdatedAt = DateTime.UtcNow;

            _unitOfWork.Notes.Update(note);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapToDto(note));
        }

        [HttpDelete("{userId}/{noteId:int}")]
        public async Task<IActionResult> Delete(string userId, int noteId)
        {
            if (!ValidateApiKey())
                return Unauthorized(new { message = "Invalid API key" });

            var note = await _unitOfWork.Notes.GetByIdAsync(noteId);
            if (note == null || note.UserId != userId)
                return NotFound();

            _unitOfWork.Notes.Remove(note);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }
    }

    #region DTOs
    public class InternalNoteDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public bool IsPinned { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class InternalCreateNoteDto
    {
        public string? Title { get; set; }
        public string? Content { get; set; }
        public bool? IsPinned { get; set; }
    }
    #endregion
}
