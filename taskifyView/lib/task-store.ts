"use client";

import { create } from "zustand";
import type { Task, TaskStatus, TaskPriority } from "./types";
import { taskApi, ApiError } from "./api/taskApi";
import { getDueDatePart, getDueTimePart } from "./utils";
import { toast } from "sonner";
import { useNotificationStore } from "./notification-store";

interface TaskStore {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;

  // Data fetching
  fetchTasks: () => Promise<void>;

  // CRUD operations
  addTask: (task: Omit<Task, "id" | "createdAt">) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  reorderTasks: (startIndex: number, endIndex: number) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  updateTaskDueDate: (
    id: string,
    dueDate: string,
    dueTime?: string | null,
  ) => Promise<void>;

  // Internal helpers
  setTasks: (tasks: Task[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,
  isInitialized: false,

  /**
   * Fetch all tasks from API
   */
  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await taskApi.getAll();
      set({ tasks, isLoading: false, isInitialized: true });
    } catch (error) {
      const errorMessage =
        error instanceof ApiError ? error.message : "Failed to fetch tasks";
      set({ error: errorMessage, isLoading: false, isInitialized: true });
      toast.error(errorMessage);
    }
  },

  /**
   * Create a new task
   */
  addTask: async (task) => {
    const previousTasks = get().tasks;
    // Optimistic update
    const tempTask: Task = {
      ...task,
      id: `temp-${Date.now()}`,
      createdAt: new Date().toISOString().split("T")[0],
    };
    set({ tasks: [...previousTasks, tempTask] });

    try {
      const newTask = await taskApi.create({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        dueDate: getDueDatePart(task.dueDate),
        dueTime: getDueTimePart(task.dueDate),
      });
      // Replace temp task with real task from API
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === tempTask.id ? newTask : t)),
      }));
      toast.success("Task created successfully");

      // Trigger notification
      useNotificationStore.getState().addNotification({
        title: "Task Created",
        message: `"${task.title}" has been added to your tasks`,
        type: "success",
        taskId: newTask.id,
      });
    } catch (error) {
      // Rollback on error
      set({ tasks: previousTasks });
      const errorMessage =
        error instanceof ApiError ? error.message : "Failed to create task";
      toast.error(errorMessage);
      throw error;
    }
  },

  /**
   * Update an existing task
   */
  updateTask: async (id, updates) => {
    const previousTasks = get().tasks;
    const taskToUpdate = previousTasks.find((t) => t.id === id);
    if (!taskToUpdate) return;

    // Optimistic update
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, ...updates } : task,
      ),
    }));

    try {
      // If updating all fields, use PUT
      if (
        updates.title &&
        updates.description &&
        updates.priority &&
        updates.status &&
        updates.dueDate
      ) {
        const updatedTask = await taskApi.update(id, {
          title: updates.title,
          description: updates.description,
          priority: updates.priority as TaskPriority,
          status: updates.status as TaskStatus,
          dueDate: getDueDatePart(updates.dueDate),
          dueTime: getDueTimePart(updates.dueDate),
        });
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? updatedTask : task,
          ),
        }));
      } else {
        // Partial update - fetch updated task
        const updatedTask = await taskApi.getById(id);
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? updatedTask : task,
          ),
        }));
      }
      toast.success("Task updated successfully");
    } catch (error) {
      // Rollback on error
      set({ tasks: previousTasks });
      const errorMessage =
        error instanceof ApiError ? error.message : "Failed to update task";
      toast.error(errorMessage);
      throw error;
    }
  },

  /**
   * Delete a task
   */
  deleteTask: async (id) => {
    const previousTasks = get().tasks;
    // Optimistic update
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
    }));

    try {
      await taskApi.delete(id);
      toast.success("Task deleted successfully");
    } catch (error) {
      // Rollback on error
      set({ tasks: previousTasks });
      const errorMessage =
        error instanceof ApiError ? error.message : "Failed to delete task";
      toast.error(errorMessage);
      throw error;
    }
  },

  /**
   * Reorder tasks (local only, no API call)
   */
  reorderTasks: (startIndex, endIndex) =>
    set((state) => {
      const result = Array.from(state.tasks);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return { tasks: result };
    }),

  /**
   * Update task status only
   */
  updateTaskStatus: async (id, status) => {
    const previousTasks = get().tasks;
    // Optimistic update
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, status } : task,
      ),
    }));

    try {
      const updatedTask = await taskApi.updateStatus(id, status);
      set((state) => ({
        tasks: state.tasks.map((task) => (task.id === id ? updatedTask : task)),
      }));

      // Trigger notification for status change
      const task = previousTasks.find((t) => t.id === id);
      if (task && status === "completed") {
        useNotificationStore.getState().addNotification({
          title: "Task Completed! 🎉",
          message: `You completed "${task.title}"`,
          type: "success",
          taskId: id,
        });
      } else if (task) {
        const statusLabels: Record<string, string> = {
          todo: "To Do",
          "in-progress": "In Progress",
          completed: "Completed",
        };
        useNotificationStore.getState().addNotification({
          title: "Task Updated",
          message: `"${task.title}" moved to ${statusLabels[status] || status}`,
          type: "info",
          taskId: id,
        });
      }
    } catch (error) {
      // Rollback on error
      set({ tasks: previousTasks });
      const errorMessage =
        error instanceof ApiError
          ? error.message
          : "Failed to update task status";
      toast.error(errorMessage);
      throw error;
    }
  },

  /**
   * Update task due date only
   */
  updateTaskDueDate: async (id, dueDate, dueTime) => {
    const previousTasks = get().tasks;
    const task = previousTasks.find((t) => t.id === id);
    const datePart = getDueDatePart(dueDate);
    const timePart =
      dueTime ??
      (task ? getDueTimePart(task.dueDate) : undefined) ??
      getDueTimePart(dueDate);
    const fullDue = timePart
      ? `${datePart}T${timePart}:00`
      : `${datePart}T23:59:59`;
    // Optimistic update
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, dueDate: fullDue } : task,
      ),
    }));

    try {
      const updatedTask = await taskApi.updateDueDate(id, datePart, timePart);
      set((state) => ({
        tasks: state.tasks.map((task) => (task.id === id ? updatedTask : task)),
      }));
    } catch (error) {
      // Rollback on error
      set({ tasks: previousTasks });
      const errorMessage =
        error instanceof ApiError ? error.message : "Failed to update due date";
      toast.error(errorMessage);
      throw error;
    }
  },

  // Internal helpers
  setTasks: (tasks) => set({ tasks }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  /**
   * Reset task store to initial state
   * Used when logging out or switching users
   */
  reset: () => {
    set({
      tasks: [],
      isLoading: false,
      error: null,
      isInitialized: false,
    });
  },
}));
