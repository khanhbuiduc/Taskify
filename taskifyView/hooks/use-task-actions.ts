/**
 * useTaskActions — shared hook for task CRUD + modal/dialog state.
 * Used by: calendar/page, dashboard/page, list/page, table/page
 */
"use client"

import { useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

export function useTaskActions() {
  const { addTask, updateTask, deleteTask } = useTaskStore()

  // --- Modal state ---
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // --- Detail dialog state ---
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  // --- Delete dialog state ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  // --- Handlers ---

  const openCreateModal = () => {
    setSelectedTask(null)
    setModalMode("create")
    setModalOpen(true)
  }

  const openEditModal = (task: Task) => {
    setSelectedTask(task)
    setModalMode("edit")
    setModalOpen(true)
  }

  const openDetail = (task: Task) => {
    setDetailTask(task)
    setDetailDialogOpen(true)
  }

  const handleEditFromDetail = () => {
    if (detailTask) {
      setDetailDialogOpen(false)
      openEditModal(detailTask)
    }
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
      } catch {
        // Error handled in store with toast
      }
    }
  }

  const handleSaveTask = async (
    taskData: Omit<Task, "id" | "createdAt">,
    extraOnCreate?: (task: Omit<Task, "id" | "createdAt">) => Omit<Task, "id" | "createdAt">
  ) => {
    try {
      if (modalMode === "create") {
        const data = extraOnCreate ? extraOnCreate(taskData) : taskData
        await addTask(data)
        setModalOpen(false)
      } else if (selectedTask) {
        await updateTask(selectedTask.id, taskData)
        setModalOpen(false)
      }
    } catch {
      // Error handled in store with toast
    }
  }

  return {
    // State
    modalOpen, setModalOpen,
    modalMode,
    selectedTask,
    detailDialogOpen, setDetailDialogOpen,
    detailTask,
    deleteDialogOpen, setDeleteDialogOpen,
    taskToDelete,

    // Actions
    openCreateModal,
    openEditModal,
    openDetail,
    handleEditFromDetail,
    handleDeleteFromDetail,
    handleConfirmDelete,
    handleSaveTask,
  }
}
