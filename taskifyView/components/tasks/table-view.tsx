"use client"

import { useState, useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import type { Task, TaskStatus, TaskPriority } from "@/lib/types"
import { PriorityBadge } from "./priority-badge"
import { StatusBadge } from "./status-badge"
import { TaskModal } from "./task-modal"
import { TaskDetailDialog } from "./task-detail-dialog"
import { DeleteDialog } from "./delete-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, stripHtml, formatDueDisplay } from "@/lib/utils"
import {
  Search,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"

type SortField = "title" | "priority" | "status" | "dueDate" | "createdAt"
type SortDirection = "asc" | "desc"

export function TableView() {
  const { tasks, addTask, updateTask, deleteTask } = useTaskStore()
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("dueDate")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks]

    // Search filter (description: strip HTML for plain-text search)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(q) ||
          stripHtml(task.description).toLowerCase().includes(q)
      )
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case "title":
          comparison = a.title.localeCompare(b.title)
          break
        case "priority": {
          const priorityOrder = { high: 0, medium: 1, low: 2 }
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
        }
        case "status": {
          const statusOrder = { todo: 0, "in-progress": 1, completed: 2 }
          comparison = statusOrder[a.status] - statusOrder[b.status]
          break
        }
        case "dueDate":
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          break
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return result
  }, [tasks, search, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 text-accent" />
    ) : (
      <ArrowDown className="h-4 w-4 text-accent" />
    )
  }

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

  const handleInlineStatusChange = (taskId: string, newStatus: TaskStatus) => {
    updateTask(taskId, { status: newStatus })
  }

  const handleInlinePriorityChange = (taskId: string, newPriority: TaskPriority) => {
    updateTask(taskId, { priority: newPriority })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const isOverdue = (dueDate: string, status: TaskStatus) => {
    if (status === "completed") return false
    return new Date(dueDate) < new Date()
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
        <Button onClick={handleCreateTask} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[300px]">
                  <button
                    onClick={() => handleSort("title")}
                    className="flex items-center gap-2 hover:text-foreground"
                  >
                    Title
                    <SortIcon field="title" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("priority")}
                    className="flex items-center gap-2 hover:text-foreground"
                  >
                    Priority
                    <SortIcon field="priority" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("status")}
                    className="flex items-center gap-2 hover:text-foreground"
                  >
                    Status
                    <SortIcon field="status" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("dueDate")}
                    className="flex items-center gap-2 hover:text-foreground"
                  >
                    Due Date
                    <SortIcon field="dueDate" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("createdAt")}
                    className="flex items-center gap-2 hover:text-foreground"
                  >
                    Created
                    <SortIcon field="createdAt" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    {search ? "No tasks found matching your search." : "No tasks yet. Create one to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedTasks.map((task) => (
                  <TableRow
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className={cn(
                      "group transition-colors hover:bg-muted/50 cursor-pointer",
                      task.status === "completed" && "opacity-60"
                    )}
                  >
                    <TableCell>
                      <div className="max-w-[300px]">
                        <p className={cn(
                          "font-medium truncate",
                          task.status === "completed" && "line-through"
                        )}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {stripHtml(task.description)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={task.priority}
                        onValueChange={(v) => handleInlinePriorityChange(task.id, v as TaskPriority)}
                      >
                        <SelectTrigger className="w-[100px] h-8 border-none bg-transparent p-0">
                          <PriorityBadge priority={task.priority} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={task.status}
                        onValueChange={(v) => handleInlineStatusChange(task.id, v as TaskStatus)}
                      >
                        <SelectTrigger className="w-[120px] h-8 border-none bg-transparent p-0">
                          <StatusBadge status={task.status} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">Todo</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "text-sm",
                        isOverdue(task.dueDate, task.status) && "text-destructive font-medium"
                      )}>
                        {formatDueDisplay(task.dueDate)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(task.createdAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Task count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredAndSortedTasks.length} of {tasks.length} tasks
      </p>

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
