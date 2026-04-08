"use client"

import React from "react"
import { cn, stripHtml, formatDueDisplay, isOverdue } from "@/lib/utils"
import type { Task } from "@/lib/types"
import { PriorityBadge } from "./priority-badge"
import { LabelBadge } from "./label-badge"
import { CheckCircle2, Circle, Calendar } from "lucide-react"

interface TaskCardProps {
  task: Task
  variant?: "list" | "grid"
  onClick?: (task: Task) => void
  onStatusToggle?: (task: Task) => void
  onLabelClick?: (labelId: number, e: React.MouseEvent) => void
  onDragStart?: (e: React.DragEvent, task: Task) => void
  className?: string
}

export function TaskCard({
  task,
  variant = "grid",
  onClick,
  onStatusToggle,
  onLabelClick,
  onDragStart,
  className,
}: TaskCardProps) {
  const isCompleted = task.status === "completed"
  const overdue = isOverdue(task.dueDate, task.status)

  if (variant === "list") {
    return (
      <div
        onClick={() => onClick?.(task)}
        className={cn(
          "group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm transition-all hover:bg-muted/50 cursor-pointer",
          isCompleted && "opacity-60",
          className
        )}
      >
        {onStatusToggle && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onStatusToggle(task)
            }}
            className="shrink-0"
          >
            {isCompleted ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 hover:text-green-400 transition-colors" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground hover:text-accent transition-colors" />
            )}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "font-medium text-foreground truncate",
              isCompleted && "line-through"
            )}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="text-sm text-muted-foreground truncate">
              {stripHtml(task.description)}
            </p>
          )}
          {task.labels?.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {task.labels.map((label) => (
                <LabelBadge key={label.id} label={label} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PriorityBadge priority={task.priority} />
          <div
            className={cn(
              "flex items-center gap-1 text-xs",
              overdue ? "text-destructive" : "text-muted-foreground"
            )}
          >
            <Calendar className="h-3 w-3" />
            {formatDueDisplay(task.dueDate)}
          </div>
        </div>
      </div>
    )
  }

  // Grid / Column version
  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart ? (e) => onDragStart(e, task) : undefined}
      onClick={() => onClick?.(task)}
      className={cn(
        "group rounded-lg border border-border bg-card p-3 transition-all cursor-pointer hover:bg-muted/50",
        isCompleted && "opacity-60",
        className
      )}
    >
      <p
        className={cn(
          "text-sm font-medium text-foreground line-clamp-2",
          isCompleted && "line-through"
        )}
      >
        {task.title}
      </p>
      {task.labels?.length ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <LabelBadge key={label.id} label={label} />
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-2">
        <PriorityBadge priority={task.priority} />
        <span
          className={cn(
            "text-xs",
            overdue ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {formatDueDisplay(task.dueDate)}
        </span>
      </div>
    </div>
  )
}
