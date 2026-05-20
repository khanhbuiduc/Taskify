"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import { Bot, Pencil, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskCard } from "@/components/task/task-card";
import { NoteCard } from "@/components/notes/note-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Task, ChatMessageRole, Note, FinanceEntry } from "@/lib/types";
import {
  parseCreateTaskBlock,
  parseTaskListBlock,
  parseAssistantPayload,
  findTaskMatches,
  buildPreviewTask,
  foldText,
  type ParsedCreateTaskBlock,
  type ParsedTaskListItem,
  type TaskPickerPayload,
  type NotePickerPayload,
  type TaskListPagePayload,
  type FinanceEntryListPayload,
  type FinanceSummaryPayload,
  type FinanceCategoryListPayload,
} from "./chat-utils";

export interface DisplayMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  metadataJson?: string | null;
  timestamp: Date;
}

interface ChatMessageItemProps {
  message: DisplayMessage;
  tasks: Task[];
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
  onNoteCardEdit?: (note: Note) => void;
  onNoteCardDelete?: (note: Note) => void;
  onNoteCardTogglePin?: (note: Note) => void;
  onFinanceEntryEdit?: (entry: FinanceEntry) => void;
  onFinanceEntryDelete?: (entry: FinanceEntry) => void;
  isSending: boolean;
}

function TextBubble({ content }: { content: string }) {
  return <p className="text-sm leading-relaxed whitespace-pre-line">{content}</p>;
}

function TaskPickerPayloadView({
  payload,
  onConfirmDeleteSelection,
  isSending,
}: {
  payload: TaskPickerPayload;
  onConfirmDeleteSelection: (taskIds: string[]) => void;
  isSending: boolean;
}) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedTaskIds(new Set(payload.tasks.map((task) => task.id)));
  }, [payload.tasks, payload.prompt]);

  const selectedCount = selectedTaskIds.size;

  return (
    <div className="space-y-2">
      <TextBubble content={payload.prompt} />
      <div className="space-y-2">
        {payload.tasks.map((task) => {
          const checked = selectedTaskIds.has(task.id);
          return (
            <label
              key={task.id}
              className="flex items-start gap-2 rounded-md border border-border/70 bg-card/80 p-2 cursor-pointer"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => {
                  setSelectedTaskIds((prev) => {
                    const next = new Set(prev);
                    if (value) next.add(task.id);
                    else next.delete(task.id);
                    return next;
                  });
                }}
                className="mt-0.5"
              />
              <div className="text-sm">
                <p className="font-medium text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.priority} • {task.status}
                </p>
              </div>
            </label>
          );
        })}
      </div>
      <Button
        type="button"
        size="sm"
        disabled={selectedCount === 0 || isSending}
        onClick={() => onConfirmDeleteSelection(Array.from(selectedTaskIds))}
      >
        Xoa {selectedCount > 0 ? `${selectedCount} task` : ""}
      </Button>
    </div>
  );
}

