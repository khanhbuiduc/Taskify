"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PriorityBadge } from "./priority-badge"
import { StatusBadge } from "./status-badge"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types"
import { Pencil, Trash2 } from "lucide-react"

interface TaskDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  onEdit: () => void
  onDelete: () => void
}

export function TaskDetailDialog({ open, onOpenChange, task, onEdit, onDelete }: TaskDetailDialogProps) {
  if (!task) return null

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className={cn(
              "flex-1",
              task.status === "completed" && "line-through text-muted-foreground"
            )}>
              {task.title}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={onEdit}
                className="h-8 w-8"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={onDelete}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {task.description && (
            <div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Priority:</span>
              <PriorityBadge priority={task.priority} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <StatusBadge status={task.status} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Due Date:</span>
              <span className="text-sm">{formatDate(task.dueDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Created:</span>
              <span className="text-sm">{formatDate(task.createdAt)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
