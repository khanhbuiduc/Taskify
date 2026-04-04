"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Settings,
  HelpCircle,
  LogOut,
  MessageSquare,
  Timer,
  Book,
  CalendarDays,
  DollarSign,
  CheckSquare,
  Command,
} from "lucide-react";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/auth-store";
import { API_CONFIG } from "@/lib/api/config";

import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type View =
  | "tasks"
  | "notes"
  | "events"
  | "finance"
  | "ai-chat"
  | "settings"
  | "focus";

const productivityItems: { icon: React.ElementType; label: string; view: View }[] = [
  { icon: CheckSquare, label: "Task", view: "tasks" },
  { icon: Book, label: "Notes", view: "notes" },
  { icon: CalendarDays, label: "Events", view: "events" },
  { icon: DollarSign, label: "Finance", view: "finance" },
];

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  // deprecated unused
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  currentView,
  onViewChange,
}: SidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { state } = useSidebar();

  const getInitials = (email: string, userName?: string) => {
    if (userName) {
      return userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email.split("@")[0].split(".").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getAvatarUrl = () => {
    if (!user?.avatarUrl) return null;
    if (user.avatarUrl.startsWith("http")) return user.avatarUrl;
    return `${API_CONFIG.baseURL}${user.avatarUrl}`;
  };

  const getDisplayName = () => {
    if (user?.userName) return user.userName;
    return user?.email || "";
  };

  return (
    <UISidebar collapsible="icon" className="border-border">
      <SidebarHeader className="h-16 flex flex-row items-center justify-between px-3 py-2">
        {state === "expanded" && (
          <div 
            className="flex flex-1 items-center gap-3 overflow-hidden cursor-pointer hover:opacity-80 px-1"
            onClick={() => onViewChange("tasks")}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Command className="size-5" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-bold text-lg">TaskFlow</span>
              <span className="truncate text-xs text-muted-foreground">Workspace</span>
            </div>
          </div>
        )}
        <SidebarTrigger className={cn("shrink-0", state === "collapsed" && "mx-auto")} />
      </SidebarHeader>

      <SidebarContent className="py-2 gap-4">
        {/* Assistant Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Assistant</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentView === "ai-chat"}
                onClick={() => onViewChange("ai-chat")}
                tooltip="AI Chat"
                className="data-[active=true]:text-green-600 dark:data-[active=true]:text-green-500"
              >
                <MessageSquare className="size-4" />
                <span>AI Chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Productivity Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Productivity</SidebarGroupLabel>
          <SidebarMenu>
            {productivityItems.map((item) => (
              <SidebarMenuItem key={item.view}>
                <SidebarMenuButton
                  isActive={currentView === item.view}
                  onClick={() => onViewChange(item.view)}
                  tooltip={item.label}
                  className="data-[active=true]:text-green-600 dark:data-[active=true]:text-green-500"
                >
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Focus Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Focus</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentView === "focus"}
                onClick={() => onViewChange("focus")}
                tooltip="Focus Session"
                className="data-[active=true]:text-green-600 dark:data-[active=true]:text-green-500"
              >
                <Timer className="size-4" />
                <span>Focus Session</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border pt-4 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => onViewChange("settings")}
              isActive={currentView === "settings"}
              tooltip="Settings"
              className="data-[active=true]:text-green-600 dark:data-[active=true]:text-green-500"
            >
              <Settings className="size-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Help">
              <HelpCircle className="size-4" />
              <span>Help</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Log Out"
              onClick={async () => {
                await logout();
                router.push("/login");
              }}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-4" />
              <span>Log Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* User Profile */}
          {user && (
            <SidebarMenuItem className="mt-4">
              <SidebarMenuButton
                size="lg"
                onClick={() => onViewChange("settings")}
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground border border-transparent"
              >
                <Avatar className="h-8 w-8 rounded-lg shrink-0">
                  {getAvatarUrl() && (
                    <AvatarImage src={getAvatarUrl()!} alt={getDisplayName()} />
                  )}
                  <AvatarFallback className="bg-accent/20 text-accent text-xs font-medium rounded-lg">
                    {getInitials(user.email, user.userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{getDisplayName()}</span>
                  <span className="truncate text-xs opacity-70">
                    {user.roles.join(", ")}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </UISidebar>
  );
}
