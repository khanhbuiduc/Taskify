using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using TaskifyAPI.Data;
using TaskifyAPI.Model;
using TaskifyAPI.Model.ViewModel;

namespace TaskifyAPI.Services
{
    public class ChatOrchestrationService : IChatOrchestrationService
    {
        private readonly IRasaChatService _rasaChatService;
        private readonly IAiFallbackService _aiFallbackService;
        private readonly IGeminiCredentialService _geminiCredentialService;
        private readonly ApplicationDbContext _dbContext;
        private readonly ILogger<ChatOrchestrationService> _logger;

        public ChatOrchestrationService(
            IRasaChatService rasaChatService,
            IAiFallbackService aiFallbackService,
            IGeminiCredentialService geminiCredentialService,
            ApplicationDbContext dbContext,
            ILogger<ChatOrchestrationService> logger)
        {
            _rasaChatService = rasaChatService;
            _aiFallbackService = aiFallbackService;
            _geminiCredentialService = geminiCredentialService;
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<ProcessedChatTurn> ProcessMessageAsync(
            Guid sessionId,
            string userId,
            ChatRequestDto dto,
            Func<ChatStreamEventDto, CancellationToken, ValueTask>? onEvent = null,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(dto.Message))
            {
                throw new ArgumentException("Message is required.", nameof(dto));
            }

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

            await EmitAsync(onEvent, new ChatStreamEventDto
            {
                Type = "session_ready",
                Session = MapSession(session),
            }, cancellationToken).ConfigureAwait(false);

            var history = await _dbContext.ChatMessages
                .Where(m => m.SessionId == session.Id)
                .OrderBy(m => m.SentAt)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            session.UpdatedAt = now;

            await EmitStageAsync(onEvent, "normalizing_context", cancellationToken).ConfigureAwait(false);
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

            await EmitStageAsync(onEvent, "parsing_intent", cancellationToken).ConfigureAwait(false);
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

            await EmitAsync(onEvent, new ChatStreamEventDto
            {
                Type = "user_message_saved",
                Message = MapMessage(userMessage),
            }, cancellationToken).ConfigureAwait(false);

            await EmitStageAsync(onEvent, "waiting_rasa", cancellationToken).ConfigureAwait(false);
            var senderId = $"{userId}:{session.Id}";
            var replies = await _rasaChatService
                .SendMessageAsync(senderId, normalizedMessage, rasaMetadataJson, cancellationToken)
                .ConfigureAwait(false);

            await EmitStageAsync(onEvent, "persisting_reply", cancellationToken).ConfigureAwait(false);

            var assistantMessages = replies.Select(reply => new ChatMessage
            {
                Id = Guid.NewGuid(),
                SessionId = session.Id,
                Role = ChatMessageRole.Assistant,
                Text = reply.Text,
                MetadataJson = reply.MetadataJson,
                SentAt = DateTime.UtcNow
            }).ToList();

            if (assistantMessages.Count > 0)
            {
                await _dbContext.ChatMessages.AddRangeAsync(assistantMessages, cancellationToken).ConfigureAwait(false);
                session.UpdatedAt = assistantMessages.Max(m => m.SentAt);
                await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            }

            foreach (var assistantMessage in assistantMessages)
            {
                await EmitAsync(onEvent, new ChatStreamEventDto
                {
                    Type = "assistant_message_start",
                    MessageId = assistantMessage.Id.ToString(),
                    SentAt = assistantMessage.SentAt,
                }, cancellationToken).ConfigureAwait(false);

                foreach (var delta in SplitTextForStreaming(assistantMessage.Text))
                {
                    await EmitAsync(onEvent, new ChatStreamEventDto
                    {
                        Type = "assistant_message_delta",
                        MessageId = assistantMessage.Id.ToString(),
                        DeltaText = delta,
                    }, cancellationToken).ConfigureAwait(false);
                }

                await EmitAsync(onEvent, new ChatStreamEventDto
                {
                    Type = "assistant_message_complete",
                    MessageId = assistantMessage.Id.ToString(),
                    FullText = assistantMessage.Text,
                    MetadataJson = assistantMessage.MetadataJson,
                    SentAt = assistantMessage.SentAt,
                    Message = MapMessage(assistantMessage),
                }, cancellationToken).ConfigureAwait(false);
            }

            await EmitStageAsync(onEvent, "done", cancellationToken).ConfigureAwait(false);

            return new ProcessedChatTurn
            {
                Session = session,
                UserMessage = userMessage,
                AssistantMessages = assistantMessages,
            };
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

        private static async Task EmitAsync(
            Func<ChatStreamEventDto, CancellationToken, ValueTask>? onEvent,
            ChatStreamEventDto evt,
            CancellationToken cancellationToken)
        {
            if (onEvent is null)
            {
                return;
            }

            await onEvent(evt, cancellationToken).ConfigureAwait(false);
        }

        private static Task EmitStageAsync(
            Func<ChatStreamEventDto, CancellationToken, ValueTask>? onEvent,
            string stage,
            CancellationToken cancellationToken)
        {
            return EmitAsync(onEvent, new ChatStreamEventDto
            {
                Type = "stage",
                Stage = stage,
            }, cancellationToken);
        }

        private static ChatSessionDto MapSession(ChatSession session) => new()
        {
            Id = session.Id,
            Title = session.Title,
            CreatedAt = session.CreatedAt,
            UpdatedAt = session.UpdatedAt,
        };

        private static ChatMessageDto MapMessage(ChatMessage message) => new()
        {
            Id = message.Id,
            Role = message.Role,
            Text = message.Text,
            MetadataJson = message.MetadataJson,
            SentAt = message.SentAt,
        };

        private static IEnumerable<string> SplitTextForStreaming(string text)
        {
            if (string.IsNullOrEmpty(text))
            {
                yield break;
            }

            const int targetChunkSize = 24;
            var current = new System.Text.StringBuilder();

            foreach (var token in text.Split(' '))
            {
                if (current.Length == 0)
                {
                    current.Append(token);
                    continue;
                }

                if (current.Length + 1 + token.Length <= targetChunkSize)
                {
                    current.Append(' ').Append(token);
                    continue;
                }

                yield return current.ToString();
                current.Clear();
                current.Append(token);
            }

            if (current.Length > 0)
            {
                yield return current.ToString();
            }
        }
    }
}
