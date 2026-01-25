"use client"

import React from "react"

import { useState, useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import type { Task, TaskStatus } from "@/lib/types"
import { PriorityBadge } from "./priority-badge"
import { TaskModal } from "./task-modal"
import { TaskDetailDialog } from "./task-detail-dialog"
import { DeleteDialog } from "./delete-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Plus,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  ListTodo,
  Loader2,
} from "lucide-react"

interface ColumnConfig {
  id: string
  title: string
  icon: React.ElementType
  color: string
  filter: (task: Task) => boolean
}

export function DashboardView() {
  const { tasks, addTask, updateTask, deleteTask, updateTaskStatus, isLoading, error } = useTaskStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)

  const today = new Date().toISOString().split("T")[0]

  const topColumns: ColumnConfig[] = [
    {
      id: "due-today",
      title: "Due Today",
      icon: Calendar,
      color: "text-blue-500",
      filter: (task) => task.dueDate === today && task.status !== "completed",
    },
    {
      id: "overdue",
      title: "Overdue",
      icon: AlertCircle,
      color: "text-red-500",
      filter: (task) => task.dueDate < today && task.status !== "completed",
    },
  ]

  const bottomColumns: ColumnConfig[] = [
    {
      id: "todo",
      title: "In Todo",
      icon: ListTodo,
      color: "text-slate-500",
      filter: (task) => task.status === "todo",
    },
    {
      id: "in-progress",
      title: "In Progress",
      icon: Clock,
      color: "text-yellow-500",
      filter: (task) => task.status === "in-progress",
    },
    {
      id: "completed",
      title: "Completed",
      icon: CheckCircle2,
      color: "text-green-500",
      filter: (task) => task.status === "completed",
    },
  ]

  const columnTasks = useMemo(() => {
    const result: Record<string, Task[]> = {}
    ;[...topColumns, ...bottomColumns].forEach((col) => {
      result[col.id] = tasks.filter(col.filter)
    })
    return result
  }, [tasks, topColumns, bottomColumns])

  const stats = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter((t) => t.status === "completed").length
    const inProgress = tasks.filter((t) => t.status === "in-progress").length
    const overdue = tasks.filter((t) => t.dueDate < today && t.status !== "completed").length
    
    return { total, completed, inProgress, overdue }
  }, [tasks, today])

  const handleCreateTask = () => {
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
        await addTask(taskData)
        setModalOpen(false)
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

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    if (!draggedTask) return

    // Map column to status change
    if (columnId === "todo" && draggedTask.status !== "todo") {
      updateTaskStatus(draggedTask.id, "todo")
    } else if (columnId === "in-progress" && draggedTask.status !== "in-progress") {
      updateTaskStatus(draggedTask.id, "in-progress")
    } else if (columnId === "completed" && draggedTask.status !== "completed") {
      updateTaskStatus(draggedTask.id, "completed")
    }
    setDraggedTask(null)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    )
  }

  if (error && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="font-semibold text-foreground">Failed to load tasks</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <Button onClick={() => window.location.reload()} variant="outline">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <ListTodo className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Tasks</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.inProgress}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.overdue}</p>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Task Button */}
      <div className="flex justify-end">
        <Button onClick={handleCreateTask} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Task Columns */}
      <div className="space-y-6">
        {/* Top row: Due Today, Overdue */}
        <div className="grid gap-6 md:grid-cols-2">
          {topColumns.map((column) => {
            const Icon = column.icon
            const colTasks = columnTasks[column.id]
            const canDrop = false

            return (
              <Card
                key={column.id}
                onDragOver={canDrop ? handleDragOver : undefined}
                onDrop={canDrop ? (e) => handleDrop(e, column.id) : undefined}
                className={cn(
                  "transition-colors",
                  canDrop && draggedTask && "border-dashed border-accent/50"
                )}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className={cn("h-5 w-5", column.color)} />
                    {column.title}
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {colTasks.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {colTasks.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No tasks
                    </p>
                  ) : (
                    colTasks.slice(0, 5).map((task) => (
                      <div
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className={cn(
                          "group rounded-lg border border-border bg-card p-3 transition-all cursor-pointer hover:bg-muted/50",
                          task.status === "completed" && "opacity-60"
                        )}
                      >
                        <p className={cn(
                          "text-sm font-medium text-foreground line-clamp-2",
                          task.status === "completed" && "line-through"
                        )}>
                          {task.title}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <PriorityBadge priority={task.priority} />
                          <span className="text-xs text-muted-foreground">
                            {formatDate(task.dueDate)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                  {colTasks.length > 5 && (
                    <p className="text-center text-sm text-muted-foreground py-2">
                      +{colTasks.length - 5} more tasks
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Bottom row: In Todo, In Progress, Completed */}
        <div className="grid gap-6 md:grid-cols-3">
          {bottomColumns.map((column) => {
          const Icon = column.icon
          const colTasks = columnTasks[column.id]
          const canDrop = column.id === "todo" || column.id === "in-progress" || column.id === "completed"

          return (
            <Card
              key={column.id}
              onDragOver={canDrop ? handleDragOver : undefined}
              onDrop={canDrop ? (e) => handleDrop(e, column.id) : undefined}
              className={cn(
                "transition-colors",
                canDrop && draggedTask && "border-dashed border-accent/50"
              )}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className={cn("h-5 w-5", column.color)} />
                  {column.title}
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {colTasks.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {colTasks.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No tasks
                  </p>
                ) : (
                  colTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onClick={() => handleTaskClick(task)}
                      className={cn(
                        "group rounded-lg border border-border bg-card p-3 transition-all cursor-pointer hover:bg-muted/50",
                        task.status === "completed" && "opacity-60"
                      )}
                    >
                      <p className={cn(
                        "text-sm font-medium text-foreground line-clamp-2",
                        task.status === "completed" && "line-through"
                      )}>
                        {task.title}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <PriorityBadge priority={task.priority} />
                        <span className="text-xs text-muted-foreground">
                          {formatDate(task.dueDate)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                {colTasks.length > 5 && (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    +{colTasks.length - 5} more tasks
                  </p>
                )}
              </CardContent>
            </Card>
          )
          })}
        </div>
      </div>

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
