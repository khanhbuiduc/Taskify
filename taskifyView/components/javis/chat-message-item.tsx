"use client";

/**
 * chat-message-item.tsx — Render một tin nhắn đơn (user hoặc bot).
 *
 * Hỗ trợ 3 dạng nội dung:
 *  1. taskListBlock  – bot trả về danh sách task (task hôm nay, v.v.) → TaskCard list
 *  2. createTaskBlock – bot xác nhận tạo task → TaskCard đơn
 *  3. text           – tin nhắn thông thường
 */

import type { MutableRefObject } from "react";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskCard } from "@/components/task/task-card";
import type { Task, TaskStatus, ChatMessageRole } from "@/lib/types";
import {
  parseCreateTaskBlock,
  parseTaskListBlock,
  findTaskMatches,
  buildPreviewTask,
  foldText,
  type ParsedCreateTaskBlock,
  type ParsedTaskListItem,
} from "./chat-utils";

export interface DisplayMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: Date;
}

interface ChatMessageItemProps {
  message: DisplayMessage;
  tasks: Task[];
  resolvedTaskIdMap: MutableRefObject<Map<string, string>>;
  // Create-task card handlers
  onTaskCardClick: (
    messageId: string,
    payload: ParsedCreateTaskBlock["payload"],
  ) => void;
  onTaskCardStatusToggle: (
    messageId: string,
    payload: ParsedCreateTaskBlock["payload"],
  ) => void;
  // Task-list item handlers
  onTaskListItemClick: (task: Task) => void;
  onTaskListItemStatusToggle: (task: Task) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TextBubble({ content }: { content: string }) {
  return (
    <p className="text-sm leading-relaxed whitespace-pre-line">{content}</p>
  );
}

/** Resolve a ParsedTaskListItem → real Task from store (live data), or build a ghost task */
function resolveListItem(item: ParsedTaskListItem, tasks: Task[]): Task {
  const normalized = foldText(item.title);
  const found = tasks.find((t) => foldText(t.title) === normalized);
  if (found) return found;

  // Ghost task (not found in store) — use parsed snapshot data
  return {
    id: `ghost-${normalized}`,
    title: item.title,
    description: "",
    priority: item.priority,
    status: item.status,
    dueDate: "",
    createdAt: "",
    labels: [],
  };
}

interface TaskListBlockViewProps {
  headerText: string;
  footerText: string;
  items: ParsedTaskListItem[];
  tasks: Task[];
  onItemClick: (task: Task) => void;
  onItemStatusToggle: (task: Task) => Promise<void>;
}

function TaskListBlockView({
  headerText,
  footerText,
  items,
  tasks,
  onItemClick,
  onItemStatusToggle,
}: TaskListBlockViewProps) {
  return (
    <div className="space-y-2">
      {headerText && <TextBubble content={headerText} />}

      <div className="space-y-1.5">
        {items.map((item, idx) => {
          const task = resolveListItem(item, tasks);
          const isGhost = task.id.startsWith("ghost-");
          return (
            <TaskCard
              key={`${task.id}-${idx}`}
              task={task}
              variant="list"
              className={cn(
                "border-border/70 bg-card/90 text-foreground",
                isGhost && "opacity-60 pointer-events-none",
              )}
              onClick={isGhost ? undefined : () => onItemClick(task)}
              onStatusToggle={
                isGhost ? undefined : () => void onItemStatusToggle(task)
              }
            />
          );
        })}
      </div>

      {footerText && (
        <p className="text-xs text-muted-foreground">{footerText}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ChatMessageItem({
  message,
  tasks,
  resolvedTaskIdMap,
  onTaskCardClick,
  onTaskCardStatusToggle,
  onTaskListItemClick,
  onTaskListItemStatusToggle,
}: ChatMessageItemProps) {
  // ── 1. Task-list block (highest priority — check first) ──────────────────
  const taskListBlock =
    message.role === "assistant" ? parseTaskListBlock(message.content) : null;

  // ── 2. Create-task block ─────────────────────────────────────────────────
  const parsedCreateTask =
    !taskListBlock && message.role === "assistant"
      ? parseCreateTaskBlock(message.content)
      : null;

  // Cache-based resolve for create-task card
  const cachedId = parsedCreateTask
    ? resolvedTaskIdMap.current.get(message.id)
    : undefined;
  const cachedTask = cachedId
    ? (tasks.find((t) => t.id === cachedId) ?? null)
    : null;

  const matches =
    parsedCreateTask && !cachedTask
      ? findTaskMatches(tasks, parsedCreateTask.payload)
      : [];

  if (parsedCreateTask && !cachedTask && matches.length === 1) {
    resolvedTaskIdMap.current.set(message.id, matches[0].id);
  }

  const matchedTask = cachedTask ?? (matches.length === 1 ? matches[0] : null);
  const previewTask = parsedCreateTask
    ? buildPreviewTask(message.id, message.timestamp, parsedCreateTask.payload)
    : null;
  const displayTask = matchedTask ?? previewTask;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "flex gap-3",
        message.role === "user" ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          message.role === "user"
            ? "bg-accent text-accent-foreground"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {message.role === "user" ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "rounded-lg px-4 py-2.5",
          taskListBlock ? "max-w-[90%]" : "max-w-[75%]",
          message.role === "user"
            ? "bg-accent text-accent-foreground"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {/* Case 1: Task list */}
        {taskListBlock ? (
          <TaskListBlockView
            headerText={taskListBlock.headerText}
            footerText={taskListBlock.footerText}
            items={taskListBlock.items}
            tasks={tasks}
            onItemClick={onTaskListItemClick}
            onItemStatusToggle={onTaskListItemStatusToggle}
          />
        ) : /* Case 2: Create-task card */ parsedCreateTask && displayTask ? (
          <div className="space-y-2">
            {parsedCreateTask.prefixText && (
              <TextBubble content={parsedCreateTask.prefixText} />
            )}
            <TaskCard
              task={displayTask}
              variant="list"
              onClick={() =>
                onTaskCardClick(message.id, parsedCreateTask.payload)
              }
              onStatusToggle={() =>
                onTaskCardStatusToggle(message.id, parsedCreateTask.payload)
              }
              className="border-border/70 bg-card/90 text-foreground"
            />
            {parsedCreateTask.suffixText && (
              <TextBubble content={parsedCreateTask.suffixText} />
            )}
          </div>
        ) : (
          /* Case 3: Plain text */
          <TextBubble content={message.content} />
        )}

        {/* Timestamp */}
        <p
          className={cn(
            "text-xs mt-1",
            message.role === "user"
              ? "text-accent-foreground/70"
              : "text-muted-foreground",
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
