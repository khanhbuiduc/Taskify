"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Settings,
  HelpCircle,
  LogOut,
  List,
  Table2,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuthStore } from "@/lib/auth-store"
import { API_CONFIG } from "@/lib/api/config"

type View = "dashboard" | "list" | "calendar" | "table" | "ai-chat" | "settings"

const taskViewItems: { icon: React.ElementType; label: string; view: View }[] = [
  { icon: LayoutDashboard, label: "Dashboard", view: "dashboard" },
  { icon: List, label: "List", view: "list" },
  { icon: Calendar, label: "Calendar", view: "calendar" },
  { icon: Table2, label: "Table", view: "table" },
]

const bottomNavItems = [
  { icon: Settings, label: "Settings" },
  { icon: HelpCircle, label: "Help" },
]

interface SidebarProps {
  currentView: View
  onViewChange: (view: View) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function Sidebar({ currentView, onViewChange, isCollapsed, onToggleCollapse }: SidebarProps) {
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const getInitials = (email: string, userName?: string) => {
    if (userName) {
      return userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }
    return email
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

  const getDisplayName = () => {
    if (user?.userName) return user.userName
    return user?.email || ""
  }

  const handleSettingsClick = () => {
    onViewChange("settings")
  }

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  const NavButton = ({
    icon: Icon,
    label,
    isActive,
    onClick,
    variant = "default",
  }: {
    icon: React.ElementType
    label: string
    isActive?: boolean
    onClick?: () => void
    variant?: "default" | "destructive"
  }) => {
    const button = (
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          isCollapsed && "justify-center px-2",
          variant === "destructive"
            ? "text-destructive hover:bg-destructive/10"
            : isActive
              ? "bg-sidebar-accent text-sidebar-primary"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!isCollapsed && <span>{label}</span>}
      </button>
    )

    if (isCollapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {label}
          </TooltipContent>
        </Tooltip>
      )
    }

    return button
  }

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-border bg-sidebar flex flex-col transition-all duration-300",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo & Collapse Toggle */}
        <div className="flex h-16 items-center justify-between border-b border-border px-3">
          <div className={cn("flex items-center gap-2", isCollapsed && "justify-center w-full")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent shrink-0">
              <CheckSquare className="h-5 w-5 text-accent-foreground" />
            </div>
            {!isCollapsed && (
              <span className="text-lg font-semibold text-sidebar-foreground">TaskFlow</span>
            )}
          </div>
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onToggleCollapse}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {/* AI Chat Section */}
          <div>
            {!isCollapsed && (
              <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Assistant
              </p>
            )}
            <NavButton
              icon={MessageSquare}
              label="AI Chat"
              isActive={currentView === "ai-chat"}
              onClick={() => onViewChange("ai-chat")}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Task Views Section */}
          <div>
            {!isCollapsed && (
              <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tasks
              </p>
            )}
            <div className="space-y-1">
              {taskViewItems.map((item) => (
                <NavButton
                  key={item.view}
                  icon={item.icon}
                  label={item.label}
                  isActive={currentView === item.view}
                  onClick={() => onViewChange(item.view)}
                />
              ))}
            </div>
          </div>
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t border-border px-3 py-4 space-y-1">
          <NavButton
            icon={Settings}
            label="Settings"
            onClick={handleSettingsClick}
          />
          <NavButton
            icon={HelpCircle}
            label="Help"
          />
          <NavButton
            icon={LogOut}
            label="Log Out"
            variant="destructive"
            onClick={handleLogout}
          />
        </div>

        {/* User Profile - click to open Account Settings */}
        {user && (
          <div className="border-t border-border p-3">
            <button
              type="button"
              onClick={() => onViewChange("settings")}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/60",
                isCollapsed && "justify-center px-0"
              )}
            >
              <Avatar className="h-9 w-9 shrink-0">
                {getAvatarUrl() && (
                  <AvatarImage src={getAvatarUrl()!} alt={getDisplayName()} />
                )}
                <AvatarFallback className="bg-accent/20 text-accent text-sm font-medium">
                  {getInitials(user.email, user.userName)}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {getDisplayName()}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.roles.join(", ")}
                  </p>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Expand Button (when collapsed) */}
        {isCollapsed && (
          <div className="border-t border-border p-3">
            <Button
              variant="ghost"
              size="icon"
              className="w-full h-8"
              onClick={onToggleCollapse}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </aside>
    </TooltipProvider>
  )
}
