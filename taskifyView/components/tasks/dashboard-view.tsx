"use client"

import React from "react"

import { useState, useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import type { Task, TaskStatus, TaskPriority } from "@/lib/types"
import { PriorityBadge } from "./priority-badge"
import { TaskModal } from "./task-modal"
import { TaskDetailDialog } from "./task-detail-dialog"
import { DeleteDialog } from "./delete-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, stripHtml, formatDueDisplay, getDueDatePart } from "@/lib/utils"
import {
  Plus,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  ListTodo,
  Loader2,
  ChevronDown,
  ChevronUp,
  Circle,
} from "lucide-react"

// Types for filter and sort
type SortOption = "dueDate" | "priority" | "status"
type FilterOption = "all" | TaskStatus
type GroupByOption = "status" | "priority"

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

  // New state for filters, sort, grouping, and overdue list
  const [showOverdueList, setShowOverdueList] = useState(false)
  const [filterStatus, setFilterStatus] = useState<FilterOption>("all")
  const [sortBy, setSortBy] = useState<SortOption>("dueDate")
  const [groupBy, setGroupBy] = useState<GroupByOption>("status")

  const now = new Date()

  // Compute overdue tasks (full datetime: no time = end of that day)
  const overdueTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== "completed" && new Date(t.dueDate) < now)
  }, [tasks])

  // Stats computation (removed inProgress)
  const stats = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter((t) => t.status === "completed").length
    const overdue = overdueTasks.length
    
    return { total, completed, overdue }
  }, [tasks, overdueTasks])

  // Dynamic columns based on groupBy selection
  const bottomColumns: ColumnConfig[] = useMemo(() => {
    if (groupBy === "status") {
      return [
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
    } else {
      // Group by priority
      return [
        {
          id: "high",
          title: "High Priority",
          icon: AlertCircle,
          color: "text-red-500",
          filter: (task) => task.priority === "high",
        },
        {
          id: "medium",
          title: "Medium Priority",
          icon: Clock,
          color: "text-yellow-500",
          filter: (task) => task.priority === "medium",
        },
        {
          id: "low",
          title: "Low Priority",
          icon: Circle,
          color: "text-green-500",
          filter: (task) => task.priority === "low",
        },
      ]
    }
  }, [groupBy])

  // Filter and sort tasks for columns
  const getFilteredTasks = (baseTasks: Task[]) => {
    let result = [...baseTasks]

    // Status filter
    if (filterStatus !== "all") {
      result = result.filter((task) => task.status === filterStatus)
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "dueDate") {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      if (sortBy === "priority") {
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      if (sortBy === "status") {
        const statusOrder = { todo: 0, "in-progress": 1, completed: 2 }
        return statusOrder[a.status] - statusOrder[b.status]
      }
      return 0
    })

    return result
  }

  // Compute column tasks with filter and sort applied
  const columnTasks = useMemo(() => {
    const result: Record<string, Task[]> = {}
    bottomColumns.forEach((col) => {
      const filtered = tasks.filter(col.filter)
      result[col.id] = getFilteredTasks(filtered)
    })
    return result
  }, [tasks, bottomColumns, filterStatus, sortBy])

  // Filtered and sorted overdue tasks for inline list
  const filteredOverdueTasks = useMemo(() => {
    return getFilteredTasks(overdueTasks)
  }, [overdueTasks, filterStatus, sortBy])

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

  // Updated handleDrop to support both status and priority grouping
  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    if (!draggedTask) return

    if (groupBy === "status") {
      // Map column to status change
      if (columnId === "todo" && draggedTask.status !== "todo") {
        await updateTaskStatus(draggedTask.id, "todo")
      } else if (columnId === "in-progress" && draggedTask.status !== "in-progress") {
        await updateTaskStatus(draggedTask.id, "in-progress")
      } else if (columnId === "completed" && draggedTask.status !== "completed") {
        await updateTaskStatus(draggedTask.id, "completed")
      }
    } else {
      // Map column to priority change
      const priorityMap: Record<string, TaskPriority> = {
        high: "high",
        medium: "medium",
        low: "low",
      }
      const newPriority = priorityMap[columnId]
      if (newPriority && draggedTask.priority !== newPriority) {
        await updateTask(draggedTask.id, { priority: newPriority })
      }
    }
    setDraggedTask(null)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const isOverdue = (dueDate: string, status: TaskStatus) => {
    if (status === "completed") return false
    return new Date(dueDate) < now
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
      {/* Stats Overview - 3 cards: Total, Overdue (clickable), Completed */}
      <div className="grid gap-4 sm:grid-cols-3">
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
        <Card 
          className={cn(
            "cursor-pointer transition-colors hover:bg-muted/30",
            showOverdueList && "ring-2 ring-red-500/50"
          )}
          onClick={() => setShowOverdueList(!showOverdueList)}
        >
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-2xl font-bold text-foreground">{stats.overdue}</p>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
            {showOverdueList ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
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

      {/* Expandable Overdue List */}
      {showOverdueList && (
        <Card className="border-red-200 dark:border-red-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Overdue Tasks
              <span className="ml-auto rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs text-red-600 dark:text-red-400">
                {filteredOverdueTasks.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredOverdueTasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No overdue tasks
              </p>
            ) : (
              filteredOverdueTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 transition-all hover:bg-muted/50 cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {stripHtml(task.description)}
                      </p>
                    )}
                  </div>
                    <div className="flex items-center gap-2 shrink-0">
                    <PriorityBadge priority={task.priority} />
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <Calendar className="h-3 w-3" />
                      {formatDueDisplay(task.dueDate)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Filter, Sort, Group by, and Add Task Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter:</span>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterOption)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="todo">Todo</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dueDate">Due Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Group by:</span>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByOption)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleCreateTask} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Task Columns - Dynamic based on groupBy */}
      <div className="grid gap-6 md:grid-cols-3">
        {bottomColumns.map((column) => {
          const Icon = column.icon
          const colTasks = columnTasks[column.id]
          const canDrop = true

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
                        <span className={cn(
                          "text-xs",
                          isOverdue(task.dueDate, task.status) ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {formatDueDisplay(task.dueDate)}
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
