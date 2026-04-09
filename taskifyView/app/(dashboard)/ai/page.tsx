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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { useChatSessionStore } from "@/lib/chat-session-store";
import { useTaskStore } from "@/lib/task-store";
import { useTaskActions } from "@/hooks/use-task-actions";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";

import { TaskDetailDialog } from "@/components/task/task-detail-dialog";
import { TaskModal } from "@/components/task/task-modal";
import { DeleteDialog } from "@/components/task/delete-dialog";

import { ChatSidebar } from "@/components/javis/chat-sidebar";
import { ChatMessageList } from "@/components/javis/chat-message-list";
import { ChatInputBar } from "@/components/javis/chat-input-bar";
import { useResolvedTasks } from "@/components/javis/use-resolved-tasks";
import type { ChatMessageRole } from "@/lib/types";

const READ_REPLIES_STORAGE_KEY = "taskify.ai.read-replies-aloud";

export default function AILayoutPage() {
  // ── Chat session store ──────────────────────────────────────────────────
  const {
    sessions,
    activeSessionId,
    messages: persistedMessages,
    init,
    selectSession,
    createNewSession,
    sendMessage: sendPersistedMessage,
    isSending,
  } = useChatSessionStore();

  // ── Local state ─────────────────────────────────────────────────────────
  const [isTyping] = useState(false);
  const [input, setInput] = useState("");
  const [readRepliesAloud, setReadRepliesAloud] = useState(true);
  const [hasLoadedVoicePreference, setHasLoadedVoicePreference] =
    useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const lastSessionIdRef = useRef<string | null>(null);

  // ── Speech ───────────────────────────────────────────────────────────────
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

  // ── Task store & actions ─────────────────────────────────────────────────
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

  // ── Resolved task cache ──────────────────────────────────────────────────
  const { resolvedTaskIdMap, handleTaskCardClick, handleTaskCardStatusToggle } =
    useResolvedTasks(tasks, fetchTasks, openDetail, updateTaskStatus);

  // ── Derive display messages ──────────────────────────────────────────────
  const combinedMessages = useMemo(() => {
    if (!activeSessionId) return [];
    const list = persistedMessages[activeSessionId] ?? [];
    return list
      .map((m) => ({
        id: m.id,
        role: m.role as ChatMessageRole,
        content: m.text,
        timestamp: new Date(m.sentAt),
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [activeSessionId, persistedMessages]);

  // ── Effects ──────────────────────────────────────────────────────────────
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
    if (!readRepliesAloud) cancelSpeech();
  }, [readRepliesAloud, cancelSpeech]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const msg = input.trim();
    if (!msg) return;

    stopListening();
    resetTranscript();
    cancelSpeech();
    setInput("");

    try {
      const responseMessages = await sendPersistedMessage(msg);
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-7rem)] gap-3">
      {/* ── Sidebar ── */}
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isSending={isSending}
        collapsed={collapsed}
        onSelectSession={(id) => void selectSession(id)}
        onNewSession={() => void createNewSession()}
      />

      {/* ── Chat pane ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Collapse toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 self-start"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>

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
      </div>
    </div>
  );
}
