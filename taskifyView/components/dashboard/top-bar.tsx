"use client";

import { useRouter } from "next/navigation";
import { Bell, Plus, Check, Trash2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/auth-store";
import { API_CONFIG } from "@/lib/api/config";
import {
  useNotificationStore,
  type Notification,
} from "@/lib/notification-store";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type View =
  | "dashboard"
  | "list"
  | "calendar"
  | "table"
  | "ai-chat"
  | "settings";

const viewTitles: Record<View, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Overview of your tasks" },
  list: { title: "List View", subtitle: "Manage tasks in a list format" },
  calendar: { title: "Calendar", subtitle: "View tasks by date" },
  table: { title: "Table View", subtitle: "View tasks in a data table" },
  "ai-chat": {
    title: "AI Assistant",
    subtitle: "Chat with AI to manage tasks",
  },
  settings: {
    title: "Account Settings",
    subtitle: "Manage your account and preferences",
  },
};

// Helper function to format time ago
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

interface TopBarProps {
  currentView: View;
  onNewTask?: () => void;
  onOpenSettings?: () => void;
}

export function TopBar({
  currentView,
  onNewTask,
  onOpenSettings,
}: TopBarProps) {
  const router = useRouter();
  const { title, subtitle } = viewTitles[currentView];
  const { user, logout } = useAuthStore();
  const {
    notifications,
    unreadCount,
    settings: notificationSettings,
    initialize: initializeNotifications,
    markAsRead,
    markAllAsRead,
    removeNotification,
    updateSettings: updateNotificationSettings,
  } = useNotificationStore();

  // Initialize notifications on mount
  useEffect(() => {
    initializeNotifications();
  }, [initializeNotifications]);

  const getInitials = () => {
    if (!user) return "U";
    if (user.userName) {
      return user.userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email
      .split("@")[0]
      .split(".")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarUrl = () => {
    if (!user?.avatarUrl) return null;
    // If avatarUrl is absolute URL, use it directly
    if (user.avatarUrl.startsWith("http")) {
      return user.avatarUrl;
    }
    // Otherwise, prepend API base URL
    return `${API_CONFIG.baseURL}${user.avatarUrl}`;
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

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
          <Button
            onClick={onNewTask}
            size="sm"
            className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
          >
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
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-accent text-[10px] font-medium text-accent-foreground flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2">
              <DropdownMenuLabel className="px-0">
                Notifications
              </DropdownMenuLabel>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.preventDefault();
                    updateNotificationSettings({
                      soundEnabled: !notificationSettings.soundEnabled,
                    });
                  }}
                  title={
                    notificationSettings.soundEnabled
                      ? "Mute sounds"
                      : "Unmute sounds"
                  }
                >
                  {notificationSettings.soundEnabled ? (
                    <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={(e) => {
                      e.preventDefault();
                      markAllAsRead();
                    }}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Mark all read
                  </Button>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                {notifications.slice(0, 20).map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex flex-col items-start gap-1 py-3 px-2 cursor-pointer hover:bg-muted/50 border-l-2",
                      notification.read
                        ? "border-l-transparent opacity-60"
                        : "border-l-accent bg-accent/5",
                    )}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start justify-between w-full gap-2">
                      <span
                        className={cn(
                          "font-medium text-sm",
                          !notification.read && "text-foreground",
                        )}
                      >
                        {notification.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0 opacity-0 hover:opacity-100 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notification.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {notification.message}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                ))}
              </ScrollArea>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                {getAvatarUrl() && (
                  <AvatarImage
                    src={getAvatarUrl()!}
                    alt={user?.userName || user?.email || "User"}
                  />
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
            <DropdownMenuItem onClick={onOpenSettings}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenSettings}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={handleLogout}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
