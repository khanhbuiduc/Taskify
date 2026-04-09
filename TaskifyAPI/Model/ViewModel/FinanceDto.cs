using System.ComponentModel.DataAnnotations;

namespace TaskifyAPI.Model.ViewModel
{
    public class CreateFinanceEntryDto
    {
        [Required]
        public DateTime Date { get; set; }

        [Required]
        [MaxLength(60)]
        public string Category { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        [Range(typeof(decimal), "0.01", "79228162514264337593543950335")]
        public decimal Amount { get; set; }
    }

    public class UpdateFinanceEntryDto
    {
        [Required]
        public DateTime Date { get; set; }

        [Required]
        [MaxLength(60)]
        public string Category { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        [Range(typeof(decimal), "0.01", "79228162514264337593543950335")]
        public decimal Amount { get; set; }
    }

    public class FinanceEntryResponseDto
    {
        public string Id { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string CreatedAt { get; set; } = string.Empty;
        public string UpdatedAt { get; set; } = string.Empty;
    }

    public class FinanceSummaryDailyDto
    {
        public string Date { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
    }

    public class FinanceSummaryResponseDto
    {
        public decimal TotalAmount { get; set; }
        public int Count { get; set; }
        public decimal AverageAmount { get; set; }
        public List<FinanceSummaryDailyDto> DailyTotals { get; set; } = new();
    }

    public class CreateFinanceCategoryDto
    {
        [Required]
        [MaxLength(60)]
        public string Name { get; set; } = string.Empty;
    }

    public class UpdateFinanceCategoryDto
    {
        [Required]
        [MaxLength(60)]
        public string Name { get; set; } = string.Empty;
    }

    public class FinanceCategoryResponseDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string CreatedAt { get; set; } = string.Empty;
    }
}
