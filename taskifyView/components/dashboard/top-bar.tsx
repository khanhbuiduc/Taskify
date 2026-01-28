"use client"

import { useRouter } from "next/navigation"
import { Bell, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "./theme-toggle"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useAuthStore } from "@/lib/auth-store"
import { API_CONFIG } from "@/lib/api/config"

type View = "dashboard" | "list" | "calendar" | "table" | "ai-chat" | "settings"

const viewTitles: Record<View, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Overview of your tasks" },
  list: { title: "List View", subtitle: "Manage tasks in a list format" },
  calendar: { title: "Calendar", subtitle: "View tasks by date" },
  table: { title: "Table View", subtitle: "View tasks in a data table" },
  "ai-chat": { title: "AI Assistant", subtitle: "Chat with AI to manage tasks" },
  settings: { title: "Account Settings", subtitle: "Manage your account and preferences" },
}

interface TopBarProps {
  currentView: View
  onNewTask?: () => void
  onOpenSettings?: () => void
}

export function TopBar({ currentView, onNewTask, onOpenSettings }: TopBarProps) {
  const router = useRouter()
  const { title, subtitle } = viewTitles[currentView]
  const { user, logout } = useAuthStore()

  const getInitials = () => {
    if (!user) return "U"
    if (user.userName) {
      return user.userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }
    return user.email
      .split("@")[0]
      .split(".")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getAvatarUrl = () => {
    if (!user?.avatarUrl) return null
    // If avatarUrl is absolute URL, use it directly
    if (user.avatarUrl.startsWith('http')) {
      return user.avatarUrl
    }
    // Otherwise, prepend API base URL
    return `${API_CONFIG.baseURL}${user.avatarUrl}`
  }

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Add Task Button */}
        {onNewTask && currentView !== "settings" && (
          <Button onClick={onNewTask} size="sm" className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Task</span>
          </Button>
        )}

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-accent text-[10px] font-medium text-accent-foreground flex items-center justify-center">
                3
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">New task assigned</span>
              <span className="text-xs text-muted-foreground">Design review for landing page</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">Project deadline approaching</span>
              <span className="text-xs text-muted-foreground">Mobile app release in 2 days</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">Team meeting reminder</span>
              <span className="text-xs text-muted-foreground">Sprint planning at 3:00 PM</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                {getAvatarUrl() && (
                  <AvatarImage src={getAvatarUrl()!} alt={user?.userName || user?.email || "User"} />
                )}
                <AvatarFallback className="bg-accent/20 text-accent text-sm font-medium">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenSettings}>Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenSettings}>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
