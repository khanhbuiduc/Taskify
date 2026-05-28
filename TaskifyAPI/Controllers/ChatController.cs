using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
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
        private readonly IAiFallbackService _aiFallbackService;
        private readonly IGeminiCredentialService _geminiCredentialService;
        private readonly ApplicationDbContext _dbContext;
        private readonly ILogger<ChatController> _logger;

        public ChatController(
            IRasaChatService rasaChatService,
            IAiFallbackService aiFallbackService,
            IGeminiCredentialService geminiCredentialService,
            ApplicationDbContext dbContext,
            ILogger<ChatController> logger)
        {
            _rasaChatService = rasaChatService;
            _aiFallbackService = aiFallbackService;
            _geminiCredentialService = geminiCredentialService;
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

            // Fetch history before adding the new message
            var history = await _dbContext.ChatMessages
                .Where(m => m.SessionId == session.Id)
                .OrderBy(m => m.SentAt)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            session.UpdatedAt = now;

            var normalizedMessage = await _aiFallbackService
                .NormalizeContextAsync(userId, dto.Message, history, cancellationToken)
                .ConfigureAwait(false);

            if (normalizedMessage != dto.Message)
            {
                _logger.LogInformation("Context Normalized: [{Original}] -> [{Normalized}]", dto.Message, normalizedMessage);
            }
            else
            {
                _logger.LogInformation("Context Normalization unchanged: [{Original}]", dto.Message);
            }

            var parsedIntent = await _rasaChatService
                .ParseIntentAsync(normalizedMessage, cancellationToken)
                .ConfigureAwait(false);

            var rasaMetadataJson = await BuildRasaMetadataJsonAsync(
                    userId,
                    dto.MetadataJson,
                    normalizedMessage,
                    cancellationToken)
                .ConfigureAwait(false);

            var userMessage = new ChatMessage
            {
                Id = Guid.NewGuid(),
                SessionId = session.Id,
                Role = ChatMessageRole.User,
                Text = dto.Message,
                MetadataJson = BuildStoredUserMetadataJson(rasaMetadataJson, normalizedMessage, parsedIntent),
                SentAt = now
            };
            await _dbContext.ChatMessages.AddAsync(userMessage, cancellationToken).ConfigureAwait(false);
            await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

            var senderId = $"{userId}:{session.Id}";
            var replies = await _rasaChatService
                .SendMessageAsync(senderId, normalizedMessage, rasaMetadataJson, cancellationToken)
                .ConfigureAwait(false);

            var assistantMessages = new List<ChatMessage>();
            foreach (var reply in replies)
            {
                assistantMessages.Add(new ChatMessage
                {
                    Id = Guid.NewGuid(),
                    SessionId = session.Id,
                    Role = ChatMessageRole.Assistant,
                    Text = reply.Text,
                    MetadataJson = reply.MetadataJson,
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
                        MetadataJson = userMessage.MetadataJson,
                        SentAt = userMessage.SentAt
                    }
                }
                .Concat(assistantMessages.Select(m => new ChatMessageDto
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

        private static string? BuildStoredUserMetadataJson(
            string? originalMetadataJson,
            string normalizedMessage,
            RasaParseResult? parsedIntent)
        {
            JsonObject root;

            if (string.IsNullOrWhiteSpace(originalMetadataJson))
            {
                root = new JsonObject();
            }
            else
            {
                try
                {
                    var parsed = JsonNode.Parse(originalMetadataJson);
                    root = parsed switch
                    {
                        JsonObject obj => (JsonObject)obj.DeepClone(),
                        null => new JsonObject(),
                        _ => new JsonObject { ["requestMetadata"] = parsed.DeepClone() },
                    };
                }
                catch (JsonException)
                {
                    root = new JsonObject
                    {
                        ["requestMetadataRaw"] = originalMetadataJson,
                    };
                }
            }

            var intentRanking = new JsonArray();
            if (parsedIntent?.IntentRanking is not null)
            {
                foreach (var item in parsedIntent.IntentRanking.Take(3))
                {
                    intentRanking.Add(new JsonObject
                    {
                        ["name"] = item.Name,
                        ["confidence"] = item.Confidence,
                    });
                }
            }

            var chatLog = new JsonObject
            {
                ["normalizedMessage"] = normalizedMessage,
                ["intentRanking"] = intentRanking,
            };

            if (!string.IsNullOrWhiteSpace(parsedIntent?.IntentName))
            {
                chatLog["intent"] = new JsonObject
                {
                    ["name"] = parsedIntent.IntentName,
                    ["confidence"] = parsedIntent.Confidence,
                };
            }

            root["chatLog"] = chatLog;
            return root.ToJsonString(new JsonSerializerOptions(JsonSerializerDefaults.Web));
        }

        private async Task<string?> BuildRasaMetadataJsonAsync(
            string userId,
            string? originalMetadataJson,
            string normalizedMessage,
            CancellationToken cancellationToken)
        {
            var metadata = ParseMetadataObject(originalMetadataJson);

            try
            {
                var extraction = await _geminiCredentialService
                    .ExtractEntitiesAsync(userId, normalizedMessage, cancellationToken)
                    .ConfigureAwait(false);

                if (extraction.Entities.Count > 0)
                {
                    metadata["geminiEntityExtraction"] = JsonSerializer.SerializeToNode(extraction);
                }
            }
            catch (GeminiNotConfiguredException)
            {
                // Gemini entity extraction is optional for chat parsing.
            }
            catch (GeminiInvalidApiKeyException ex)
            {
                _logger.LogWarning(ex, "Gemini entity extraction skipped due to invalid API key for user {UserId}", userId);
            }
            catch (GeminiStoredCredentialException ex)
            {
                _logger.LogWarning(ex, "Gemini entity extraction skipped due to stored credential issue for user {UserId}", userId);
            }
            catch (GeminiValidationFailedException ex)
            {
                _logger.LogWarning(ex, "Gemini entity extraction skipped due to Gemini response issue for user {UserId}", userId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Gemini entity extraction failed for user {UserId}", userId);
            }

            return metadata.Count == 0
                ? null
                : metadata.ToJsonString(new JsonSerializerOptions(JsonSerializerDefaults.Web));
        }

        private static JsonObject ParseMetadataObject(string? metadataJson)
        {
            if (string.IsNullOrWhiteSpace(metadataJson))
            {
                return new JsonObject();
            }

            try
            {
                var parsed = JsonNode.Parse(metadataJson);
                return parsed switch
                {
                    JsonObject obj => (JsonObject)obj.DeepClone(),
                    null => new JsonObject(),
                    _ => new JsonObject { ["requestMetadata"] = parsed.DeepClone() },
                };
            }
            catch (JsonException)
            {
                return new JsonObject
                {
                    ["requestMetadataRaw"] = metadataJson,
                };
            }
        }
    }
}
