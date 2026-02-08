"use client";

import { useEffect } from "react";
import { useNotificationStore } from "@/lib/notification-store";
import { useTaskStore } from "@/lib/task-store";
import type { Task } from "@/lib/types";

// Track which notifications have been sent to avoid duplicates
const notifiedTasks = new Set<string>();

const NOTIFICATION_BEFORE_DUE_HOURS = 1;
const NOTIFICATION_BEFORE_DUE_DAY = 24;
const CHECK_INTERVAL = 60000; // 1 minute

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { initialize, addNotification, settings } = useNotificationStore();
  const { tasks, isInitialized: tasksInitialized } = useTaskStore();

  // Initialize notification store on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Check for due date notifications
  useEffect(() => {
    if (!settings.enabled || !tasksInitialized) return;

    const checkDueDateNotifications = () => {
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
    };

    // Check immediately
    checkDueDateNotifications();

    // Set up interval for periodic checks
    const interval = setInterval(checkDueDateNotifications, CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [settings.enabled, tasks, tasksInitialized, addNotification]);

  return <>{children}</>;
}
