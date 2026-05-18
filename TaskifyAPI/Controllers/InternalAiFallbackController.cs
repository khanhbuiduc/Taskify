using Microsoft.AspNetCore.Mvc;
using TaskifyAPI.Model.ViewModel;
using TaskifyAPI.Services;

namespace TaskifyAPI.Controllers
{
    [Route("api/internal/ai/fallback")]
    [ApiController]
    public class InternalAiFallbackController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly IAiFallbackService _aiFallbackService;
        private readonly ILogger<InternalAiFallbackController> _logger;

        public InternalAiFallbackController(
            IConfiguration configuration,
            IAiFallbackService aiFallbackService,
            ILogger<InternalAiFallbackController> logger)
        {
            _configuration = configuration;
            _aiFallbackService = aiFallbackService;
            _logger = logger;
        }

        [HttpPost("{userId}")]
        public async Task<ActionResult<InternalAiFallbackResponse>> GenerateFallback(
            string userId,
            [FromBody] InternalAiFallbackRequest request,
            CancellationToken cancellationToken)
        {
            if (!ValidateApiKey())
            {
                _logger.LogWarning("Invalid or missing X-Rasa-Token for AI fallback user {UserId}", userId);
                return Unauthorized(new { message = "Invalid API key" });
            }

            try
            {
                var reply = await _aiFallbackService
                    .GenerateFallbackReplyAsync(userId, request.MessageText, request.Locale ?? "en", cancellationToken)
                    .ConfigureAwait(false);
                return Ok(reply);
            }
            catch (AiFallbackNotConfiguredException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (GeminiNotConfiguredException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (GeminiInvalidApiKeyException ex)
            {
                return UnprocessableEntity(new { message = ex.Message });
            }
            catch (GeminiStoredCredentialException ex)
            {
                return UnprocessableEntity(new { message = ex.Message });
            }
            catch (GeminiValidationFailedException ex)
            {
                return StatusCode(StatusCodes.Status502BadGateway, new { message = ex.Message });
            }
            catch (OllamaStoredConfigurationException ex)
            {
                return UnprocessableEntity(new { message = ex.Message });
            }
            catch (OllamaRuntimeException ex)
            {
                return StatusCode(StatusCodes.Status502BadGateway, new { message = ex.Message });
            }
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
    }
}
