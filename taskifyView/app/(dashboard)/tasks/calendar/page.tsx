"use client"

import React, { useState, useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { useTaskActions } from "@/hooks/use-task-actions"
import { TaskModal } from "@/components/task/task-modal"
import { TaskDetailDialog } from "@/components/task/task-detail-dialog"
import { DeleteDialog } from "@/components/task/delete-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn, getDueDatePart, getDueTimePart } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function formatDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function isToday(date: Date) {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "high": return "bg-red-500"
    case "medium": return "bg-yellow-500"
    case "low": return "bg-green-500"
    default: return "bg-slate-500"
  }
}

function getLabelColor(task: Task) {
  return task.labels?.[0]?.color ?? null
}

export default function CalendarTasksPage() {
  const { tasks, updateTaskDueDate } = useTaskStore()
  const {
    modalOpen, setModalOpen,
    modalMode,
    selectedTask,
    detailDialogOpen, setDetailDialogOpen,
    detailTask,
    deleteDialogOpen, setDeleteDialogOpen,
    taskToDelete,
    openDetail,
    handleEditFromDetail,
    handleDeleteFromDetail,
    handleConfirmDelete,
    handleSaveTask,
  } = useTaskActions()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"month" | "week">("month")
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)

  // Calendar day generation
  const days = useMemo(() => {
    if (viewMode === "month") {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      const startingDay = firstDay.getDay()
      const prevMonthLastDay = new Date(year, month, 0).getDate()

      const result: { date: Date; isCurrentMonth: boolean }[] = []

      for (let i = startingDay - 1; i >= 0; i--) {
        result.push({ date: new Date(year, month - 1, prevMonthLastDay - i), isCurrentMonth: false })
      }
      for (let i = 1; i <= lastDay.getDate(); i++) {
        result.push({ date: new Date(year, month, i), isCurrentMonth: true })
      }
      const remaining = 42 - result.length
      for (let i = 1; i <= remaining; i++) {
        result.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
      }
      return result
    } else {
      const startOfWeek = new Date(currentDate)
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
      return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(startOfWeek)
        day.setDate(startOfWeek.getDate() + i)
        return { date: day, isCurrentMonth: day.getMonth() === currentDate.getMonth() }
      })
    }
  }, [currentDate, viewMode])

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {}
    tasks.forEach((task) => {
      const key = getDueDatePart(task.dueDate)
      if (!map[key]) map[key] = []
      map[key].push(task)
    })
    return map
  }, [tasks])

  // Navigation
  const navigate = (dir: "prev" | "next") => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      if (viewMode === "month") d.setMonth(prev.getMonth() + (dir === "next" ? 1 : -1))
      else d.setDate(prev.getDate() + (dir === "next" ? 7 : -7))
      return d
    })
  }

  // Open create modal for a specific date
  const handleDateClick = (dateKey: string) => {
    setSelectedDate(dateKey)
    setModalOpen(true)
  }

  // Drag & drop
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = "move"
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }
  const handleDrop = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault()
    if (draggedTask && getDueDatePart(draggedTask.dueDate) !== dateKey) {
      updateTaskDueDate(draggedTask.id, dateKey, getDueTimePart(draggedTask.dueDate))
    }
    setDraggedTask(null)
  }

  // Calendar-specific save: inject selectedDate into the task when creating
  const handleCalendarSave = async (taskData: Omit<Task, "id" | "createdAt">) => {
    await handleSaveTask(taskData, (data) => ({
      ...data,
      dueDate: selectedDate ? `${selectedDate}T23:59:59` : data.dueDate,
    }))
    setSelectedDate(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-foreground">
            {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => navigate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-border">
            <Button
              variant={viewMode === "month" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
              className="rounded-r-none"
            >
              Month
            </Button>
            <Button
              variant={viewMode === "week" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className="rounded-l-none"
            >
              Week
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/50">
          {DAY_NAMES.map((day) => (
            <div key={day} className="py-3 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className={cn("grid grid-cols-7", viewMode === "month" ? "grid-rows-6" : "grid-rows-1")}>
          {days.map(({ date, isCurrentMonth }, index) => {
            const dateKey = formatDateKey(date)
            const dayTasks = tasksByDate[dateKey] || []
            const maxVisible = viewMode === "week" ? 10 : 3

            return (
              <div
                key={index}
                onClick={() => handleDateClick(dateKey)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, dateKey)}
                className={cn(
                  "min-h-[100px] border-b border-r border-border p-2 transition-colors cursor-pointer",
                  !isCurrentMonth && "bg-muted/30",
                  draggedTask && "hover:bg-accent/10"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDateClick(dateKey) }}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                      isToday(date) && "bg-accent text-accent-foreground font-semibold",
                      !isCurrentMonth && "text-muted-foreground"
                    )}
                  >
                    {date.getDate()}
                  </button>
                </div>

                <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                  {dayTasks.slice(0, maxVisible).map((task) => (
                    <button
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onClick={(e) => { e.stopPropagation(); openDetail(task) }}
                      className={cn(
                        "w-full text-left rounded px-2 py-1 text-xs truncate transition-colors cursor-grab active:cursor-grabbing",
                        task.status === "completed"
                          ? "bg-muted text-muted-foreground line-through"
                          : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block w-1.5 h-1.5 rounded-full mr-1.5",
                          getLabelColor(task) ? "" : getPriorityColor(task.priority)
                        )}
                        style={getLabelColor(task) ? { backgroundColor: getLabelColor(task) ?? undefined } : undefined}
                      />
                      {task.title}
                    </button>
                  ))}
                  {dayTasks.length > maxVisible && (
                    <p className="text-xs text-muted-foreground px-2">
                      +{dayTasks.length - maxVisible} more
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Modals */}
      <TaskDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        task={detailTask}
        onEdit={handleEditFromDetail}
        onDelete={handleDeleteFromDetail}
      />
      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={selectedTask}
        onSave={handleCalendarSave}
        mode={modalMode}
        initialDueDate={selectedDate}
      />
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        taskTitle={taskToDelete?.title || ""}
      />
    </div>
  )
}