function TaskListPagePayloadView({
  payload,
  onTaskClick,
  onTaskStatusToggle,
  onTaskFilterPage,
  isSending,
}: {
  payload: TaskListPagePayload;
  onTaskClick: (task: Task) => void;
  onTaskStatusToggle: (task: Task) => Promise<void>;
  onTaskFilterPage: (direction: "next" | "prev") => void;
  isSending: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm">
        Trang {payload.page}/{Math.max(payload.totalPages || 1, 1)} • {payload.totalCount} task
      </p>

      <div className="space-y-1.5">
        {payload.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            variant="list"
            className="border-border/70 bg-card/90 text-foreground"
            onClick={() => onTaskClick(task)}
            onStatusToggle={() => void onTaskStatusToggle(task)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!payload.hasPrev || isSending}
          onClick={() => onTaskFilterPage("prev")}
        >
          Prev
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!payload.hasNext || isSending}
          onClick={() => onTaskFilterPage("next")}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function NotePickerPayloadView({
  payload,
  messageContent,
  onEdit,
  onDelete,
  onTogglePin
}: {
  payload: NotePickerPayload;
  messageContent: string;
  onEdit?: (n: Note) => void;
  onDelete?: (n: Note) => void;
  onTogglePin?: (n: Note) => void;
}) {
  return (
    <div className="space-y-2">
      <TextBubble content={messageContent} />
      {payload.notes && payload.notes.length > 0 && (
        <div className="grid gap-2 grid-cols-1 md:grid-cols-2 mt-2">
          {payload.notes.map((note) => (
            <NoteCard 
              key={note.id} 
              note={note} 
              onEdit={onEdit || (() => {})} 
              onDelete={onDelete || (() => {})} 
              onTogglePin={onTogglePin || (() => {})} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
}

function FinanceEntryPayloadView({
  payload,
  messageContent,
  onEdit,
  onDelete,
}: {
  payload: FinanceEntryListPayload;
  messageContent: string;
  onEdit?: (entry: FinanceEntry) => void;
  onDelete?: (entry: FinanceEntry) => void;
}) {
  return (
    <div className="space-y-2">
      <TextBubble content={payload.prompt || messageContent} />
      <div className="space-y-2">
        {payload.entries.map((entry) => (
          <div
            key={entry.id}
            className="rounded-md border border-border/70 bg-card/90 p-3 text-foreground"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{formatMoney(entry.amount)}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.category} - {formatDate(entry.date)}
                </p>
                {entry.description && (
                  <p className="mt-1 text-sm leading-snug">{entry.description}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                {onEdit && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => onEdit(entry)}
                    aria-label="Sua muc tai chinh"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(entry)}
                    aria-label="Xoa muc tai chinh"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinanceSummaryPayloadView({ payload, messageContent }: {
  payload: FinanceSummaryPayload;
  messageContent: string;
}) {
  return (
    <div className="space-y-2">
      <TextBubble content={messageContent} />
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md border border-border/70 bg-card/90 p-2">
          <p className="text-xs text-muted-foreground">Tong</p>
          <p className="text-sm font-semibold">{formatMoney(payload.summary.totalAmount)}</p>
        </div>
        <div className="rounded-md border border-border/70 bg-card/90 p-2">
          <p className="text-xs text-muted-foreground">So muc</p>
          <p className="text-sm font-semibold">{payload.summary.count}</p>
        </div>
        <div className="rounded-md border border-border/70 bg-card/90 p-2">
          <p className="text-xs text-muted-foreground">TB</p>
          <p className="text-sm font-semibold">{formatMoney(payload.summary.averageAmount)}</p>
        </div>
      </div>
    </div>
  );
}

function FinanceCategoryPayloadView({ payload, messageContent }: {
  payload: FinanceCategoryListPayload;
  messageContent: string;
}) {
  return (
    <div className="space-y-2">
      <TextBubble content={messageContent} />
      <div className="flex flex-wrap gap-1.5">
        {payload.categories.map((category) => (
          <span
            key={category.id}
            className="rounded-md border border-border/70 bg-card/90 px-2 py-1 text-xs text-foreground"
          >
            {category.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function resolveListItem(item: ParsedTaskListItem, tasks: Task[]): Task {
  const normalized = foldText(item.title);
  const found = tasks.find((task) => foldText(task.title) === normalized);
  if (found) return found;

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

export function ChatMessageItem({
  message,
  tasks,
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
  isSending,
}: ChatMessageItemProps) {
  const assistantPayload =
    message.role === "assistant"
      ? parseAssistantPayload(message.metadataJson ?? null)
      : null;

  const taskListBlock =
    !assistantPayload && message.role === "assistant"
      ? parseTaskListBlock(message.content)
      : null;

  const parsedCreateTask =
    !assistantPayload && !taskListBlock && message.role === "assistant"
      ? parseCreateTaskBlock(message.content)
      : null;

  const cachedId = parsedCreateTask
    ? resolvedTaskIdMap.current.get(message.id)
    : undefined;
  const cachedTask = cachedId
    ? (tasks.find((task) => task.id === cachedId) ?? null)
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

  return (
    <div
      className={cn(
        "flex gap-3",
        message.role === "user" ? "flex-row-reverse" : "flex-row",
      )}
    >
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

      <div
        className={cn(
          "rounded-lg px-4 py-2.5",
          taskListBlock ? "max-w-[90%]" : "max-w-[75%]",
          message.role === "user"
            ? "bg-accent text-accent-foreground"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {assistantPayload?.type === "task_picker" ? (
          <TaskPickerPayloadView
            payload={assistantPayload}
            onConfirmDeleteSelection={onConfirmDeleteSelection}
            isSending={isSending}
          />
        ) : assistantPayload?.type === "note_picker" ? (
          <NotePickerPayloadView
            payload={assistantPayload}
            messageContent={message.content}
            onEdit={onNoteCardEdit}
            onDelete={onNoteCardDelete}
            onTogglePin={onNoteCardTogglePin}
          />
        ) : assistantPayload?.type === "delete_result" ||
          assistantPayload?.type === "undo_result" ? (
          <></>
        ) : assistantPayload?.type === "task_list_page" ? (
          <TaskListPagePayloadView
            payload={assistantPayload}
            onTaskClick={onTaskListItemClick}
            onTaskStatusToggle={onTaskListItemStatusToggle}
            onTaskFilterPage={onTaskFilterPage}
            isSending={isSending}
          />
        ) : assistantPayload?.type === "finance_entry_list" ||
          assistantPayload?.type === "finance_entry_picker" ? (
          <FinanceEntryPayloadView
            payload={assistantPayload}
            messageContent={message.content}
            onEdit={onFinanceEntryEdit}
            onDelete={onFinanceEntryDelete}
          />
        ) : assistantPayload?.type === "finance_summary" ? (
          <FinanceSummaryPayloadView
            payload={assistantPayload}
            messageContent={message.content}
          />
        ) : assistantPayload?.type === "finance_category_list" ? (
          <FinanceCategoryPayloadView
            payload={assistantPayload}
            messageContent={message.content}
          />
        ) : taskListBlock ? (
          <TaskListBlockView
            headerText={taskListBlock.headerText}
            footerText={taskListBlock.footerText}
            items={taskListBlock.items}
            tasks={tasks}
            onItemClick={onTaskListItemClick}
            onItemStatusToggle={onTaskListItemStatusToggle}
          />
        ) : parsedCreateTask && displayTask ? (
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
          <TextBubble content={message.content} />
        )}

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
