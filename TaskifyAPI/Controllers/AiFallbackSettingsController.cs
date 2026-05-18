using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskifyAPI.Model.ViewModel;
using TaskifyAPI.Services;

namespace TaskifyAPI.Controllers
{
    [Route("api/settings/ai")]
    [ApiController]
    [Authorize]
    public class AiFallbackSettingsController : ControllerBase
    {
        private readonly IAiFallbackService _aiFallbackService;

        public AiFallbackSettingsController(IAiFallbackService aiFallbackService)
        {
            _aiFallbackService = aiFallbackService;
        }

        [HttpGet("fallback")]
        public async Task<ActionResult<AiFallbackSettingsDto>> GetSettings(CancellationToken cancellationToken)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var settings = await _aiFallbackService.GetSettingsAsync(userId, cancellationToken).ConfigureAwait(false);
            return Ok(settings);
        }

        [HttpPut("fallback/provider")]
        public async Task<ActionResult<AiFallbackSettingsDto>> SaveActiveProvider(
            [FromBody] SaveActiveProviderRequest request,
            CancellationToken cancellationToken)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            try
            {
                var settings = await _aiFallbackService
                    .SaveActiveProviderAsync(userId, request.Provider, cancellationToken)
                    .ConfigureAwait(false);
                return Ok(settings);
            }
            catch (GeminiInvalidApiKeyException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (AiFallbackNotConfiguredException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (OllamaValidationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (OllamaStoredConfigurationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("ollama/models")]
        public async Task<ActionResult<OllamaModelListResponse>> LoadOllamaModels(
            [FromBody] LoadOllamaModelsRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var models = await _aiFallbackService
                    .GetOllamaModelsAsync(request.BaseUrl, cancellationToken)
                    .ConfigureAwait(false);
                return Ok(new OllamaModelListResponse { Models = models });
            }
            catch (OllamaValidationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("ollama")]
        public async Task<ActionResult<AiFallbackSettingsDto>> SaveOllamaSettings(
            [FromBody] SaveOllamaSettingsRequest request,
            CancellationToken cancellationToken)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            try
            {
                var settings = await _aiFallbackService
                    .SaveOllamaSettingsAsync(userId, request.BaseUrl, request.Model, cancellationToken)
                    .ConfigureAwait(false);
                return Ok(settings);
            }
            catch (OllamaValidationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("ollama")]
        public async Task<ActionResult<AiFallbackSettingsDto>> DeleteOllamaSettings(CancellationToken cancellationToken)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var settings = await _aiFallbackService.DeleteOllamaSettingsAsync(userId, cancellationToken).ConfigureAwait(false);
            return Ok(settings);
        }
    }
}
