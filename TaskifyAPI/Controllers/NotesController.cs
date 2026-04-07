using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using TaskifyAPI.Model;
using TaskifyAPI.Model.ViewModel;
using TaskifyAPI.Repositories.IRepositories;

namespace TaskifyAPI.Controllers
{
    /// <summary>
    /// CRUD controller for personal notes (JWT protected).
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class NotesController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<NotesController> _logger;

        public NotesController(IUnitOfWork unitOfWork, ILogger<NotesController> logger)
        {
            _unitOfWork = unitOfWork;
            _logger = logger;
        }

        private string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

        private static NoteResponseDto MapToDto(Note note) => new()
        {
            Id = note.Id.ToString(),
            Title = note.Title,
            Content = note.Content,
            IsPinned = note.IsPinned,
            CreatedAt = note.CreatedAt.ToString("o"),
            UpdatedAt = note.UpdatedAt.ToString("o")
        };

        [HttpGet]
        public async Task<ActionResult<IEnumerable<NoteResponseDto>>> GetAll(
            [FromQuery] string? search = null,
            [FromQuery] bool? pinned = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var userId = GetUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            page = Math.Max(1, page);
            pageSize = pageSize <= 0 || pageSize > 100 ? 20 : pageSize;

            IEnumerable<Note> notes;
            if (!string.IsNullOrWhiteSpace(search))
            {
                notes = await _unitOfWork.Notes.SearchAsync(userId, search, page, pageSize, pinned);
            }
            else
            {
                notes = await _unitOfWork.Notes.GetByUserAsync(userId, pinned, page, pageSize);
            }

            return Ok(notes.Select(MapToDto));
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<NoteResponseDto>> GetById(int id)
        {
            var userId = GetUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var note = await _unitOfWork.Notes.GetByIdAsync(id);
            if (note == null || note.UserId != userId)
            {
                return NotFound();
            }

            return Ok(MapToDto(note));
        }

        [HttpPost]
        public async Task<ActionResult<NoteResponseDto>> Create([FromBody] CreateNoteDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userId = GetUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var note = new Note
            {
                Title = dto.Title,
                Content = dto.Content ?? string.Empty,
                IsPinned = dto.IsPinned ?? false,
                UserId = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _unitOfWork.Notes.AddAsync(note);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = note.Id }, MapToDto(note));
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<NoteResponseDto>> Update(int id, [FromBody] UpdateNoteDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userId = GetUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var note = await _unitOfWork.Notes.GetByIdAsync(id);
            if (note == null || note.UserId != userId)
            {
                return NotFound();
            }

            note.Title = dto.Title;
            note.Content = dto.Content ?? string.Empty;
            if (dto.IsPinned.HasValue)
            {
                note.IsPinned = dto.IsPinned.Value;
            }
            note.UpdatedAt = DateTime.UtcNow;

            _unitOfWork.Notes.Update(note);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapToDto(note));
        }

        [HttpPatch("{id:int}/pin")]
        public async Task<ActionResult<NoteResponseDto>> TogglePin(int id, [FromBody] bool? isPinned = null)
        {
            var userId = GetUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var note = await _unitOfWork.Notes.GetByIdAsync(id);
            if (note == null || note.UserId != userId)
            {
                return NotFound();
            }

            await _unitOfWork.Notes.TogglePinAsync(note, isPinned);
            await _unitOfWork.SaveChangesAsync();

            return Ok(MapToDto(note));
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = GetUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var note = await _unitOfWork.Notes.GetByIdAsync(id);
            if (note == null || note.UserId != userId)
            {
                return NotFound();
            }

            _unitOfWork.Notes.Remove(note);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }
    }
}
