"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PriorityBadge } from "./priority-badge"
import { StatusBadge } from "./status-badge"
import { cn, sanitizeHtml, formatDueDisplay } from "@/lib/utils"
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
  const [safeDescription, setSafeDescription] = useState<string>("")

  useEffect(() => {
    if (!task?.description) {
      setSafeDescription("")
      return
    }
    let cancelled = false
    sanitizeHtml(task.description).then((html) => {
      if (!cancelled) setSafeDescription(html)
    })
    return () => { cancelled = true }
  }, [task?.description])

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
            <div
              className="text-sm text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_a]:text-primary [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: safeDescription }}
            />
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
              <span className="text-sm">{formatDueDisplay(task.dueDate)}</span>
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
