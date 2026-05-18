using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskifyAPI.Model.ViewModel;
using TaskifyAPI.Services;

namespace TaskifyAPI.Controllers
{
    [Route("api/settings/ai/gemini")]
    [ApiController]
    [Authorize]
    public class GeminiSettingsController : ControllerBase
    {
        private readonly IGeminiCredentialService _geminiCredentialService;
        private readonly IAiFallbackService _aiFallbackService;

        public GeminiSettingsController(
            IGeminiCredentialService geminiCredentialService,
            IAiFallbackService aiFallbackService)
        {
            _geminiCredentialService = geminiCredentialService;
            _aiFallbackService = aiFallbackService;
        }

        [HttpGet]
        public async Task<ActionResult<GeminiCredentialStatusDto>> GetStatus(CancellationToken cancellationToken)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var status = await _geminiCredentialService.GetStatusAsync(userId, cancellationToken).ConfigureAwait(false);
            return Ok(status);
        }

        [HttpPut]
        public async Task<ActionResult<GeminiCredentialStatusDto>> Save(
            [FromBody] SaveGeminiCredentialRequest request,
            CancellationToken cancellationToken)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            try
            {
                var status = await _geminiCredentialService
                    .SaveApiKeyAsync(userId, request.ApiKey, cancellationToken)
                    .ConfigureAwait(false);
                return Ok(status);
            }
            catch (GeminiInvalidApiKeyException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (GeminiValidationFailedException ex)
            {
                return StatusCode(StatusCodes.Status502BadGateway, new { message = ex.Message });
            }
        }

        [HttpDelete]
        public async Task<ActionResult<GeminiCredentialStatusDto>> Delete(CancellationToken cancellationToken)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var status = await _geminiCredentialService.DeleteAsync(userId, cancellationToken).ConfigureAwait(false);
            await _aiFallbackService.HandleGeminiDeletedAsync(userId, cancellationToken).ConfigureAwait(false);
            return Ok(status);
        }
    }
}
