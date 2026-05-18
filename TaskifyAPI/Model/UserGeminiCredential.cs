using System.ComponentModel.DataAnnotations;

namespace TaskifyAPI.Model
{
    public enum GeminiCredentialStatus
    {
        NotConfigured,
        Valid,
        Invalid,
        ValidationFailed
    }

    public class UserGeminiCredential
    {
        [Key]
        [MaxLength(450)]
        public string UserId { get; set; } = string.Empty;

        [Required]
        [MaxLength(4000)]
        public string EncryptedApiKey { get; set; } = string.Empty;

        [Required]
        public GeminiCredentialStatus Status { get; set; } = GeminiCredentialStatus.Valid;

        public DateTime? LastValidatedAtUtc { get; set; }

        [MaxLength(1000)]
        public string? LastValidationError { get; set; }

        public DateTime CreatedAtUtc { get; set; }

        public DateTime UpdatedAtUtc { get; set; }

        public ApplicationUser? User { get; set; }
    }
}
