using System.ComponentModel.DataAnnotations;

namespace TaskifyAPI.Model
{
    public enum AiProvider
    {
        Gemini,
        Ollama
    }

    public class UserAiFallbackSettings
    {
        [Key]
        [MaxLength(450)]
        public string UserId { get; set; } = string.Empty;

        public AiProvider? ActiveProvider { get; set; }

        [MaxLength(1000)]
        public string? OllamaBaseUrl { get; set; }

        [MaxLength(200)]
        public string? OllamaModel { get; set; }

        public DateTime? LastOllamaValidatedAtUtc { get; set; }

        [MaxLength(1000)]
        public string? LastOllamaValidationError { get; set; }

        public DateTime CreatedAtUtc { get; set; }

        public DateTime UpdatedAtUtc { get; set; }

        public ApplicationUser? User { get; set; }
    }
}
