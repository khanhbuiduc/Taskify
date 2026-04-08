"use client"

import React, { useState, useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import type { Task, TaskStatus, TaskPriority } from "@/lib/types"
import { useTaskActions } from "@/hooks/use-task-actions"
import { TaskModal } from "@/components/task/task-modal"
import { TaskDetailDialog } from "@/components/task/task-detail-dialog"
import { DeleteDialog } from "@/components/task/delete-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  Plus,
  AlertCircle,
  Clock,
  CheckCircle2,
  ListTodo,
  Loader2,
  ChevronDown,
  ChevronUp,
  Circle,
} from "lucide-react"
import { TaskCard } from "@/components/task/task-card"

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

export default function DashboardTasksPage() {
  const {
    tasks,
    labels,
    updateTask,
    updateTaskStatus,
    isLoading,
    error,
  } = useTaskStore()

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

  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [showOverdueList, setShowOverdueList] = useState(false)
  const [filterStatus, setFilterStatus] = useState<FilterOption>("all")
  const [sortBy, setSortBy] = useState<SortOption>("dueDate")
  const [groupBy, setGroupBy] = useState<GroupByOption>("status")
  const [filterLabel, setFilterLabel] = useState<number | "all">("all")

  const now = new Date()

  const overdueTasks = useMemo(
    () => tasks.filter((t) => t.status !== "completed" && new Date(t.dueDate) < now),
    [tasks]
  )

  const stats = useMemo(() => ({
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    overdue: overdueTasks.length,
  }), [tasks, overdueTasks])

  const bottomColumns: ColumnConfig[] = useMemo(() => {
    if (groupBy === "status") {
      return [
        { id: "todo", title: "In Todo", icon: ListTodo, color: "text-slate-500", filter: (t) => t.status === "todo" },
        { id: "in-progress", title: "In Progress", icon: Clock, color: "text-yellow-500", filter: (t) => t.status === "in-progress" },
        { id: "completed", title: "Completed", icon: CheckCircle2, color: "text-green-500", filter: (t) => t.status === "completed" },
      ]
    }
    return [
      { id: "high", title: "High Priority", icon: AlertCircle, color: "text-red-500", filter: (t) => t.priority === "high" },
      { id: "medium", title: "Medium Priority", icon: Clock, color: "text-yellow-500", filter: (t) => t.priority === "medium" },
      { id: "low", title: "Low Priority", icon: Circle, color: "text-green-500", filter: (t) => t.priority === "low" },
    ]
  }, [groupBy])

  const getFilteredTasks = (baseTasks: Task[]) => {
    let result = [...baseTasks]
    if (filterStatus !== "all") result = result.filter((t) => t.status === filterStatus)
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
  }

  const columnTasks = useMemo(() => {
    const result: Record<string, Task[]> = {}
    bottomColumns.forEach((col) => {
      const filtered = tasks.filter(col.filter)
      const afterLabel = filterLabel === "all" ? filtered : filtered.filter((t) => t.labels?.some((l) => l.id === filterLabel))
      result[col.id] = getFilteredTasks(afterLabel)
    })
    return result
  }, [tasks, bottomColumns, filterStatus, sortBy, filterLabel])

  const filteredOverdueTasks = useMemo(() => {
    const list = filterLabel === "all" ? overdueTasks : overdueTasks.filter((t) => t.labels?.some((l) => l.id === filterLabel))
    return getFilteredTasks(list)
  }, [overdueTasks, filterStatus, sortBy, filterLabel])

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = "move"
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }
  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    if (!draggedTask) return
    if (groupBy === "status") {
      const statusMap: Record<string, TaskStatus> = { todo: "todo", "in-progress": "in-progress", completed: "completed" }
      const newStatus = statusMap[columnId]
      if (newStatus && draggedTask.status !== newStatus) await updateTaskStatus(draggedTask.id, newStatus)
    } else {
      const priorityMap: Record<string, TaskPriority> = { high: "high", medium: "medium", low: "low" }
      const newPriority = priorityMap[columnId]
      if (newPriority && draggedTask.priority !== newPriority) await updateTask(draggedTask.id, { priority: newPriority })
    }
    setDraggedTask(null)
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
              <Button onClick={() => window.location.reload()} variant="outline">Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
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
          className={cn("cursor-pointer transition-colors hover:bg-muted/30", showOverdueList && "ring-2 ring-red-500/50")}
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
            {showOverdueList ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
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

      {/* Overdue list */}
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
              <p className="py-4 text-center text-sm text-muted-foreground">No overdue tasks</p>
            ) : (
              filteredOverdueTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  variant="list"
                  onClick={openDetail}
                />
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters + Add */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter:</span>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterOption)}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Filter" /></SelectTrigger>
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
            <Select value={String(filterLabel)} onValueChange={(v) => setFilterLabel(v === "all" ? "all" : Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="All labels" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Labels</SelectItem>
                {labels.map((label) => <SelectItem key={label.id} value={String(label.id)}>{label.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
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
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Group by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={openCreateModal} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Task Columns */}
      <div className="grid gap-6 md:grid-cols-3">
        {bottomColumns.map((column) => {
          const Icon = column.icon
          const colTasks = columnTasks[column.id]
          return (
            <Card
              key={column.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
              className={cn("transition-colors", draggedTask && "border-dashed border-accent/50")}
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
              <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                {colTasks.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No tasks</p>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      variant="grid"
                      onClick={openDetail}
                      onDragStart={handleDragStart}
                    />
                  ))
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
