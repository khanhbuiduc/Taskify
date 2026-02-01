"use client"

import React from "react"

import { useState, useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import type { Task, TaskStatus } from "@/lib/types"
import { TaskModal } from "./task-modal"
import { TaskDetailDialog } from "./task-detail-dialog"
import { DeleteDialog } from "./delete-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn, getDueDatePart, getDueTimePart } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

export function CalendarView() {
  const { tasks, addTask, updateTask, deleteTask, updateTaskDueDate } = useTaskStore()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"month" | "week">("month")
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days: { date: Date; isCurrentMonth: boolean }[] = []

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      })
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      })
    }

    // Next month days
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      })
    }

    return days
  }

  const getWeekDays = (date: Date) => {
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - date.getDay())

    const days: { date: Date; isCurrentMonth: boolean }[] = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      days.push({
        date: day,
        isCurrentMonth: day.getMonth() === currentDate.getMonth(),
      })
    }
    return days
  }

  const days = useMemo(() => {
    return viewMode === "month" ? getDaysInMonth(currentDate) : getWeekDays(currentDate)
  }, [currentDate, viewMode])

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {}
    tasks.forEach((task) => {
      const dateKey = getDueDatePart(task.dueDate)
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(task)
    })
    return map
  }, [tasks])

  const navigatePrev = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (viewMode === "month") {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setDate(prev.getDate() - 7)
      }
      return newDate
    })
  }

  const navigateNext = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (viewMode === "month") {
        newDate.setMonth(prev.getMonth() + 1)
      } else {
        newDate.setDate(prev.getDate() + 7)
      }
      return newDate
    })
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  /** Format date as YYYY-MM-DD in local time (avoid UTC off-by-one). */
  const formatDateKey = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const handleDateClick = (dateKey: string) => {
    setSelectedDate(dateKey)
    setSelectedTask(null)
    setModalMode("create")
    setModalOpen(true)
  }

  const handleTaskClick = (task: Task) => {
    setDetailTask(task)
    setDetailDialogOpen(true)
  }

  const handleEditFromDetail = () => {
    if (detailTask) {
      setDetailDialogOpen(false)
      setSelectedTask(detailTask)
      setModalMode("edit")
      setModalOpen(true)
    }
  }

  const handleEditTask = (task: Task) => {
    setSelectedTask(task)
    setModalMode("edit")
    setModalOpen(true)
  }

  const handleDeleteFromDetail = () => {
    if (detailTask) {
      setTaskToDelete(detailTask)
      setDetailDialogOpen(false)
      setDeleteDialogOpen(true)
    }
  }

  const handleConfirmDelete = async () => {
    if (taskToDelete) {
      try {
        await deleteTask(taskToDelete.id)
        setDeleteDialogOpen(false)
        setTaskToDelete(null)
        setModalOpen(false)
        setSelectedTask(null)
      } catch (error) {
        // Error already handled in store with toast
      }
    }
  }

  const handleSaveTask = async (taskData: Omit<Task, "id" | "createdAt">) => {
    try {
      if (modalMode === "create") {
        const dueDate = selectedDate
          ? `${selectedDate}T23:59:59`
          : taskData.dueDate
        await addTask({
          ...taskData,
          dueDate,
        })
        setModalOpen(false)
        setSelectedDate(null)
      } else if (selectedTask) {
        await updateTask(selectedTask.id, taskData)
        setModalOpen(false)
      }
    } catch (error) {
      // Error already handled in store with toast
    }
  }

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500"
      case "medium":
        return "bg-yellow-500"
      case "low":
        return "bg-green-500"
      default:
        return "bg-slate-500"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-foreground">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={navigateNext}>
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
          {dayNames.map((day) => (
            <div
              key={day}
              className="py-3 text-center text-sm font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className={cn(
          "grid grid-cols-7",
          viewMode === "month" ? "grid-rows-6" : "grid-rows-1"
        )}>
          {days.map(({ date, isCurrentMonth }, index) => {
            const dateKey = formatDateKey(date)
            const dayTasks = tasksByDate[dateKey] || []

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
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDateClick(dateKey)
                    }}
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
                  {dayTasks.slice(0, viewMode === "week" ? 10 : 3).map((task) => (
                    <button
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTaskClick(task)
                      }}
                      className={cn(
                        "w-full text-left rounded px-2 py-1 text-xs truncate transition-colors cursor-grab active:cursor-grabbing",
                        task.status === "completed"
                          ? "bg-muted text-muted-foreground line-through"
                          : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                      )}
                    >
                      <span className={cn(
                        "inline-block w-1.5 h-1.5 rounded-full mr-1.5",
                        getPriorityColor(task.priority)
                      )} />
                      {task.title}
                    </button>
                  ))}
                  {dayTasks.length > (viewMode === "week" ? 10 : 3) && (
                    <p className="text-xs text-muted-foreground px-2">
                      +{dayTasks.length - (viewMode === "week" ? 10 : 3)} more
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
        onSave={handleSaveTask}
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
