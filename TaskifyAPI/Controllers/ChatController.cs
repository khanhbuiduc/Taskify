using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
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

        public ChatController(IRasaChatService rasaChatService)
        {
            _rasaChatService = rasaChatService;
        }

        /// <summary>
        /// Send a message to the assistant and get replies (proxied to Rasa).
        /// </summary>
        /// <param name="dto">Request body with Message.</param>
        /// <param name="cancellationToken">Cancellation token.</param>
        /// <returns>List of assistant message texts.</returns>
        [HttpPost]
        public async Task<ActionResult<ChatResponseDto>> Post([FromBody] ChatRequestDto dto, CancellationToken cancellationToken)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var texts = await _rasaChatService.SendMessageAsync(userId, dto.Message, cancellationToken).ConfigureAwait(false);
            var messages = texts.Select(t => new ChatMessageDto { Text = t }).ToList();

            return Ok(new ChatResponseDto { Messages = messages });
        }
    }
}
