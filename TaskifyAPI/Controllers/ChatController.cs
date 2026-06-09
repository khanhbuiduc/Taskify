using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using TaskifyAPI.Data;
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
        private readonly IChatOrchestrationService _chatOrchestrationService;
        private readonly ApplicationDbContext _dbContext;
        private readonly ILogger<ChatController> _logger;

        public ChatController(
            IChatOrchestrationService chatOrchestrationService,
            ApplicationDbContext dbContext,
            ILogger<ChatController> logger)
        {
            _chatOrchestrationService = chatOrchestrationService;
            _dbContext = dbContext;
            _logger = logger;
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
                    MetadataJson = m.MetadataJson,
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

            var result = await _chatOrchestrationService
                .ProcessMessageAsync(sessionId, userId, dto, cancellationToken: cancellationToken)
                .ConfigureAwait(false);

            var response = new ChatThreadDto
            {
                Session = new ChatSessionDto
                {
                    Id = result.Session.Id,
                    Title = result.Session.Title,
                    CreatedAt = result.Session.CreatedAt,
                    UpdatedAt = result.Session.UpdatedAt
                },
                Messages = new[]
                {
                    new ChatMessageDto
                    {
                        Id = result.UserMessage.Id,
                        Role = result.UserMessage.Role,
                        Text = result.UserMessage.Text,
                        MetadataJson = result.UserMessage.MetadataJson,
                        SentAt = result.UserMessage.SentAt
                    }
                }
                .Concat(result.AssistantMessages.Select(m => new ChatMessageDto
                {
                    Id = m.Id,
                    Role = m.Role,
                    Text = m.Text,
                    MetadataJson = m.MetadataJson,
                    SentAt = m.SentAt
                }))
                .ToList()
            };

            return Ok(response);
        }

        [HttpPost("{sessionId:guid}/messages/stream")]
        public async Task Stream(Guid sessionId, [FromBody] ChatRequestDto dto, CancellationToken cancellationToken)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                Response.StatusCode = StatusCodes.Status401Unauthorized;
                return;
            }

            if (string.IsNullOrWhiteSpace(dto.Message))
            {
                Response.StatusCode = StatusCodes.Status400BadRequest;
                await Response.WriteAsync("Message is required.", cancellationToken).ConfigureAwait(false);
                return;
            }

            Response.StatusCode = StatusCodes.Status200OK;
            Response.ContentType = "application/x-ndjson";
            Response.Headers.CacheControl = "no-cache";
            Response.Headers.Append("X-Accel-Buffering", "no");

            var serializerOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
            serializerOptions.Converters.Add(new JsonStringEnumConverter());

            async ValueTask WriteEventAsync(ChatStreamEventDto evt, CancellationToken token)
            {
                await Response.WriteAsync(JsonSerializer.Serialize(evt, serializerOptions), token).ConfigureAwait(false);
                await Response.WriteAsync("\n", token).ConfigureAwait(false);
                await Response.Body.FlushAsync(token).ConfigureAwait(false);
            }

            try
            {
                await _chatOrchestrationService
                    .ProcessMessageAsync(sessionId, userId, dto, WriteEventAsync, cancellationToken)
                    .ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Chat stream cancelled for session {SessionId}", sessionId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Chat stream failed for session {SessionId}", sessionId);
                if (!Response.HasStarted)
                {
                    Response.StatusCode = StatusCodes.Status500InternalServerError;
                    return;
                }

                await WriteEventAsync(new ChatStreamEventDto
                {
                    Type = "error",
                    ErrorMessage = "Failed to stream chat response."
                }, cancellationToken).ConfigureAwait(false);
            }
        }

        [HttpDelete("{sessionId:guid}")]
        public async Task<IActionResult> DeleteSession(Guid sessionId, CancellationToken cancellationToken)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var session = await _dbContext.ChatSessions
                .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId, cancellationToken)
                .ConfigureAwait(false);

            if (session == null)
                return NotFound();

            var messages = await _dbContext.ChatMessages
                .Where(m => m.SessionId == sessionId)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            _dbContext.ChatMessages.RemoveRange(messages);
            _dbContext.ChatSessions.Remove(session);
            
            await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

            return NoContent();
        }
    }
}
