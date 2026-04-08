"use client"

import React, { useState, useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import type { Task, TaskStatus } from "@/lib/types"
import { useTaskActions } from "@/hooks/use-task-actions"
import { TaskModal } from "@/components/task/task-modal"
import { TaskDetailDialog } from "@/components/task/task-detail-dialog"
import { DeleteDialog } from "@/components/task/delete-dialog"
import { PriorityBadge } from "@/components/task/priority-badge"
import { LabelBadge } from "@/components/task/label-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, stripHtml, formatDueDisplay } from "@/lib/utils"
import { Search, Plus, CheckCircle2, Circle, Calendar } from "lucide-react"

type SortOption = "dueDate" | "priority" | "status"
type FilterOption = "all" | TaskStatus

export default function ListTasksPage() {
  const { tasks, labels, updateTaskStatus } = useTaskStore()
  const {
    modalOpen, setModalOpen,
    modalMode,
    selectedTask,
    detailDialogOpen, setDetailDialogOpen,
    detailTask,
    deleteDialogOpen, setDeleteDialogOpen,
    taskToDelete,
    openCreateModal,
    openDetail,
    handleEditFromDetail,
    handleDeleteFromDetail,
    handleConfirmDelete,
    handleSaveTask,
  } = useTaskActions()

  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("dueDate")
  const [filterStatus, setFilterStatus] = useState<FilterOption>("all")
  const [filterLabel, setFilterLabel] = useState<number | "all">("all")

  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(q) ||
          stripHtml(task.description).toLowerCase().includes(q)
      )
    }
    if (filterStatus !== "all") {
      result = result.filter((task) => task.status === filterStatus)
    }
    if (filterLabel !== "all") {
      result = result.filter((task) => task.labels?.some((l) => l.id === filterLabel))
    }
    result.sort((a, b) => {
      if (sortBy === "dueDate") return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      if (sortBy === "priority") {
        const order = { high: 0, medium: 1, low: 2 }
        return order[a.priority] - order[b.priority]
      }
      if (sortBy === "status") {
        const order = { todo: 0, "in-progress": 1, completed: 2 }
        return order[a.status] - order[b.status]
      }
      return 0
    })
    return result
  }, [tasks, search, sortBy, filterStatus, filterLabel])

  const handleStatusToggle = (task: Task) => {
    const newStatus: TaskStatus = task.status === "completed" ? "todo" : "completed"
    updateTaskStatus(task.id, newStatus)
  }

  const isOverdue = (dueDate: string, status: TaskStatus) =>
    status !== "completed" && new Date(dueDate) < new Date()

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <span className="text-sm text-muted-foreground">Label:</span>
            <Select
              value={String(filterLabel)}
              onValueChange={(v) => setFilterLabel(v === "all" ? "all" : Number(v))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All labels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Labels</SelectItem>
                {labels.map((label) => (
                  <SelectItem key={label.id} value={String(label.id)}>
                    {label.name}
                  </SelectItem>
                ))}
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
          <Button onClick={openCreateModal} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Task List */}
      <div className="rounded-lg border border-border p-4">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="font-semibold text-foreground">All Tasks</h3>
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {filteredAndSortedTasks.length}
          </span>
        </div>

        {filteredAndSortedTasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No tasks found</p>
        ) : (
          <div className="space-y-2">
            {filteredAndSortedTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => openDetail(task)}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm transition-all hover:bg-muted/50 cursor-pointer",
                  task.status === "completed" && "opacity-60"
                )}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); handleStatusToggle(task) }}
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
                    <p className="text-sm text-muted-foreground truncate">{stripHtml(task.description)}</p>
                  )}
                  {task.labels?.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {task.labels.map((label) => (
                        <LabelBadge
                          key={label.id}
                          label={label}
                          onClick={(e) => { e.stopPropagation(); setFilterLabel(label.id) }}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <PriorityBadge priority={task.priority} />
                  <div className={cn(
                    "flex items-center gap-1 text-xs",
                    isOverdue(task.dueDate, task.status) ? "text-destructive" : "text-muted-foreground"
                  )}>
                    <Calendar className="h-3 w-3" />
                    {formatDueDisplay(task.dueDate)}
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
