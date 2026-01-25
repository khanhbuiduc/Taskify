"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/dashboard/sidebar"
import { TopBar } from "@/components/dashboard/top-bar"
import { ListView } from "@/components/tasks/list-view"
import { CalendarView } from "@/components/tasks/calendar-view"
import { DashboardView } from "@/components/tasks/dashboard-view"
import { TableView } from "@/components/tasks/table-view"
import { AIChatView } from "@/components/tasks/ai-chat-view"
import { useTaskStore } from "@/lib/task-store"

type View = "dashboard" | "list" | "calendar" | "table" | "ai-chat"

export default function TaskManagementApp() {
  const [currentView, setCurrentView] = useState<View>("dashboard")
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const { fetchTasks, isLoading, isInitialized } = useTaskStore()

  // Fetch tasks when component mounts
  useEffect(() => {
    if (!isInitialized) {
      fetchTasks()
    }
  }, [fetchTasks, isInitialized])

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <DashboardView />
      case "list":
        return <ListView />
      case "calendar":
        return <CalendarView />
      case "table":
        return <TableView />
      case "ai-chat":
        return <AIChatView />
      default:
        return <DashboardView />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main
        className={cn(
          "transition-all duration-300",
          isSidebarCollapsed ? "ml-16" : "ml-64"
        )}
      >
        <TopBar currentView={currentView} />
        <div className="p-6">{renderView()}</div>
      </main>
    </div>
  )
}
