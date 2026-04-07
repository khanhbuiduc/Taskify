using System.ComponentModel.DataAnnotations;

namespace TaskifyAPI.Model.ViewModel
{
    public class CreateNoteDto
    {
        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(4000)]
        public string? Content { get; set; }

        public bool? IsPinned { get; set; }
    }

    public class UpdateNoteDto
    {
        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(4000)]
        public string? Content { get; set; }

        public bool? IsPinned { get; set; }
    }

    public class NoteResponseDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public bool IsPinned { get; set; }
        public string CreatedAt { get; set; } = string.Empty;
        public string UpdatedAt { get; set; } = string.Empty;
    }
}
