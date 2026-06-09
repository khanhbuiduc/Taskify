"use client";

/**
 * chat-message-list.tsx — Danh sách toàn bộ tin nhắn trong phiên chat.
 * Tự động scroll xuống cuối mỗi khi có tin mới.
 * Hiển thị skeleton "đang gõ…" khi bot đang xử lý.
 */

import { useRef, useEffect, type MutableRefObject } from "react";
import { Bot } from "lucide-react";
import type { FinanceEntry, Task } from "@/lib/types";
import { ChatMessageItem, type DisplayMessage } from "./chat-message-item";
import type { ParsedCreateTaskBlock } from "./chat-utils";

interface ChatMessageListProps {
  messages: DisplayMessage[];
  tasks: Task[];
  isSending: boolean;
  streamStage?: string | null;
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
  onConfirmDeleteSelection: (taskIds: string[]) => void;
  onTaskFilterPage: (direction: "next" | "prev") => void;
  onNoteCardEdit?: (note: any) => void;
  onNoteCardDelete?: (note: any) => void;
  onNoteCardTogglePin?: (note: any) => void;
  onFinanceEntryEdit?: (entry: FinanceEntry) => void;
  onFinanceEntryDelete?: (entry: FinanceEntry) => void;
  activeThinkingMessageId?: string | null;
  onThinkingLabelToggle?: (messageId: string) => void;
}

export function ChatMessageList({
  messages,
  tasks,
  isSending,
  streamStage,
  resolvedTaskIdMap,
  onTaskCardClick,
  onTaskCardStatusToggle,
  onTaskListItemClick,
  onTaskListItemStatusToggle,
  onConfirmDeleteSelection,
  onTaskFilterPage,
  onNoteCardEdit,
  onNoteCardDelete,
  onNoteCardTogglePin,
  onFinanceEntryEdit,
  onFinanceEntryDelete,
  activeThinkingMessageId,
  onThinkingLabelToggle,
}: ChatMessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const hasStreamingAssistantBubble = messages.some(
    (message) => message.role === "assistant" && message.isStreaming,
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const stageLabel =
    streamStage === "normalizing_context"
      ? "Dang phan tich yeu cau..."
      : streamStage === "parsing_intent"
        ? "Dang xac dinh y dinh..."
        : streamStage === "waiting_rasa"
          ? "Dang truy van tro ly..."
          : streamStage === "persisting_reply"
            ? "Dang tong hop cau tra loi..."
            : streamStage === "starting"
              ? "Dang bat dau phien chat..."
              : null;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Hello! I&apos;m your AI assistant for Taskify. Ask anything about your
          tasks or try a suggested prompt below.
        </p>
      )}

      {isSending && stageLabel && (
        <div className="flex justify-center">
          <div className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
            {stageLabel}
          </div>
        </div>
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
          onConfirmDeleteSelection={onConfirmDeleteSelection}
          onTaskFilterPage={onTaskFilterPage}
          onNoteCardEdit={onNoteCardEdit}
          onNoteCardDelete={onNoteCardDelete}
          onNoteCardTogglePin={onNoteCardTogglePin}
          onFinanceEntryEdit={onFinanceEntryEdit}
          onFinanceEntryDelete={onFinanceEntryDelete}
          isThinkingActive={activeThinkingMessageId === message.id}
          onThinkingLabelToggle={onThinkingLabelToggle}
          isSending={isSending}
        />
      ))}

      {/* Typing indicator */}
      {isSending && !hasStreamingAssistantBubble && (
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
