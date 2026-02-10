"use client";

import { useMemo } from "react";
import {
  Target,
  Check,
  Circle,
  AlertCircle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useTaskStore } from "@/lib/task-store";
import { cn, stripHtml } from "@/lib/utils";
import type { Task } from "@/lib/types";

// Get today's date in local timezone for comparison
function isToday(dateString: string): boolean {
  const taskDate = new Date(dateString);
  const today = new Date();
  return (
    taskDate.getFullYear() === today.getFullYear() &&
    taskDate.getMonth() === today.getMonth() &&
    taskDate.getDate() === today.getDate()
  );
}

// Check if a task is overdue
function isOverdue(dateString: string): boolean {
  const taskDate = new Date(dateString);
  const now = new Date();
  return taskDate < now;
}

const priorityColors = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-blue-500",
};

const statusIcons = {
  todo: Circle,
  "in-progress": Clock,
  completed: CheckCircle2,
};

export function DailyGoals() {
  const { tasks, updateTaskStatus, isLoading } = useTaskStore();

  // Filter today's tasks
  const todaysTasks = useMemo(() => {
    return tasks.filter((task) => isToday(task.dueDate));
  }, [tasks]);

  const completedCount = todaysTasks.filter(
    (t) => t.status === "completed",
  ).length;
  const totalCount = todaysTasks.length;
  const progressPercent =
    totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleToggleTask = async (task: Task) => {
    const newStatus = task.status === "completed" ? "todo" : "completed";
    await updateTaskStatus(task.id, newStatus);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Target className="size-5" />
          <span className="text-sm font-medium">Today&apos;s Tasks</span>
        </div>
        {totalCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {completedCount}/{totalCount}
          </span>
        )}
      </div>

      {/* Progress */}
      {totalCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {completedCount}/{totalCount} completed
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-chart-2 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground">
            <div className="size-6 mx-auto mb-2 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <p className="text-sm">Loading tasks...</p>
          </div>
        ) : todaysTasks.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Target className="size-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tasks for today</p>
            <p className="text-xs">
              All your today&apos;s tasks will appear here
            </p>
          </div>
        ) : (
          todaysTasks.map((task) => {
            const StatusIcon = statusIcons[task.status];
            const overdue =
              task.status !== "completed" && isOverdue(task.dueDate);

            return (
              <div
                key={task.id}
                className={cn(
                  "group flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  task.status === "completed"
                    ? "bg-muted/50 border-transparent"
                    : "bg-background border-border hover:border-accent/50",
                  overdue && "border-red-500/30 bg-red-500/5",
                )}
              >
                <Checkbox
                  checked={task.status === "completed"}
                  onCheckedChange={() => handleToggleTask(task)}
                />
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "block text-sm transition-all truncate",
                      task.status === "completed" &&
                        "line-through text-muted-foreground",
                    )}
                  >
                    {task.title}
                  </span>
                  {task.description && (
                    <span className="text-xs text-muted-foreground truncate block">
                      {stripHtml(task.description).slice(0, 50)}
                      {stripHtml(task.description).length > 50 && "..."}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {overdue && <AlertCircle className="size-4 text-red-500" />}
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      priorityColors[task.priority],
                    )}
                  />
                  {task.status === "completed" && (
                    <Check className="size-4 text-chart-2" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Motivational Message */}
      {totalCount > 0 && completedCount === totalCount && (
        <div className="text-center py-3 bg-chart-2/10 rounded-lg border border-chart-2/20">
          <p className="text-sm font-medium text-chart-2">
            🎉 All tasks completed! Great job!
          </p>
        </div>
      )}
    </div>
  );
}
