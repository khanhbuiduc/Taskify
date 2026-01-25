"use client"

import React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import type { Task, TaskPriority, TaskStatus } from "@/lib/types"

interface TaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task | null
  onSave: (task: Omit<Task, "id" | "createdAt">) => void
  mode: "create" | "edit"
}

export function TaskModal({ open, onOpenChange, task, onSave, mode }: TaskModalProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("medium")
  const [status, setStatus] = useState<TaskStatus>("todo")
  const [dueDate, setDueDate] = useState("")

  useEffect(() => {
    if (task && mode === "edit") {
      setTitle(task.title)
      setDescription(task.description)
      setPriority(task.priority)
      setStatus(task.status)
      setDueDate(task.dueDate)
    } else {
      setTitle("")
      setDescription("")
      setPriority("medium")
      setStatus("todo")
      setDueDate("")
    }
  }, [task, mode, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !dueDate) return

    onSave({
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      dueDate,
    })
    onOpenChange(false)
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
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter task description"
                rows={3}
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
