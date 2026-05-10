"use client";

/**
 * app/(dashboard)/ai/page.tsx â€” AI Chat page (orchestrator).
 *
 * Táº¥t cáº£ UI components Ä‘Æ°á»£c tÃ¡ch vÃ o components/javis/:
 *   - ChatSidebar        â€“ panel danh sÃ¡ch há»™i thoáº¡i
 *   - ChatMessageList    â€“ danh sÃ¡ch tin nháº¯n + typing indicator
 *   - ChatInputBar       â€“ Ã´ nháº­p, voice, suggested prompts
 *
 * Pure utils & hooks:
 *   - chat-utils.ts       â€“ parse/match helpers
 *   - use-resolved-tasks  â€“ cache messageId â†’ taskId
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
import { useTaskActions } from "@/hooks/use-task-actions";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";

import { TaskDetailDialog } from "@/components/task/task-detail-dialog";
import { TaskModal } from "@/components/task/task-modal";
import { DeleteDialog } from "@/components/task/delete-dialog";
import { NoteEditorDialog } from "@/components/notes/note-editor-dialog";


import { ChatMessageList } from "@/components/javis/chat-message-list";
import { ChatInputBar } from "@/components/javis/chat-input-bar";
import { useResolvedTasks } from "@/components/javis/use-resolved-tasks";
import { parseAssistantPayload } from "@/components/javis/chat-utils";
import type { ChatMessageRole, Note } from "@/lib/types";

const READ_REPLIES_STORAGE_KEY = "taskify.ai.read-replies-aloud";

export default function AILayoutPage() {
  // â”€â”€ Chat session store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const {
    sessions,
    activeSessionId,
    messages: persistedMessages,
    init,
    selectSession,
    createNewSession,
    deleteSession,
    sendMessage: sendPersistedMessage,
    isSending,
  } = useChatSessionStore();

  // â”€â”€ Local state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [isTyping] = useState(false);
  const [input, setInput] = useState("");
  const [readRepliesAloud, setReadRepliesAloud] = useState(true);
  const [hasLoadedVoicePreference, setHasLoadedVoicePreference] =
    useState(false);

  const lastSessionIdRef = useRef<string | null>(null);
  const toastedMessageIdsRef = useRef<Set<string>>(new Set());

  // â”€â”€ Note store & actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { notes, createNote, updateNote, deleteNote, togglePin } = useNoteStore();
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  
  const handleNoteSave = async (payload: { title: string; content?: string; isPinned?: boolean }) => {
    try {
      if (editingNote) {
        await updateNote(editingNote.id, payload);
      } else {
        await createNote(payload);
      }
      setNoteDialogOpen(false);
    } catch {
      toast.error("Failed to save note");
    }
  };

  // â”€â”€ Speech â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Task store & actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Resolved task cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { resolvedTaskIdMap, handleTaskCardClick, handleTaskCardStatusToggle } =
    useResolvedTasks(tasks, fetchTasks, openDetail, updateTaskStatus);

  // â”€â”€ Derive display messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const combinedMessages = useMemo(() => {
    if (!activeSessionId) return [];
    const list = persistedMessages[activeSessionId] ?? [];
    return list
      .map((m) => ({
        id: m.id,
        role: m.role as ChatMessageRole,
        content: m.text,
        metadataJson: m.metadataJson ?? null,
        timestamp: new Date(m.sentAt),
      }))
      .filter((message) => {
        if (message.role !== "assistant") return true;
        const payload = parseAssistantPayload(message.metadataJson ?? null);
        return !payload || (payload.type !== "delete_result" && payload.type !== "undo_result");
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [activeSessionId, persistedMessages]);

  // â”€â”€ Effects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    void init();
  }, [init]);

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
  }, [activeSessionId, stopListening, resetTranscript, cancelSpeech]);

  useEffect(() => {
    const sessionId = activeSessionId;
    if (!sessionId) return;
    const existingMessages = persistedMessages[sessionId] ?? [];
    toastedMessageIdsRef.current = new Set(existingMessages.map((message) => message.id));
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
        const secondsLeft = stillValid ? Math.max(1, Math.ceil((expiresAtMs - now) / 1000)) : 0;

        toast.success(`Da xoa ${payload.deletedCount} task`, {
          description: stillValid
            ? `Ban co the hoan tac trong ${secondsLeft} giay.`
            : "Da het thoi gian hoan tac.",
          action: stillValid
            ? {
                label: "Undo",
                onClick: () => handleUndoDelete(payload.undoToken),
              }
            : undefined,
        });
      } else if (payload.type === "undo_result") {
        toast.success(`Da khoi phuc ${payload.restoredCount} task`);
      }
    }
  }, [activeSessionId, persistedMessages]);

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSend = async (forcedMessage?: string, metadata?: unknown) => {
    const msg = (forcedMessage ?? input).trim();
    if (!msg) return;

    stopListening();
    resetTranscript();
    cancelSpeech();
    setInput("");

    try {
      const responseMessages = await sendPersistedMessage(msg, metadata);
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
    void handleSend("xÃ¡c nháº­n xÃ³a cÃ¡c task Ä‘Ã£ chá»n", {
      action: "confirm_delete_selection",
      taskIds,
    });
  };

  const handleUndoDelete = (undoToken: string) => {
    void handleSend("undo xÃ³a task", {
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

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="flex h-[calc(100vh-7rem)] gap-3">
      {/* â”€â”€ Sidebar â”€â”€ */}


      {/* â”€â”€ Chat pane â”€â”€ */}
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
              void handleSend("xÃ¡c nháº­n xÃ³a cÃ¡c note Ä‘Ã£ chá»n", {
                action: "confirm_delete_note",
                noteIds: [note.id]
              });
            }}
            onNoteCardTogglePin={async (note) => {
              try {
                await togglePin(note.id);
              } catch {
                toast.error("Failed to pin note");
              }
            }}
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
      </div>
    </div>
  );
}
