"use client";

/**
 * chat-sidebar.tsx — Panel danh sách hội thoại bên trái chat.
 */

import { MessagesSquare, Plus, Trash2 } from "lucide-react";
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
  onDeleteSession?: (id: string) => void;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  isSending,
  collapsed,
  onSelectSession,
  onNewSession,
  onDeleteSession,
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
            className="w-full justify-start gap-2 overflow-hidden"
            onClick={onNewSession}
            disabled={isSending}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1 truncate text-left">New chat New chat New chat New chat</div>
          </Button>
        </div>

        {/* Session list */}
        <ScrollArea className="flex-1 min-h-0 [&>[data-slot=scroll-area-viewport]>div]:!block">
          <div className="p-2 space-y-1">
            {sessions.length === 0 && (
              <div className="text-xs text-muted-foreground px-2 py-3">
                No conversations yet. Start a new chat.
              </div>
            )}

            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "flex items-center w-full min-w-0 justify-between gap-1 overflow-hidden group rounded-md transition-colors",
                  session.id === activeSessionId
                    ? "bg-accent text-accent-foreground hover:bg-accent/90"
                    : "text-foreground hover:bg-accent/30"
                )}
              >
                <button
                  onClick={() => onSelectSession(session.id)}
                  className="flex-1 min-w-0 justify-start overflow-hidden hover:bg-transparent h-9 px-4 text-left outline-none"
                >
                  <div className="flex-1 min-w-0 truncate text-sm font-medium">
                    {session.title || "Untitled"}
                  </div>
                </button>
                {onDeleteSession && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive mr-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
