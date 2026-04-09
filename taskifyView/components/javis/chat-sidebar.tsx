"use client";

/**
 * chat-sidebar.tsx — Panel danh sách hội thoại bên trái chat.
 */

import { MessagesSquare, Plus, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/lib/types";

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isSending: boolean;
  collapsed: boolean;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  isSending,
  collapsed,
  onSelectSession,
  onNewSession,
}: ChatSidebarProps) {
  return (
    <div
      className={cn(
        "flex flex-col border border-border/70 rounded-lg bg-card transition-[width] duration-300 ease-in-out overflow-hidden min-h-0",
        collapsed ? "w-0 opacity-0" : "w-64 opacity-100",
      )}
    >
      <div
        className={cn(
          "flex flex-col h-full transition-opacity duration-200 ease-in-out",
          collapsed ? "opacity-0 pointer-events-none" : "opacity-100",
        )}
        aria-hidden={collapsed}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-border/70">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MessagesSquare className="h-4 w-4" />
            <span className="truncate">Conversations</span>
          </div>
        </div>

        {/* New chat button */}
        <div className="p-3 border-b border-border/70">
          <Button
            size="sm"
            className="w-full max-w-full justify-start gap-2 overflow-hidden"
            onClick={onNewSession}
            disabled={isSending}
          >
            <Plus className="h-4 w-4" />
            <span className="truncate">New chat</span>
          </Button>
        </div>

        {/* Session list */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {sessions.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-3">
                  No conversations yet. Start a new chat.
                </div>
              )}
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    "w-full max-w-full text-left rounded-lg px-3 py-2 transition-colors border border-transparent overflow-hidden",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:ring-offset-background",
                    "hover:bg-accent/30 hover:border-accent/40",
                    session.id === activeSessionId
                      ? "bg-accent text-accent-foreground"
                      : "bg-transparent text-foreground",
                  )}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium max-w-full break-words whitespace-normal leading-snug overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                        {session.title || "Untitled"}
                      </div>
                    </div>
                    <MoreHorizontal className="h-4 w-4 shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
