"use client";

import { useEffect, useRef, useCallback } from "react";
import { useNotificationStore } from "@/lib/notification-store";
import { useTaskStore } from "@/lib/task-store";
import type { Task } from "@/lib/types";

// ============================================================================
// Constants
// ============================================================================

const CHECK_INTERVAL = 60000; // Check every minute
const NOTIFICATION_BEFORE_DUE_HOURS = 1; // Notify 1 hour before due
const NOTIFICATION_BEFORE_DUE_DAY = 24; // Notify 1 day before due

// Track which notifications have been sent to avoid duplicates
const notifiedTasks = new Set<string>();

// ============================================================================
// Hook
// ============================================================================

export function useNotifications() {
  const {
    initialize,
    addNotification,
    settings,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotificationStore();
  const { tasks } = useTaskStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize notification store on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Check for due date notifications
  const checkDueDateNotifications = useCallback(() => {
    if (!settings.enabled) return;

    const now = new Date();

    tasks.forEach((task: Task) => {
      // Skip completed tasks
      if (task.status === "completed") return;
      if (!task.dueDate) return;

      const dueDate = new Date(task.dueDate);
      const hoursUntilDue =
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Check if task is overdue
      const overdueKey = `overdue-${task.id}`;
      if (hoursUntilDue < 0 && !notifiedTasks.has(overdueKey)) {
        notifiedTasks.add(overdueKey);
        addNotification({
          title: "Task Overdue!",
          message: `"${task.title}" is past its due date`,
          type: "error",
          taskId: task.id,
        });
        return;
      }

      // Check if task is due in 1 hour
      const oneHourKey = `1h-${task.id}`;
      if (
        hoursUntilDue > 0 &&
        hoursUntilDue <= NOTIFICATION_BEFORE_DUE_HOURS &&
        !notifiedTasks.has(oneHourKey)
      ) {
        notifiedTasks.add(oneHourKey);
        addNotification({
          title: "Task Due Soon!",
          message: `"${task.title}" is due in less than 1 hour`,
          type: "warning",
          taskId: task.id,
        });
        return;
      }

      // Check if task is due in 1 day (but more than 1 hour)
      const oneDayKey = `1d-${task.id}`;
      if (
        hoursUntilDue > NOTIFICATION_BEFORE_DUE_HOURS &&
        hoursUntilDue <= NOTIFICATION_BEFORE_DUE_DAY &&
        !notifiedTasks.has(oneDayKey)
      ) {
        notifiedTasks.add(oneDayKey);
        addNotification({
          title: "Task Due Tomorrow",
          message: `"${task.title}" is due within 24 hours`,
          type: "info",
          taskId: task.id,
        });
      }
    });
  }, [tasks, settings.enabled, addNotification]);

  // Set up interval for checking due dates
  useEffect(() => {
    if (!settings.enabled) return;

    // Check immediately
    checkDueDateNotifications();

    // Set up interval
    intervalRef.current = setInterval(
      checkDueDateNotifications,
      CHECK_INTERVAL,
    );

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [settings.enabled, checkDueDateNotifications]);

  // Notify on task creation
  const notifyTaskCreated = useCallback(
    (taskTitle: string, taskId: string) => {
      addNotification({
        title: "Task Created",
        message: `"${taskTitle}" has been added to your tasks`,
        type: "success",
        taskId,
      });
    },
    [addNotification],
  );

  // Notify on task completion
  const notifyTaskCompleted = useCallback(
    (taskTitle: string, taskId: string) => {
      addNotification({
        title: "Task Completed! 🎉",
        message: `You completed "${taskTitle}"`,
        type: "success",
        taskId,
      });
    },
    [addNotification],
  );

  // Notify on task status change
  const notifyTaskStatusChanged = useCallback(
    (taskTitle: string, newStatus: string, taskId: string) => {
      const statusLabels: Record<string, string> = {
        todo: "To Do",
        "in-progress": "In Progress",
        completed: "Completed",
      };
      addNotification({
        title: "Task Updated",
        message: `"${taskTitle}" moved to ${statusLabels[newStatus] || newStatus}`,
        type: "info",
        taskId,
      });
    },
    [addNotification],
  );

  return {
    notifications,
    unreadCount,
    settings,
    markAsRead,
    markAllAsRead,
    clearAll,
    notifyTaskCreated,
    notifyTaskCompleted,
    notifyTaskStatusChanged,
  };
}
