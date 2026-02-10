using System.ComponentModel.DataAnnotations;

namespace TaskifyAPI.Model.ViewModel
{
    /// <summary>
    /// DTO for starting a new focus session
    /// </summary>
    public class StartFocusSessionDto
    {
        [Required]
        [Range(5, 300)]
        public int DurationMinutes { get; set; } = 25;
    }

    /// <summary>
    /// DTO for ending a focus session
    /// </summary>
    public class EndFocusSessionDto
    {
        public bool IsCompleted { get; set; } = true;
        public int BreaksTaken { get; set; } = 0;
    }

    /// <summary>
    /// Response DTO for focus session
    /// </summary>
    public class FocusSessionResponseDto
    {
        public int Id { get; set; }
        public int DurationMinutes { get; set; }
        public int BreaksTaken { get; set; }
        public bool IsCompleted { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime? EndedAt { get; set; }
    }

    /// <summary>
    /// DTO for focus session statistics
    /// </summary>
    public class FocusStatsDto
    {
        public int TotalSessionsToday { get; set; }
        public int CompletedSessionsToday { get; set; }
        public int TotalMinutesToday { get; set; }
        public int TotalBreaksToday { get; set; }
        public int TotalSessionsThisWeek { get; set; }
        public int TotalMinutesThisWeek { get; set; }
    }
}
