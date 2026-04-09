"use client";

/**
 * use-resolved-tasks.ts — Hook quản lý việc resolve task từ AI message.
 *
 * Lưu cache messageId → taskId để việc update task (thay đổi dueDate / priority)
 * không làm mất liên kết giữa tin nhắn và task thực sự trong store.
 */

import { useRef, useCallback } from "react";
import type { Task, TaskStatus } from "@/lib/types";
import { useTaskStore } from "@/lib/task-store";
import { findTaskMatches, type ParsedCreateTaskBlock } from "./chat-utils";

export function useResolvedTasks(
  tasks: Task[],
  fetchTasks: () => Promise<void>,
  openDetail: (task: Task) => void,
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>,
) {
  /** Lưu cache: messageId → real taskId đã resolve được lần đầu */
  const resolvedTaskIdMap = useRef<Map<string, string>>(new Map());

  const resolveTaskFromPayload = useCallback(
    async (
      messageId: string,
      payload: ParsedCreateTaskBlock["payload"],
    ): Promise<Task | null> => {
      // 1. Cache hit → tìm thẳng theo id (không bị ảnh hưởng sau khi update)
      const cachedId = resolvedTaskIdMap.current.get(messageId);
      if (cachedId) {
        const fromCache = useTaskStore
          .getState()
          .tasks.find((t) => t.id === cachedId);
        if (fromCache) return fromCache;
        // id đã bị xóa → fall-through để re-resolve
      }

      // 2. Thử match trong store hiện tại
      const directMatches = findTaskMatches(tasks, payload);
      if (directMatches.length === 1) {
        resolvedTaskIdMap.current.set(messageId, directMatches[0].id);
        return directMatches[0];
      }

      // 3. Refresh từ API rồi thử lại
      await fetchTasks();
      const refreshedTasks = useTaskStore.getState().tasks;
      const refreshedMatches = findTaskMatches(refreshedTasks, payload);
      if (refreshedMatches.length === 1) {
        resolvedTaskIdMap.current.set(messageId, refreshedMatches[0].id);
        return refreshedMatches[0];
      }

      return null;
    },
    [tasks, fetchTasks],
  );

  const handleTaskCardClick = useCallback(
    async (
      messageId: string,
      payload: ParsedCreateTaskBlock["payload"],
    ) => {
      const matchedTask = await resolveTaskFromPayload(messageId, payload);
      if (!matchedTask) return;
      openDetail(matchedTask);
    },
    [resolveTaskFromPayload, openDetail],
  );

  const handleTaskCardStatusToggle = useCallback(
    async (
      messageId: string,
      payload: ParsedCreateTaskBlock["payload"],
    ) => {
      const matchedTask = await resolveTaskFromPayload(messageId, payload);
      if (!matchedTask) return;
      const nextStatus: TaskStatus =
        matchedTask.status === "completed" ? "todo" : "completed";
      await updateTaskStatus(matchedTask.id, nextStatus);
    },
    [resolveTaskFromPayload, updateTaskStatus],
  );

  return { resolvedTaskIdMap, handleTaskCardClick, handleTaskCardStatusToggle };
}
