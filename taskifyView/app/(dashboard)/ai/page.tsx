"use client";

/**
 * app/(dashboard)/ai/page.tsx — AI Chat page (orchestrator).
 *
 * Tất cả UI components được tách vào components/javis/:
 *   - ChatSidebar        – panel danh sách hội thoại
 *   - ChatMessageList    – danh sách tin nhắn + typing indicator
 *   - ChatInputBar       – ô nhập, voice, suggested prompts
 *
 * Pure utils & hooks:
 *   - chat-utils.ts       – parse/match helpers
 *   - use-resolved-tasks  – cache messageId → taskId
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { useChatSessionStore } from "@/lib/chat-session-store";
import { useTaskStore } from "@/lib/task-store";
import { useNoteStore } from "@/lib/note-store";
import { useFinanceStore } from "@/lib/finance-store";
import { useFinanceCategoryStore } from "@/lib/finance-category-store";
import { useTaskActions } from "@/hooks/use-task-actions";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";

import { TaskDetailDialog } from "@/components/task/task-detail-dialog";
import { TaskModal } from "@/components/task/task-modal";
import { DeleteDialog } from "@/components/task/delete-dialog";
import { NoteEditorDialog } from "@/components/notes/note-editor-dialog";
import { FinanceEntryDialog } from "@/components/finance/finance-entry-dialog";

import { ChatMessageList } from "@/components/javis/chat-message-list";
import { ChatInputBar } from "@/components/javis/chat-input-bar";
import { ChatThinkingPanel } from "@/components/javis/chat-thinking-panel";
import type { DisplayMessage } from "@/components/javis/chat-message-item";
import { useResolvedTasks } from "@/components/javis/use-resolved-tasks";
import {
  buildThinkingTraceViewModel,
  parseAssistantPayload,
  parseUserTraceMetadata,
} from "@/components/javis/chat-utils";
import type { ChatMessageRole, Note, FinanceEntry } from "@/lib/types";

const READ_REPLIES_STORAGE_KEY = "taskify.ai.read-replies-aloud";

export default function AILayoutPage() {
  // ── Chat session store ──────────────────────────────────────────────────────────────────────
  const {
    sessions,
    activeSessionId,
    messages: persistedMessages,
    streamStageBySession,
    init,
    selectSession,
    createNewSession,
    deleteSession,
    sendMessageStream,
    isSending,
  } = useChatSessionStore();

  // ── Local state ───────────────────────────────────────────────────────────────────────────────
  const [isTyping] = useState(false);
  const [input, setInput] = useState("");
  const [readRepliesAloud, setReadRepliesAloud] = useState(true);
  const [selectedThinkingMessageId, setSelectedThinkingMessageId] = useState<
    string | null
  >(null);
  const [hasLoadedVoicePreference, setHasLoadedVoicePreference] =
    useState(false);

  const lastSessionIdRef = useRef<string | null>(null);
  const toastedMessageIdsRef = useRef<Set<string>>(new Set());

  // ── Note store & actions ────────────────────────────────────────────────────────────────────
  const { notes, createNote, updateNote, deleteNote, togglePin } =
    useNoteStore();
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const {
    refresh: refreshFinance,
    createEntry: createFinanceEntry,
    updateEntry: updateFinanceEntry,
  } = useFinanceStore();
  const { categories, fetchCategories } = useFinanceCategoryStore();
  const [financeDialogOpen, setFinanceDialogOpen] = useState(false);
  const [editingFinanceEntry, setEditingFinanceEntry] =
    useState<FinanceEntry | null>(null);

  const handleNoteSave = async (payload: {
    title: string;
    content?: string;
    isPinned?: boolean;
  }) => {
    try {
      if (editingNote) {
        await updateNote(editingNote.id, payload);
      } else {
        await createNote(payload);
      }
      setNoteDialogOpen(false);
    } catch {
      toast.error("Lưu ghi chú thất bại");
    }
  };

  const handleFinanceEntrySave = async (payload: {
    date: string;
    category: string;
    description?: string;
    amount: number;
  }) => {
    try {
      if (editingFinanceEntry) {
        await updateFinanceEntry(editingFinanceEntry.id, payload);
      } else {
        await createFinanceEntry(payload);
      }
      setFinanceDialogOpen(false);
      setEditingFinanceEntry(null);
    } catch {
      toast.error("Lưu mục tài chính thất bại");
    }
  };

  // ── Speech ────────────────────────────────────────────────────────────────────────────────────
  const {
    isSupported: isSpeechRecognitionSupported,
    isListening,
    interimTranscript,
    error: voiceError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({ lang: "vi-VN", onDraftChange: setInput });

  const {
    isSupported: isSpeechSynthesisSupported,
    isSpeaking,
    speakTexts,
    cancel: cancelSpeech,
  } = useSpeechSynthesis({ lang: "vi-VN" });

  // ── Task store & actions ────────────────────────────────────────────────────────────────────
  const { tasks, fetchTasks, updateTaskStatus } = useTaskStore();
  const {
    modalOpen,
    setModalOpen,
    modalMode,
    selectedTask,
    detailDialogOpen,
    setDetailDialogOpen,
    detailTask,
    deleteDialogOpen,
    setDeleteDialogOpen,
    taskToDelete,
    openDetail,
    handleEditFromDetail,
    handleDeleteFromDetail,
    handleConfirmDelete,
    handleSaveTask,
  } = useTaskActions();

  // ── Resolved task cache ─────────────────────────────────────────────────────────────────────
  const { resolvedTaskIdMap, handleTaskCardClick, handleTaskCardStatusToggle } =
    useResolvedTasks(tasks, fetchTasks, openDetail, updateTaskStatus);

  // ── Derive display messages ─────────────────────────────────────────────────────────────────
  const combinedMessages = useMemo(() => {
    if (!activeSessionId) return [];
    const list = persistedMessages[activeSessionId] ?? [];
    const visibleMessages: DisplayMessage[] = list
      .map((m) => ({
        id: m.id,
        role: m.role as ChatMessageRole,
        content: m.text,
        metadataJson: m.metadataJson ?? null,
        timestamp: new Date(m.sentAt),
        isStreaming: m.isStreaming ?? false,
        isComplete: m.isComplete ?? true,
        thinkingTrace: null,
      }))
      .filter((message) => {
        if (message.role !== "assistant") return true;
        const payload = parseAssistantPayload(message.metadataJson ?? null);
        return (
          !payload ||
          (payload.type !== "delete_result" && payload.type !== "undo_result")
        );
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let latestUserTimestamp: Date | null = null;
    let latestUserSource:
      | {
          content: string;
          metadataJson?: string | null;
        }
      | null = null;
    let hasShownThinkingLabelForTurn = false;

    return visibleMessages.map((message) => {
      if (message.role === "user") {
        latestUserTimestamp = message.timestamp;
        latestUserSource = {
          content: message.content,
          metadataJson: message.metadataJson ?? null,
        };
        hasShownThinkingLabelForTurn = false;
        return message;
      }

      if (!latestUserTimestamp || hasShownThinkingLabelForTurn) {
        return message;
      }

      if (message.isComplete === false) {
        return message;
      }

      const elapsedMs = Math.max(
        0,
        message.timestamp.getTime() - latestUserTimestamp.getTime(),
      );
      const thinkingDurationSeconds = Math.max(1, Math.round(elapsedMs / 1000));

      hasShownThinkingLabelForTurn = true;

      return {
        ...message,
        showThinkingLabel: true,
        thinkingDurationSeconds,
        thinkingTrace: latestUserSource
          ? buildThinkingTraceViewModel({
              userMessage: latestUserSource.content,
              userMetadata: parseUserTraceMetadata(
                latestUserSource.metadataJson ?? null,
              ),
              assistantContent: message.content,
              assistantMetadataJson: message.metadataJson ?? null,
              thinkingDurationSeconds,
            })
          : null,
      };
    });
  }, [activeSessionId, persistedMessages]);

  const selectedThinkingTrace = useMemo(
    () =>
      combinedMessages.find((message) => message.id === selectedThinkingMessageId)
        ?.thinkingTrace ?? null,
    [combinedMessages, selectedThinkingMessageId],
  );

  const activeStreamStage = useMemo(
    () => (activeSessionId ? streamStageBySession[activeSessionId] ?? null : null),
    [activeSessionId, streamStageBySession],
  );

  // ── Effects ───────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    fetchCategories().catch(() => {});
    refreshFinance().catch(() => {});
  }, [fetchCategories, refreshFinance]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(READ_REPLIES_STORAGE_KEY);
    if (stored !== null) setReadRepliesAloud(stored === "true");
    setHasLoadedVoicePreference(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedVoicePreference || typeof window === "undefined") return;
    window.localStorage.setItem(
      READ_REPLIES_STORAGE_KEY,
      String(readRepliesAloud),
    );
  }, [hasLoadedVoicePreference, readRepliesAloud]);

  useEffect(() => {
    if (lastSessionIdRef.current === activeSessionId) return;
    lastSessionIdRef.current = activeSessionId;
    stopListening();
    resetTranscript();
    cancelSpeech();
    setInput("");
    setSelectedThinkingMessageId(null);
  }, [activeSessionId, stopListening, resetTranscript, cancelSpeech]);

  useEffect(() => {
    const sessionId = activeSessionId;
    if (!sessionId) return;
    const existingMessages = persistedMessages[sessionId] ?? [];
    toastedMessageIdsRef.current = new Set(
      existingMessages.map((message) => message.id),
    );
  }, [activeSessionId]);

  useEffect(() => {
    if (!readRepliesAloud) cancelSpeech();
  }, [readRepliesAloud, cancelSpeech]);

  useEffect(() => {
    const sessionId = activeSessionId;
    if (!sessionId) return;

    const list = persistedMessages[sessionId] ?? [];
    for (const message of list) {
      if (toastedMessageIdsRef.current.has(message.id)) {
        continue;
      }
      toastedMessageIdsRef.current.add(message.id);
      if (message.role !== "assistant") {
        continue;
      }

      const payload = parseAssistantPayload(message.metadataJson ?? null);
      if (!payload) continue;

      if (payload.type === "delete_result") {
        const expiresAtMs = new Date(payload.expiresAtUtc).getTime();
        const now = Date.now();
        const stillValid = Number.isFinite(expiresAtMs) && expiresAtMs > now;
        const secondsLeft = stillValid
          ? Math.max(1, Math.ceil((expiresAtMs - now) / 1000))
          : 0;

        toast.success(`Đã xóa ${payload.deletedCount} task`, {
          description: stillValid
            ? `Bạn có thể hoàn tác trong ${secondsLeft} giây.`
            : "Đã hết thời gian hoàn tác.",
          action: stillValid
            ? {
                label: "Hoàn tác",
                onClick: () => handleUndoDelete(payload.undoToken),
              }
            : undefined,
        });
      } else if (payload.type === "undo_result") {
        toast.success(`Đã khôi phục ${payload.restoredCount} task`);
      }
    }
  }, [activeSessionId, persistedMessages]);

  // ── Handlers ──────────────────────────────────────────────────────────────────────────────────
  const handleSend = async (forcedMessage?: string, metadata?: unknown) => {
    const msg = (forcedMessage ?? input).trim();
    if (!msg) return;

    stopListening();
    resetTranscript();
    cancelSpeech();
    setInput("");

    try {
      const responseMessages = await sendMessageStream(msg, metadata);
      refreshFinance().catch(() => {});
      fetchCategories().catch(() => {});
      if (readRepliesAloud && isSpeechSynthesisSupported) {
        const replies = responseMessages
          .filter((m) => m.role === "assistant")
          .map((m) => m.text);
        if (replies.length > 0) speakTexts(replies);
      }
    } catch {
      // errors surfaced via toast inside the store
    }
  };

  const handleDeleteSelectionConfirm = (taskIds: string[]) => {
    void handleSend("xác nhận xóa các task đã chọn", {
      action: "confirm_delete_selection",
      taskIds,
    });
  };

  const handleUndoDelete = (undoToken: string) => {
    void handleSend("hoàn tác xóa task", {
      action: "undo_delete",
      undoToken,
    });
  };
  const handleTaskFilterPage = (direction: "next" | "prev") => {
    void handleSend("lọc task", {
      action: "task_filter_page",
      direction,
    });
  };
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleInputChange = (value: string) => {
    if (isListening) {
      stopListening();
      resetTranscript();
    }
    setInput(value);
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
      return;
    }
    cancelSpeech();
    startListening(input);
  };

  const handleThinkingLabelToggle = (messageId: string) => {
    setSelectedThinkingMessageId((current) =>
      current === messageId ? null : messageId,
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-7rem)] gap-3">
      {/* ── Sidebar ── */}

      {/* ── Chat pane ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <Card
          className={cn(
            "flex-1 flex flex-col overflow-hidden bg-card border-border",
          )}
        >
          {/* Message list */}
          <ChatMessageList
            messages={combinedMessages}
            tasks={tasks}
            isSending={isSending}
            streamStage={activeStreamStage}
            resolvedTaskIdMap={resolvedTaskIdMap}
            onTaskCardClick={handleTaskCardClick}
            onTaskCardStatusToggle={handleTaskCardStatusToggle}
            onTaskListItemClick={openDetail}
            onTaskListItemStatusToggle={async (task) => {
              const next = task.status === "completed" ? "todo" : "completed";
              await updateTaskStatus(task.id, next);
            }}
            onConfirmDeleteSelection={handleDeleteSelectionConfirm}
            onTaskFilterPage={handleTaskFilterPage}
            onNoteCardEdit={(note) => {
              setEditingNote(note);
              setNoteDialogOpen(true);
            }}
            onNoteCardDelete={(note) => {
              void handleSend("xác nhận xóa các note đã chọn", {
                action: "confirm_delete_note",
                noteIds: [note.id],
              });
            }}
            onNoteCardTogglePin={async (note) => {
              try {
                await togglePin(note.id);
              } catch {
                toast.error("Ghim ghi chú thất bại");
              }
            }}
            onFinanceEntryEdit={(entry) => {
              setEditingFinanceEntry(entry);
              setFinanceDialogOpen(true);
            }}
            onFinanceEntryDelete={(entry) => {
              void handleSend("xóa chi tiêu", {
                action: "confirm_delete_finance_entry",
                entryIds: [entry.id],
              });
            }}
            activeThinkingMessageId={selectedThinkingMessageId}
            onThinkingLabelToggle={handleThinkingLabelToggle}
          />

          {/* Input area */}
          <ChatInputBar
            input={input}
            onInputChange={handleInputChange}
            onSend={() => void handleSend()}
            onKeyPress={handleKeyPress}
            isSending={isSending}
            isTyping={isTyping}
            isSpeechRecognitionSupported={isSpeechRecognitionSupported}
            isSpeechSynthesisSupported={isSpeechSynthesisSupported}
            isListening={isListening}
            isSpeaking={isSpeaking}
            interimTranscript={interimTranscript}
            voiceError={voiceError}
            readRepliesAloud={readRepliesAloud}
            onReadRepliesAloudChange={setReadRepliesAloud}
            onVoiceToggle={handleVoiceToggle}
            showSuggestedPrompts={combinedMessages.length <= 1}
            onSuggestedPrompt={setInput}
          />
        </Card>

        {/* Dialogs */}
        <TaskDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          task={detailTask}
          onEdit={handleEditFromDetail}
          onDelete={handleDeleteFromDetail}
        />
        <TaskModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          task={selectedTask}
          onSave={handleSaveTask}
          mode={modalMode}
        />
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleConfirmDelete}
          taskTitle={taskToDelete?.title || ""}
        />
        <NoteEditorDialog
          open={noteDialogOpen}
          onOpenChange={setNoteDialogOpen}
          onSave={handleNoteSave}
          note={editingNote ?? undefined}
        />
        <FinanceEntryDialog
          open={financeDialogOpen}
          onOpenChange={(open) => {
            setFinanceDialogOpen(open);
            if (!open) setEditingFinanceEntry(null);
          }}
          entry={editingFinanceEntry}
          categories={categories}
          onSave={handleFinanceEntrySave}
        />
      </div>
      <ChatThinkingPanel
        trace={selectedThinkingTrace}
        open={Boolean(selectedThinkingTrace)}
        onOpenChange={(open) => {
          if (!open) setSelectedThinkingMessageId(null);
        }}
      />
    </div>
  );
}
