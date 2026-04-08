"use client"

import React, { useState, useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import type { Task, TaskStatus } from "@/lib/types"
import { useTaskActions } from "@/hooks/use-task-actions"
import { TaskModal } from "@/components/task/task-modal"
import { TaskDetailDialog } from "@/components/task/task-detail-dialog"
import { DeleteDialog } from "@/components/task/delete-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, stripHtml } from "@/lib/utils"
import { Search, Plus } from "lucide-react"
import { TaskCard } from "@/components/task/task-card"

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
              <TaskCard
                key={task.id}
                task={task}
                variant="list"
                onClick={openDetail}
                onStatusToggle={handleStatusToggle}
                onLabelClick={(labelId, e) => {
                  e.stopPropagation()
                  setFilterLabel(labelId)
                }}
              />
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
