"use client";

/**
 * chat-message-list.tsx — Danh sách toàn bộ tin nhắn trong phiên chat.
 * Tự động scroll xuống cuối mỗi khi có tin mới.
 * Hiển thị skeleton "đang gõ…" khi bot đang xử lý.
 */

import { useRef, useEffect, type MutableRefObject } from "react";
import { Bot } from "lucide-react";
import type { Task, TaskStatus } from "@/lib/types";
import { ChatMessageItem, type DisplayMessage } from "./chat-message-item";
import type { ParsedCreateTaskBlock } from "./chat-utils";

interface ChatMessageListProps {
  messages: DisplayMessage[];
  tasks: Task[];
  isSending: boolean;
  resolvedTaskIdMap: MutableRefObject<Map<string, string>>;
  onTaskCardClick: (
    messageId: string,
    payload: ParsedCreateTaskBlock["payload"],
  ) => void;
  onTaskCardStatusToggle: (
    messageId: string,
    payload: ParsedCreateTaskBlock["payload"],
  ) => void;
  onTaskListItemClick: (task: Task) => void;
  onTaskListItemStatusToggle: (task: Task) => Promise<void>;
}

export function ChatMessageList({
  messages,
  tasks,
  isSending,
  resolvedTaskIdMap,
  onTaskCardClick,
  onTaskCardStatusToggle,
  onTaskListItemClick,
  onTaskListItemStatusToggle,
}: ChatMessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Hello! I&apos;m your AI assistant for Taskify. Ask anything about your
          tasks or try a suggested prompt below.
        </p>
      )}

      {messages.map((message) => (
        <ChatMessageItem
          key={message.id}
          message={message}
          tasks={tasks}
          resolvedTaskIdMap={resolvedTaskIdMap}
          onTaskCardClick={onTaskCardClick}
          onTaskCardStatusToggle={onTaskCardStatusToggle}
          onTaskListItemClick={onTaskListItemClick}
          onTaskListItemStatusToggle={onTaskListItemStatusToggle}
        />
      ))}

      {/* Typing indicator */}
      {isSending && (
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Bot className="h-4 w-4" />
          </div>
          <div className="bg-secondary rounded-lg px-4 py-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
            </div>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
