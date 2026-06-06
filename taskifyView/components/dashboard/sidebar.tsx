"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Settings,
  HelpCircle,
  LogOut,
  Timer,
  Users,
  Book,
  CalendarDays,
  DollarSign,
  CheckSquare,
  Plus,
  Trash2,
  ChevronRight,
} from "lucide-react";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/auth-store";
import { useChatSessionStore } from "@/lib/chat-session-store";
import { API_CONFIG } from "@/lib/api/config";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
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

const productivityItems: {
  icon: React.ElementType;
  label: string;
  href: string;
}[] = [
  { icon: CheckSquare, label: "Task", href: "/tasks" },
  { icon: Book, label: "Notes", href: "/notes" },
  { icon: CalendarDays, label: "Events", href: "/events" },
  { icon: DollarSign, label: "Finance", href: "/finance" },
];

interface SidebarProps {
  currentView?: View;
  onViewChange?: React.Dispatch<React.SetStateAction<View>>;
  // deprecated unused
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({}: SidebarProps = {}) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const pathname = usePathname();
  const { state } = useSidebar();
  const { sessions, activeSessionId, createNewSession, selectSession, deleteSession } =
    useChatSessionStore();

  const getInitials = (email: string, userName?: string) => {
    if (userName) {
      return userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email
      .split("@")[0]
      .split(".")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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
          <Link
            href="/tasks"
            className="flex flex-1 items-center gap-3 overflow-hidden cursor-pointer hover:opacity-80 px-1"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 overflow-hidden">
              <Image
                src="/jarvis-light.png"
                alt="Jarvis light"
                width={40}
                height={40}
                className="size-10 object-contain dark:hidden"
                priority
              />
              <Image
                src="/jarvis-dark.png"
                alt="Jarvis dark"
                width={40}
                height={40}
                className="hidden size-10 object-contain dark:block"
                priority
              />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-bold text-lg">Taskify</span>
              <span className="truncate text-xs text-muted-foreground">Workspace</span>
            </div>
          </Link>
        )}
        <SidebarTrigger className={cn("shrink-0", state === "collapsed" && "mx-auto")} />
      </SidebarHeader>

      <SidebarContent className="py-2 gap-4">
        <SidebarGroup>
          <SidebarGroupLabel>Assistant</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  createNewSession();
                  if (!pathname.startsWith("/ai")) router.push("/ai");
                }}
                isActive={
                  pathname.startsWith("/ai") &&
                  (!activeSessionId || !sessions.some((s) => s.id === activeSessionId))
                }
                tooltip="New chat"
                className="data-[active=true]:text-green-600 dark:data-[active=true]:text-green-500 cursor-pointer"
              >
                <Plus className="size-4" />
                <span>New chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <Collapsible defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Recent Chats">
                    <ChevronRight className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    <span>Recent Chats</span>
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {sessions.length === 0 ? (
                      <div className="text-xs text-muted-foreground px-2 py-2">
                        No conversations yet.
                      </div>
                    ) : (
                      sessions.map((session) => (
                        <SidebarMenuSubItem key={session.id}>
                          <div className="flex items-center justify-between group/session w-full overflow-hidden">
                            <SidebarMenuSubButton
                              asChild
                              isActive={session.id === activeSessionId && pathname.startsWith("/ai")}
                              onClick={() => {
                                selectSession(session.id);
                                if (!pathname.startsWith("/ai")) router.push("/ai");
                              }}
                              className="cursor-pointer flex-1 min-w-0 data-[active=true]:text-green-600 dark:data-[active=true]:text-green-500"
                            >
                              <span className="truncate">{session.title || "Untitled"}</span>
                            </SidebarMenuSubButton>
                            <button
                              className="h-5 w-5 opacity-0 group-hover/session:opacity-100 hover:text-destructive shrink-0 flex items-center justify-center transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(session.id);
                              }}
                              title="Delete Chat"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </SidebarMenuSubItem>
                      ))
                    )}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Productivity</SidebarGroupLabel>
          <SidebarMenu>
            {productivityItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
                  tooltip={item.label}
                  className="data-[active=true]:text-green-600 dark:data-[active=true]:text-green-500"
                >
                  <Link href={item.href}>
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Focus</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith("/focus")}
                tooltip="Focus Session"
                className="data-[active=true]:text-green-600 dark:data-[active=true]:text-green-500"
              >
                <Link href="/focus">
                  <Timer className="size-4" />
                  <span>Focus Session</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {user?.roles.includes("Admin") && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith("/admin/users")}
                  tooltip="User Management"
                  className="data-[active=true]:text-green-600 dark:data-[active=true]:text-green-500"
                >
                  <Link href="/admin/users">
                    <Users className="size-4" />
                    <span>User Management</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border pt-4 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/settings"}
              tooltip="Settings"
              className="data-[active=true]:text-green-600 dark:data-[active=true]:text-green-500"
            >
              <Link href="/settings">
                <Settings className="size-4" />
                <span>Settings</span>
              </Link>
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

          {user && (
            <SidebarMenuItem className="mt-4">
              <SidebarMenuButton
                asChild
                size="lg"
                isActive={pathname.startsWith("/settingsaccount")}
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground border border-transparent"
              >
                <Link href="/settingsaccount">
                  <Avatar className="h-8 w-8 rounded-lg shrink-0">
                    {getAvatarUrl() && <AvatarImage src={getAvatarUrl()!} alt={getDisplayName()} />}
                    <AvatarFallback className="bg-accent/20 text-accent text-xs font-medium rounded-lg">
                      {getInitials(user.email, user.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{getDisplayName()}</span>
                    <span className="truncate text-xs opacity-70">{user.roles.join(", ")}</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </UISidebar>
  );
}
