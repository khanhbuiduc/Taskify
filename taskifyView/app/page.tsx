"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TopBar } from "@/components/dashboard/top-bar";
import { TasksContainer } from "@/components/tasks/tasks-container";
import { ComingSoonView } from "@/components/coming-soon/coming-soon-view";
import { AIChatView } from "@/components/tasks/ai-chat-view";
import { SettingsView } from "@/components/settings/settings-view";
import { FocusView } from "@/components/focus/focus-view";
import { AuthGuard } from "@/components/auth-guard";
import { useTaskStore } from "@/lib/task-store";

type View =
  | "tasks"
  | "notes"
  | "events"
  | "finance"
  | "ai-chat"
  | "settings"
  | "focus";

export default function TaskManagementApp() {
  const [currentView, setCurrentView] = useState<View>("tasks");
  const { fetchTasks, fetchLabels, isLoading, isInitialized } = useTaskStore();

  // Fetch tasks when component mounts
  useEffect(() => {
    if (!isInitialized) {
      fetchTasks();
      fetchLabels();
    }
  }, [fetchTasks, fetchLabels, isInitialized]);

  const renderView = () => {
    switch (currentView) {
      case "tasks":
        return <TasksContainer />;
      case "notes":
        return <ComingSoonView title="Notes" />;
      case "events":
        return <ComingSoonView title="Events" />;
      case "finance":
        return <ComingSoonView title="Finance" />;
      case "ai-chat":
        return <AIChatView />;
      case "settings":
        return <SettingsView />;
      case "focus":
        return <FocusView />;
      default:
        return <TasksContainer />;
    }
  };

  return (
    <AuthGuard>
      <SidebarProvider>
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
        />
        <SidebarInset>
          <TopBar
            currentView={currentView}
            onOpenSettings={() => setCurrentView("settings")}
          />
          <div className="p-6 min-h-0 flex-1">{renderView()}</div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
