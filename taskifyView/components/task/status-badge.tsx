import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/lib/types"

interface StatusBadgeProps {
  status: TaskStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const labels: Record<TaskStatus, string> = {
    todo: "Todo",
    "in-progress": "In Progress",
    completed: "Completed",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        status === "todo" && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        status === "in-progress" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        status === "completed" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        className
      )}
    >
      {labels[status]}
    </span>
  )
}
