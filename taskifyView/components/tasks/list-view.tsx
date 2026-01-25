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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  Search,
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
} from "lucide-react"

type SortOption = "dueDate" | "priority" | "status"
type FilterOption = "all" | TaskStatus

export function ListView() {
  const { tasks, addTask, updateTask, deleteTask, updateTaskStatus } = useTaskStore()
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("dueDate")
  const [filterStatus, setFilterStatus] = useState<FilterOption>("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks]

    // Search filter
    if (search) {
      result = result.filter((task) =>
        task.title.toLowerCase().includes(search.toLowerCase())
      )
    }

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
  }, [tasks, search, sortBy, filterStatus])

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

  // Toggle giữa todo ↔ completed
  const handleStatusToggle = (task: Task) => {
    const newStatus: TaskStatus = task.status === "completed" ? "todo" : "completed"
    updateTaskStatus(task.id, newStatus)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const isOverdue = (dateStr: string, status: TaskStatus) => {
    if (status === "completed") return false
    return new Date(dateStr) < new Date()
  }

  return (
    <div className="space-y-6">
      {/* Header with Search, Filter, Sort */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
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
          <Button onClick={handleCreateTask} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Task List - All tasks in one list */}
      <div className="rounded-lg border border-border p-4">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="font-semibold text-foreground">All Tasks</h3>
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {filteredAndSortedTasks.length}
          </span>
        </div>

        {filteredAndSortedTasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tasks found
          </p>
        ) : (
          <div className="space-y-2">
            {filteredAndSortedTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => handleTaskClick(task)}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm transition-all hover:bg-muted/50 cursor-pointer",
                  task.status === "completed" && "opacity-60"
                )}
              >
                {/* Toggle button: click để chuyển todo ↔ completed */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleStatusToggle(task)
                  }}
                  className="shrink-0"
                >
                  {task.status === "completed" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 hover:text-green-400 transition-colors" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground hover:text-accent transition-colors" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium text-foreground truncate",
                    task.status === "completed" && "line-through"
                  )}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-sm text-muted-foreground truncate">{task.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <PriorityBadge priority={task.priority} />
                  <div className={cn(
                    "flex items-center gap-1 text-xs",
                    isOverdue(task.dueDate, task.status) ? "text-destructive" : "text-muted-foreground"
                  )}>
                    <Calendar className="h-3 w-3" />
                    {formatDate(task.dueDate)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
