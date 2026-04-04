"use client"

import React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DescriptionEditor } from "@/components/tasks/description-editor"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getDueDatePart, getDueTimePart, cn } from "@/lib/utils"
import type { Task, TaskPriority, TaskStatus } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"

/** Today in local YYYY-MM-DD (for default due date when creating outside calendar). */
function getTodayDateString(): string {
  const t = new Date()
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, "0")
  const d = String(t.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

interface TaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task | null
  onSave: (task: Omit<Task, "id" | "createdAt">) => void
  mode: "create" | "edit"
  /** When creating: pre-fill due date (e.g. calendar passes selected date). Omit = today. */
  initialDueDate?: string | null
}

export function TaskModal({ open, onOpenChange, task, onSave, mode, initialDueDate }: TaskModalProps) {
  const { labels, createLabel } = useTaskStore()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("medium")
  const [status, setStatus] = useState<TaskStatus>("todo")
  const [dueDate, setDueDate] = useState("")
  const [dueTime, setDueTime] = useState("")
  const [selectedLabels, setSelectedLabels] = useState<number[]>([])
  const [newLabelName, setNewLabelName] = useState("")
  const [newLabelColor, setNewLabelColor] = useState("#38bdf8")
  const palette = ["#38bdf8", "#22c55e", "#f97316", "#ef4444", "#a855f7", "#06b6d4", "#f59e0b", "#3b82f6"]

  useEffect(() => {
    if (task && mode === "edit") {
      setTitle(task.title)
      setDescription(task.description)
      setPriority(task.priority)
      setStatus(task.status)
      setDueDate(getDueDatePart(task.dueDate))
      setDueTime(getDueTimePart(task.dueDate) ?? "")
      setSelectedLabels(task.labels?.map((l) => l.id) ?? [])
    } else {
      setTitle("")
      setDescription("")
      setPriority("medium")
      setStatus("todo")
      setDueDate(initialDueDate ? getDueDatePart(initialDueDate) : getTodayDateString())
      setDueTime(initialDueDate ? (getDueTimePart(initialDueDate) ?? "") : "")
      setSelectedLabels([])
    }
  }, [task, mode, open, initialDueDate])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !dueDate) return

    const timePart = dueTime.trim() || null
    const dueDateValue = timePart
      ? `${dueDate}T${timePart}:00`
      : `${dueDate}T23:59:59`

    onSave({
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      dueDate: dueDateValue,
      labels: labels.filter((l) => selectedLabels.includes(l.id)),
    })
    onOpenChange(false)
  }

  const toggleLabel = (id: number) => {
    setSelectedLabels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return
    try {
      const created = await createLabel({ name: newLabelName.trim(), color: newLabelColor })
      setSelectedLabels((prev) => [...prev, created.id])
      setNewLabelName("")
    } catch {
      // toast handled in store
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Create New Task" : "Edit Task"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Add a new task to your list."
                : "Make changes to your task."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <DescriptionEditor
                value={description}
                onChange={setDescription}
                placeholder="Enter task description"
                editable={true}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">Todo</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dueTime">Due Time (optional)</Label>
                <Input
                  id="dueTime"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  title="Leave empty for end of day"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Labels</Label>
              <div className="flex flex-wrap gap-2">
                {labels.length === 0 && (
                  <p className="text-xs text-muted-foreground">No labels yet. Create one below.</p>
                )}
                {labels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggleLabel(label.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
                      selectedLabels.includes(label.id)
                        ? "border-transparent text-white"
                        : "border-border bg-background text-foreground"
                    )}
                    style={{
                      backgroundColor: selectedLabels.includes(label.id) ? label.color : undefined,
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    {label.name}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
                <span className="text-xs text-muted-foreground">Quick add label</span>
                <div className="flex gap-2">
                  <Input
                    placeholder="Label name"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                  />
                  <input
                    type="color"
                    value={newLabelColor}
                    onChange={(e) => setNewLabelColor(e.target.value)}
                    className="h-10 w-12 rounded border border-border bg-transparent"
                    title="Pick a color"
                  />
                  <Button type="button" onClick={handleCreateLabel} variant="secondary">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {palette.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewLabelColor(color)}
                      className={cn(
                        "h-6 w-6 rounded-full border border-border",
                        newLabelColor === color && "ring-2 ring-offset-2 ring-offset-background"
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90">
              {mode === "create" ? "Create Task" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
