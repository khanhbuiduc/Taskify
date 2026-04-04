"use client";

import { useEffect } from "react";
import { useTaskStore } from "@/lib/task-store";

export function TaskStoreInitializer({ children }: { children: React.ReactNode }) {
  const { fetchTasks, fetchLabels, isInitialized } = useTaskStore();

  useEffect(() => {
    if (!isInitialized) {
      fetchTasks();
      fetchLabels();
    }
  }, [fetchTasks, fetchLabels, isInitialized]);

  return <>{children}</>;
}
