"use client";

import type { Task, TaskPriority, TaskStatus } from "./types";
import { getDueDatePart } from "./utils";

export type ParsedIntent =
  | { kind: "create"; title: string; priority?: TaskPriority; status?: TaskStatus; dueDate?: string; description?: string }
  | { kind: "list"; query?: string }
  | { kind: "delete"; query?: string }
  | { kind: "update"; query: string; status?: TaskStatus; priority?: TaskPriority; dueDate?: string; title?: string; description?: string }
  | { kind: "unknown" };

export type LocalMessage =
  | { type: "text"; content: string }
  | { type: "task-list"; title: string; action: "delete" | "update"; tasks: Task[] }
  | { type: "confirm"; action: "delete"; taskIds: string[]; prompt: string }
  | { type: "result"; status: "success" | "error"; content: string; tasks?: Task[] };

const STATUS_KEYWORDS: Record<string, TaskStatus> = {
  "in-progress": "in-progress",
  "in progress": "in-progress",
  doing: "in-progress",
  tiến: "in-progress",
  working: "in-progress",
  done: "completed",
  complete: "completed",
  completed: "completed",
  xong: "completed",
  finish: "completed",
  todo: "todo",
  "to do": "todo",
};

const PRIORITY_KEYWORDS: Record<string, TaskPriority> = {
  high: "high",
  cao: "high",
  urgent: "high",
  medium: "medium",
  mid: "medium",
  "trung binh": "medium",
  low: "low",
  thấp: "low",
};

const CREATE_KEYWORDS = ["create", "add", "new task", "tạo", "thêm"];
const LIST_KEYWORDS = ["list", "show", "what tasks", "danh sách", "hiển thị", "xem task", "list tasks"];
const DELETE_KEYWORDS = ["delete", "remove", "xoá", "xóa", "remove task"];
const UPDATE_KEYWORDS = ["update", "change", "set", "đổi", "cập nhật"];

export function parseIntent(inputRaw: string): ParsedIntent {
  const input = inputRaw.trim();
  const lower = input.toLowerCase();

  // Quick yes/no handled outside

  // Detect create
  if (CREATE_KEYWORDS.some((k) => lower.includes(k))) {
    const title = extractQuoted(input) || fallbackTitle(input);
    return title
      ? { kind: "create", title, priority: extractPriority(lower), status: extractStatus(lower), dueDate: extractDate(lower), description: extractDescription(input) }
      : { kind: "unknown" };
  }

  // Detect delete
  if (DELETE_KEYWORDS.some((k) => lower.includes(k))) {
    return { kind: "delete", query: extractQuery(input) };
  }

  // Detect list
  if (LIST_KEYWORDS.some((k) => lower.includes(k))) {
    return { kind: "list", query: extractQuery(input) };
  }

  // Detect update
  if (UPDATE_KEYWORDS.some((k) => lower.includes(k))) {
    return {
      kind: "update",
      query: extractQuery(input) || extractQuoted(input) || "",
      status: extractStatus(lower),
      priority: extractPriority(lower),
      dueDate: extractDate(lower),
      title: extractNewTitle(input),
      description: extractDescription(input),
    };
  }

  return { kind: "unknown" };
}

export function isAffirmative(text: string) {
  const v = text.trim().toLowerCase();
  return ["yes", "y", "ok", "đồng ý", "dong y", "xac nhan", "xác nhận"].includes(v);
}

export function isNegative(text: string) {
  const v = text.trim().toLowerCase();
  return ["no", "n", "không", "ko", "cancel", "hủy", "huỷ"].includes(v);
}

// --- helpers ---

function extractQuoted(input: string): string | null {
  const m = input.match(/["“”](.+?)["“”]/);
  return m ? m[1].trim() : null;
}

function fallbackTitle(input: string): string | null {
  // Take words after 'task' or 'to'
  const m = input.match(/task\s+(.*)/i) || input.match(/tạo\s+(.*)/i) || input.match(/thêm\s+(.*)/i);
  if (m && m[1]) {
    const text = m[1].trim();
    if (text.length > 2) return text;
  }
  return null;
}

function extractPriority(lower: string): TaskPriority | undefined {
  for (const [k, v] of Object.entries(PRIORITY_KEYWORDS)) {
    if (lower.includes(k)) return v;
  }
  return undefined;
}

function extractStatus(lower: string): TaskStatus | undefined {
  for (const [k, v] of Object.entries(STATUS_KEYWORDS)) {
    if (lower.includes(k)) return v;
  }
  return undefined;
}

function extractDate(lower: string): string | undefined {
  if (lower.includes("today") || lower.includes("hôm nay")) {
    return new Date().toISOString().split("T")[0] + "T23:59:59";
  }
  if (lower.includes("tomorrow") || lower.includes("mai")) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0] + "T23:59:59";
  }
  return undefined;
}

function extractDescription(input: string): string | undefined {
  const m = input.match(/desc(ription)?:\s*(.+)/i);
  if (m && m[2]) return m[2].trim();
  return undefined;
}

function extractNewTitle(input: string): string | undefined {
  const m = input.match(/title:\s*(.+)/i);
  if (m && m[1]) return m[1].trim();
  return undefined;
}

function extractQuery(input: string): string | undefined {
  const quoted = extractQuoted(input);
  if (quoted) return quoted;
  const m = input.match(/task\s+(.+)/i);
  if (m && m[1]) return m[1].trim();
  return undefined;
}

export function matchTasks(tasks: Task[], query?: string): Task[] {
  if (!query) return tasks;
  const q = query.toLowerCase();
  return tasks.filter((t) => t.title.toLowerCase().includes(q));
}

export function summarizeTasks(tasks: Task[]): string {
  return tasks.map((t) => `• ${t.title} (${t.status}, ${t.priority})`).join("\n");
}

export function buildDefaultTask(title: string): Omit<Task, "id" | "createdAt"> {
  const today = getDueDatePart(new Date().toISOString());
  return {
    title,
    description: "",
    priority: "medium",
    status: "todo",
    dueDate: `${today}T23:59:59`,
    labels: [],
  };
}
