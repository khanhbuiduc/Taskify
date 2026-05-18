using System.ComponentModel.DataAnnotations;
using TaskifyAPI.Model;

namespace TaskifyAPI.Model.ViewModel
{
    public class GeminiCredentialStatusDto
    {
        public bool Configured { get; set; }
        public GeminiCredentialStatus Status { get; set; }
        public DateTime? LastValidatedAtUtc { get; set; }
        public string? LastValidationError { get; set; }
    }

    public class SaveGeminiCredentialRequest
    {
        [Required]
        [MaxLength(500)]
        public string ApiKey { get; set; } = string.Empty;
    }

    public class InternalGeminiFallbackRequest
    {
        [Required]
        [MaxLength(4000)]
        public string MessageText { get; set; } = string.Empty;

        [MaxLength(20)]
        public string? Locale { get; set; }
    }

    public class InternalGeminiFallbackResponse
    {
        public string Text { get; set; } = string.Empty;
    }

    public class OllamaSettingsStatusDto
    {
        public bool Configured { get; set; }
        public string? BaseUrl { get; set; }
        public string? Model { get; set; }
        public DateTime? LastValidatedAtUtc { get; set; }
        public string? LastValidationError { get; set; }
    }

    public class AiFallbackSettingsDto
    {
        public AiProvider? ActiveProvider { get; set; }
        public GeminiCredentialStatusDto Gemini { get; set; } = new();
        public OllamaSettingsStatusDto Ollama { get; set; } = new();
    }

    public class SaveActiveProviderRequest
    {
        [Required]
        public AiProvider Provider { get; set; }
    }

    public class LoadOllamaModelsRequest
    {
        [Required]
        [MaxLength(1000)]
        public string BaseUrl { get; set; } = string.Empty;
    }

    public class SaveOllamaSettingsRequest
    {
        [Required]
        [MaxLength(1000)]
        public string BaseUrl { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string Model { get; set; } = string.Empty;
    }

    public class OllamaModelSummaryDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Family { get; set; }
        public string? ParameterSize { get; set; }
        public string? QuantizationLevel { get; set; }
    }

    public class OllamaModelListResponse
    {
        public IReadOnlyList<OllamaModelSummaryDto> Models { get; set; } = Array.Empty<OllamaModelSummaryDto>();
    }

    public class InternalAiFallbackRequest
    {
        [Required]
        [MaxLength(4000)]
        public string MessageText { get; set; } = string.Empty;

        [MaxLength(20)]
        public string? Locale { get; set; }
    }

    public class InternalAiFallbackResponse
    {
        public string Text { get; set; } = string.Empty;
        public AiProvider Provider { get; set; }
    }
}
