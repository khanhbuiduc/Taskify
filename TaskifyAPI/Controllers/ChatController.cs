using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TaskifyAPI.Data;
using TaskifyAPI.Model;
using TaskifyAPI.Model.ViewModel;
using TaskifyAPI.Services;

namespace TaskifyAPI.Controllers
{
    /// <summary>
    /// Proxies chat to Rasa. Requires JWT; uses current user ID as conversation sender.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private readonly IRasaChatService _rasaChatService;
        private readonly ApplicationDbContext _dbContext;

        public ChatController(IRasaChatService rasaChatService, ApplicationDbContext dbContext)
        {
            _rasaChatService = rasaChatService;
            _dbContext = dbContext;
        }

        [HttpGet("sessions")]
        public async Task<ActionResult<IReadOnlyList<ChatSessionDto>>> GetSessions(CancellationToken cancellationToken)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var sessions = await _dbContext.ChatSessions
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.UpdatedAt)
                .Select(s => new ChatSessionDto
                {
                    Id = s.Id,
                    Title = s.Title,
                    CreatedAt = s.CreatedAt,
                    UpdatedAt = s.UpdatedAt
                })
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            return Ok(sessions);
        }

        [HttpGet("{sessionId:guid}/messages")]
        public async Task<ActionResult<ChatThreadDto>> GetMessages(Guid sessionId, [FromQuery] int page = 1, [FromQuery] int pageSize = 30, CancellationToken cancellationToken = default)
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 100) pageSize = 30;

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var session = await _dbContext.ChatSessions
                .Where(s => s.Id == sessionId && s.UserId == userId)
                .FirstOrDefaultAsync(cancellationToken)
                .ConfigureAwait(false);

            if (session == null)
                return NotFound();

            var messages = await _dbContext.ChatMessages
                .Where(m => m.SessionId == session.Id)
                .OrderByDescending(m => m.SentAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(m => new ChatMessageDto
                {
                    Id = m.Id,
                    Role = m.Role,
                    Text = m.Text,
                    SentAt = m.SentAt
                })
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            var dto = new ChatThreadDto
            {
                Session = new ChatSessionDto
                {
                    Id = session.Id,
                    Title = session.Title,
                    CreatedAt = session.CreatedAt,
                    UpdatedAt = session.UpdatedAt
                },
                Messages = messages
            };

            return Ok(dto);
        }

        /// <summary>
        /// Send a message to the assistant within a session (creates session if missing).
        /// </summary>
        [HttpPost("{sessionId:guid}/messages")]
        public async Task<ActionResult<ChatThreadDto>> Post(Guid sessionId, [FromBody] ChatRequestDto dto, CancellationToken cancellationToken)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            if (string.IsNullOrWhiteSpace(dto.Message))
                return BadRequest("Message is required.");

            var now = DateTime.UtcNow;
            var session = await _dbContext.ChatSessions
                .Where(s => s.Id == sessionId && s.UserId == userId)
                .FirstOrDefaultAsync(cancellationToken)
                .ConfigureAwait(false);

            if (session == null)
            {
                session = new ChatSession
                {
                    Id = sessionId,
                    UserId = userId,
                    Title = dto.Message.Length > 80 ? dto.Message[..80] : dto.Message,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                await _dbContext.ChatSessions.AddAsync(session, cancellationToken).ConfigureAwait(false);
            }

            session.UpdatedAt = now;

            var userMessage = new ChatMessage
            {
                Id = Guid.NewGuid(),
                SessionId = session.Id,
                Role = ChatMessageRole.User,
                Text = dto.Message,
                SentAt = now
            };
            await _dbContext.ChatMessages.AddAsync(userMessage, cancellationToken).ConfigureAwait(false);
            await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

            var senderId = $"{userId}:{session.Id}";
            var texts = await _rasaChatService.SendMessageAsync(senderId, dto.Message, cancellationToken).ConfigureAwait(false);

            var assistantMessages = new List<ChatMessage>();
            foreach (var text in texts)
            {
                assistantMessages.Add(new ChatMessage
                {
                    Id = Guid.NewGuid(),
                    SessionId = session.Id,
                    Role = ChatMessageRole.Assistant,
                    Text = text,
                    SentAt = DateTime.UtcNow
                });
            }

            if (assistantMessages.Count > 0)
            {
                await _dbContext.ChatMessages.AddRangeAsync(assistantMessages, cancellationToken).ConfigureAwait(false);
                session.UpdatedAt = assistantMessages.Max(m => m.SentAt);
                await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            }

            var response = new ChatThreadDto
            {
                Session = new ChatSessionDto
                {
                    Id = session.Id,
                    Title = session.Title,
                    CreatedAt = session.CreatedAt,
                    UpdatedAt = session.UpdatedAt
                },
                Messages = new[]
                {
                    new ChatMessageDto
                    {
                        Id = userMessage.Id,
                        Role = userMessage.Role,
                        Text = userMessage.Text,
                        SentAt = userMessage.SentAt
                    }
                }
                .Concat(assistantMessages.Select(m => new ChatMessageDto
                {
                    Id = m.Id,
                    Role = m.Role,
                    Text = m.Text,
                    SentAt = m.SentAt
                }))
                .ToList()
            };

            return Ok(response);
        }
    }
}
