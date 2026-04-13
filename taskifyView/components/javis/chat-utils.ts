/**
 * chat-utils.ts — Pure utility functions & types for AI chat.
 * No React imports, no side-effects: safe to use anywhere.
 */

import type { Task, TaskPriority, TaskStatus, Note } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParsedCreateTaskBlock = {
  prefixText: string;
  suffixText: string;
  payload: {
    title: string;
    dueDate: string;
    priority: TaskPriority;
  };
};

// A single line item parsed from a Rasa task-list reply
export type ParsedTaskListItem = {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  isOverdue: boolean;
};

export type ParsedTaskListBlock = {
  /** Text before the first numbered task line (e.g. summary header) */
  headerText: string;
  items: ParsedTaskListItem[];
  /** Text after the last task line (e.g. "... và còn N task khác") */
  footerText: string;
};

export type TaskPickerPayload = {
  type: "task_picker";
  prompt: string;
  tasks: Array<{
    id: string;
    title: string;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate?: string | null;
    isOverdue?: boolean;
  }>;
};

export type NotePickerPayload = {
  type: "note_picker";
  notes: Note[];
};

export type DeleteResultPayload = {
  type: "delete_result";
  deletedCount: number;
  deletedTaskIds: string[];
  deletedTaskTitles: string[];
  undoToken: string;
  expiresAtUtc: string;
};

export type UndoResultPayload = {
  type: "undo_result";
  restoredCount: number;
  restoredTaskIds: string[];
};

export type AssistantPayload =
  | TaskPickerPayload
  | NotePickerPayload
  | DeleteResultPayload
  | UndoResultPayload;

// ---------------------------------------------------------------------------
// Task list parser (Rasa format_task_list output)
// ---------------------------------------------------------------------------

// Matches: "1. [ ] Tựa task học bài 123 ~ (Hạn: Apr 09)"
//          "2. [x] Done high task ! (Due: Apr 09) OVERDUE"
const TASK_LIST_LINE_RE =
  /^\d+\.\s+(\[[ x~]\])\s+(.+?)\s+([!~\-])\s+\((?:Hạn|Due):[^)]+\)(\s+(?:QUÁ HẠN|OVERDUE))?$/i;

function parseStatusMark(mark: string): TaskStatus {
  if (mark === "[x]") return "completed";
  if (mark === "[~]") return "in-progress";
  return "todo";
}

function parsePriorityMark(mark: string): TaskPriority {
  if (mark === "!") return "high";
  if (mark === "-") return "low";
  return "medium";
}

/**
 * Detect and parse a Rasa task-list reply (e.g. response to "task hôm nay").
 * Returns null if the message does not contain a numbered task list.
 */
