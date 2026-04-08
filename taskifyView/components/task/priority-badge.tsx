import { cn } from "@/lib/utils"
import type { TaskPriority } from "@/lib/types"

interface PriorityBadgeProps {
  priority: TaskPriority
  className?: string
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        priority === "high" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        priority === "medium" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        priority === "low" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        className
      )}
    >
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  )
}
