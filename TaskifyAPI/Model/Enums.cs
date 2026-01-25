namespace TaskifyAPI.Model
{
    /// <summary>
    /// Task priority levels matching frontend: "low" | "medium" | "high"
    /// </summary>
    public enum TaskPriority
    {
        Low = 0,
        Medium = 1,
        High = 2
    }

    /// <summary>
    /// Task status values matching frontend: "todo" | "in-progress" | "completed"
    /// </summary>
    public enum TaskItemStatus
    {
        Todo = 0,
        InProgress = 1,
        Completed = 2
    }
}