export function parseTaskListBlock(
  content: string,
): ParsedTaskListBlock | null {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const headerLines: string[] = [];
  const items: ParsedTaskListItem[] = [];
  const footerLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(TASK_LIST_LINE_RE);

    if (match) {
      items.push({
        title: match[2].trim(),
        status: parseStatusMark(match[1]),
        priority: parsePriorityMark(match[3]),
        isOverdue: Boolean(match[4]),
      });
    } else if (items.length === 0) {
      headerLines.push(line);
    } else if (trimmed) {
      footerLines.push(trimmed);
    }
  }

  if (items.length === 0) return null;

  return {
    headerText: headerLines.join("\n").trim(),
    items,
    footerText: footerLines.join("\n").trim(),
  };
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function foldText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDueDateDisplay(value: string): string | null {
  const match = value
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const day = Number(match[3]);
  const month = Number(match[4]);
  const year = Number(match[5]);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(day) ||
    Number.isNaN(month) ||
    Number.isNaN(year)
  ) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const date = new Date(year, month - 1, day, hour, minute, 0);
  if (Number.isNaN(date.getTime())) return null;

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`;
}

function normalizeTitleValue(raw: string): string {
  return raw
    .trim()
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .replace(/^["""](.+)["""]$/, "$1")
    .trim();
}

function parsePriority(
  marker: string | undefined,
  rawValue: string,
): TaskPriority {
  const rawMarker = (marker ?? "").trim();
  if (rawMarker === "!") return "high";
  if (rawMarker === "-") return "low";
  if (rawMarker === "~") return "medium";

  const normalized = foldText(rawValue);
  if (normalized.includes("high") || normalized.includes("cao")) return "high";
  if (normalized.includes("low") || normalized.includes("thap")) return "low";
  return "medium";
}

// ---------------------------------------------------------------------------
// Message parsing
// ---------------------------------------------------------------------------

/**
 * Detect and extract a "task created" block from a bot reply.
 * Returns null if the message has no such block.
 */
export function parseCreateTaskBlock(
  content: string,
): ParsedCreateTaskBlock | null {
  const normalizedContent = content.replace(/\r\n/g, "\n");
  const lines = normalizedContent.split("\n");

  for (let i = 0; i <= lines.length - 3; i += 1) {
    const createdLine = lines[i].trim();
    const dueLine = lines[i + 1].trim();
    const priorityLine = lines[i + 2].trim();

    const createdMatch = createdLine.match(
      /^(?:Đã tạo task|Created task):\s*(.+)$/i,
    );
    const dueMatch = dueLine.match(/^(?:Hạn|Due):\s*(.+)$/i);
    const priorityMatch = priorityLine.match(
      /^(?:([!~\-])\s*)?(?:Độ ưu tiên|Priority):\s*(.+)$/i,
    );

    if (!createdMatch || !dueMatch || !priorityMatch) continue;

    const title = normalizeTitleValue(createdMatch[1] ?? "");
    if (!title) continue;

    const dueDate = parseDueDateDisplay(dueMatch[1] ?? "");
    if (!dueDate) continue;

    const priority = parsePriority(priorityMatch[1], priorityMatch[2] ?? "");
    const prefixText = lines.slice(0, i).join("\n").trim();
    const suffixText = lines.slice(i + 3).join("\n").trim();

    return { prefixText, suffixText, payload: { title, dueDate, priority } };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Task matching
// ---------------------------------------------------------------------------

function isDueMatch(taskDueDate: string, payloadDueDate: string): boolean {
  const taskTs = new Date(taskDueDate).getTime();
  const payloadTs = new Date(payloadDueDate).getTime();
  if (Number.isNaN(taskTs) || Number.isNaN(payloadTs)) return false;
  return Math.abs(taskTs - payloadTs) <= 60_000;
}

export function findTaskMatches(
  tasks: Task[],
  payload: ParsedCreateTaskBlock["payload"],
): Task[] {
  const normalizedTitle = foldText(payload.title);
  return tasks.filter(
    (task) =>
      foldText(task.title) === normalizedTitle &&
      task.priority === payload.priority &&
      isDueMatch(task.dueDate, payload.dueDate),
  );
}

export function buildPreviewTask(
  messageId: string,
  timestamp: Date,
  payload: ParsedCreateTaskBlock["payload"],
): Task {
  return {
    id: `ai-preview-${messageId}`,
    title: payload.title,
    description: "",
    priority: payload.priority,
    status: "todo",
    dueDate: payload.dueDate,
    createdAt: timestamp.toISOString(),
    labels: [],
  };
}

export function parseAssistantPayload(
  metadataJson?: string | null,
): AssistantPayload | null {
  if (!metadataJson) return null;

  try {
    const parsed = JSON.parse(metadataJson) as { type?: unknown };
    if (!parsed || typeof parsed.type !== "string") return null;

    if (parsed.type === "task_picker") {
      return parsed as TaskPickerPayload;
    }
    if (parsed.type === "note_picker") {
      return parsed as NotePickerPayload;
    }
    if (parsed.type === "delete_result") {
      return parsed as DeleteResultPayload;
    }
    if (parsed.type === "undo_result") {
      return parsed as UndoResultPayload;
    }

    return null;
  } catch {
    return null;
  }
}
