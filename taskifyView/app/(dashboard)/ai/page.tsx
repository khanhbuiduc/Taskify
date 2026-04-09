"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Send,
  Bot,
  User,
  Plus,
  Loader2,
  MessagesSquare,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Mic,
  Square,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useChatSessionStore } from "@/lib/chat-session-store";
import type { ChatMessageRole, Task, TaskPriority } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { TaskCard } from "@/components/task/task-card";
import { useTaskActions } from "@/hooks/use-task-actions";
import { useTaskStore } from "@/lib/task-store";
import { TaskDetailDialog } from "@/components/task/task-detail-dialog";
import { TaskModal } from "@/components/task/task-modal";
import { DeleteDialog } from "@/components/task/delete-dialog";

const suggestedPrompts = [
  "What tasks are overdue?",
  "Summarize my week",
  "Help me prioritize tasks",
  "Create a new task for tomorrow",
];

const renderTextMessage = (content: string) => (
  <p className="text-sm leading-relaxed whitespace-pre-line">{content}</p>
);

const READ_REPLIES_STORAGE_KEY = "taskify.ai.read-replies-aloud";

type ParsedCreateTaskBlock = {
  prefixText: string;
  suffixText: string;
  payload: {
    title: string;
    dueDate: string;
    priority: TaskPriority;
  };
};

function foldText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDueDateDisplay(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
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

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const date = new Date(year, month - 1, day, hour, minute, 0);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

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
    .replace(/^["“”](.+)["“”]$/, "$1")
    .trim();
}

function parsePriority(marker: string | undefined, rawValue: string): TaskPriority {
  const rawMarker = (marker ?? "").trim();
  if (rawMarker === "!") return "high";
  if (rawMarker === "-") return "low";
  if (rawMarker === "~") return "medium";

  const normalized = foldText(rawValue);
  if (normalized.includes("high") || normalized.includes("cao")) return "high";
  if (normalized.includes("low") || normalized.includes("thap")) return "low";
  return "medium";
}

function parseCreateTaskBlock(content: string): ParsedCreateTaskBlock | null {
  const normalizedContent = content.replace(/\r\n/g, "\n");
  const lines = normalizedContent.split("\n");

  for (let i = 0; i <= lines.length - 3; i += 1) {
    const createdLine = lines[i].trim();
    const dueLine = lines[i + 1].trim();
    const priorityLine = lines[i + 2].trim();

    const createdMatch = createdLine.match(/^(?:Đã tạo task|Created task):\s*(.+)$/i);
    const dueMatch = dueLine.match(/^(?:Hạn|Due):\s*(.+)$/i);
    const priorityMatch = priorityLine.match(
      /^(?:([!~\-])\s*)?(?:Độ ưu tiên|Priority):\s*(.+)$/i,
    );

    if (!createdMatch || !dueMatch || !priorityMatch) {
      continue;
    }

    const title = normalizeTitleValue(createdMatch[1] ?? "");
    if (!title) {
      continue;
    }

    const dueDate = parseDueDateDisplay(dueMatch[1] ?? "");
    if (!dueDate) {
      continue;
    }

    const priority = parsePriority(priorityMatch[1], priorityMatch[2] ?? "");
    const prefixText = lines
      .slice(0, i)
      .join("\n")
      .trim();
    const suffixText = lines
      .slice(i + 3)
      .join("\n")
      .trim();

    return {
      prefixText,
      suffixText,
      payload: {
        title,
        dueDate,
        priority,
      },
    };
  }

  return null;
}

function isDueMatch(taskDueDate: string, payloadDueDate: string): boolean {
  const taskTimestamp = new Date(taskDueDate).getTime();
  const payloadTimestamp = new Date(payloadDueDate).getTime();
  if (Number.isNaN(taskTimestamp) || Number.isNaN(payloadTimestamp)) {
    return false;
  }

  return Math.abs(taskTimestamp - payloadTimestamp) <= 60_000;
}

function findTaskMatches(tasks: Task[], payload: ParsedCreateTaskBlock["payload"]): Task[] {
  const normalizedTitle = foldText(payload.title);
  return tasks.filter((task) => {
    if (foldText(task.title) !== normalizedTitle) {
      return false;
    }

    if (task.priority !== payload.priority) {
      return false;
    }

    return isDueMatch(task.dueDate, payload.dueDate);
  });
}

function buildPreviewTask(
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

export default function AILayoutPage() {
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
  const [isTyping] = useState(false);
  const [input, setInput] = useState("");
  const [readRepliesAloud, setReadRepliesAloud] = useState(true);
  const [hasLoadedVoicePreference, setHasLoadedVoicePreference] = useState(false);
  const lastSessionIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const speechRecognition = useSpeechRecognition({
    lang: "vi-VN",
    onDraftChange: setInput,
  });
  const speechSynthesis = useSpeechSynthesis({ lang: "vi-VN" });
  const {
    isSupported: isSpeechRecognitionSupported,
    isListening,
    interimTranscript,
    error: voiceError,
    startListening,
    stopListening,
    resetTranscript,
  } = speechRecognition;
  const {
    isSupported: isSpeechSynthesisSupported,
    isSpeaking,
    speakTexts,
    cancel: cancelSpeech,
  } = speechSynthesis;
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [combinedMessages]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedPreference = window.localStorage.getItem(READ_REPLIES_STORAGE_KEY);
    if (storedPreference !== null) {
      setReadRepliesAloud(storedPreference === "true");
    }
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
    if (lastSessionIdRef.current === activeSessionId) {
      return;
    }

    lastSessionIdRef.current = activeSessionId;
    stopListening();
    resetTranscript();
    cancelSpeech();
    setInput("");
  }, [activeSessionId]);

  useEffect(() => {
    if (!readRepliesAloud) {
      cancelSpeech();
    }
  }, [readRepliesAloud, cancelSpeech]);

  const handleSend = async () => {
    const messageToSend = input.trim();
    if (!messageToSend) return;

    stopListening();
    resetTranscript();
    cancelSpeech();
    setInput("");

    try {
      const responseMessages = await sendPersistedMessage(messageToSend);
      if (readRepliesAloud && isSpeechSynthesisSupported) {
        const assistantReplies = responseMessages
          .filter((message) => message.role === "assistant")
          .map((message) => message.text);

        if (assistantReplies.length > 0) {
          speakTexts(assistantReplies);
        }
      }
    } catch {
      // Error surface is handled via toast inside store; optionally add local message
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const handleVoiceInputToggle = () => {
    if (isListening) {
      stopListening();
      return;
    }

    cancelSpeech();
    startListening(input);
  };

  const resolveTaskFromPayload = async (
    payload: ParsedCreateTaskBlock["payload"],
  ): Promise<Task | null> => {
    const directMatches = findTaskMatches(tasks, payload);
    if (directMatches.length === 1) {
      return directMatches[0];
    }

    await fetchTasks();
    const refreshedTasks = useTaskStore.getState().tasks;
    const refreshedMatches = findTaskMatches(refreshedTasks, payload);
    if (refreshedMatches.length === 1) {
      return refreshedMatches[0];
    }

    return null;
  };

  const handleTaskCardClick = async (payload: ParsedCreateTaskBlock["payload"]) => {
    const matchedTask = await resolveTaskFromPayload(payload);
    if (!matchedTask) return;
    openDetail(matchedTask);
  };

  const handleTaskCardStatusToggle = async (
    payload: ParsedCreateTaskBlock["payload"],
  ) => {
    const matchedTask = await resolveTaskFromPayload(payload);
    if (!matchedTask) return;

    const nextStatus = matchedTask.status === "completed" ? "todo" : "completed";
    await updateTaskStatus(matchedTask.id, nextStatus);
  };

  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-3">
      {/* Inner chat sidebar */}
      <div
        className={cn(
          "flex flex-col border border-border/70 rounded-lg bg-card transition-[width] duration-300 ease-in-out overflow-hidden",
          collapsed ? "w-0 opacity-0" : "w-64 opacity-100",
          "min-h-0",
        )}
      >
        <div
          className={cn(
            "flex flex-col h-full",
            "transition-opacity duration-200 ease-in-out",
            collapsed ? "opacity-0 pointer-events-none" : "opacity-100",
          )}
          aria-hidden={collapsed}
        >
          <div className="flex items-center justify-between px-3 py-3 border-b border-border/70">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessagesSquare className="h-4 w-4" />
              <span className="truncate">Conversations</span>
            </div>
          </div>

          <div className="p-3 border-b border-border/70">
            <Button
              size="sm"
              className="w-full max-w-full justify-start gap-2 overflow-hidden"
              onClick={createNewSession}
              disabled={isSending}
            >
              <Plus className="h-4 w-4" />
              <span className="truncate">New chat adasdasdasd</span>
            </Button>
          </div>

          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {sessions.length === 0 && (
                  <div className="text-xs text-muted-foreground px-2 py-3">
                    No conversations yet. Start a new chat.
                  </div>
                )}
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => selectSession(session.id)}
                    className={cn(
                      "w-full max-w-full text-left rounded-lg px-3 py-2 transition-colors border border-transparent overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:ring-offset-background",
                      "hover:bg-accent/30 hover:border-accent/40",
                      session.id === activeSessionId
                        ? "bg-accent text-accent-foreground"
                        : "bg-transparent text-foreground",
                    )}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium max-w-full break-words whitespace-normal leading-snug overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                          {session.title || "Untitled"}
                        </div>
                      </div>
                      <MoreHorizontal className="h-4 w-4 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Chat pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
        <Card className="flex-1 flex flex-col overflow-hidden bg-card border-border">
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {combinedMessages.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Hello! I'm your AI assistant for Taskify. Ask anything about
                your tasks or try a suggested prompt below.
              </div>
            )}

            {combinedMessages.map((message) => {
              const parsedCreateTask =
                message.role === "assistant"
                  ? parseCreateTaskBlock(message.content)
                  : null;
              const matches = parsedCreateTask
                ? findTaskMatches(tasks, parsedCreateTask.payload)
                : [];
              const matchedTask = matches.length === 1 ? matches[0] : null;
              const previewTask = parsedCreateTask
                ? buildPreviewTask(message.id, message.timestamp, parsedCreateTask.payload)
                : null;
              const displayTask = matchedTask ?? previewTask;

              return (
                <div
                  key={message.id}
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
                      "max-w-[75%] rounded-lg px-4 py-2.5",
                      message.role === "user"
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {parsedCreateTask && displayTask ? (
                      <div className="space-y-2">
                        {parsedCreateTask.prefixText &&
                          renderTextMessage(parsedCreateTask.prefixText)}
                        <TaskCard
                          task={displayTask}
                          variant="list"
                          onClick={() => {
                            void handleTaskCardClick(parsedCreateTask.payload);
                          }}
                          onStatusToggle={() => {
                            void handleTaskCardStatusToggle(parsedCreateTask.payload);
                          }}
                          className="border-border/70 bg-card/90 text-foreground"
                        />
                        {parsedCreateTask.suffixText &&
                          renderTextMessage(parsedCreateTask.suffixText)}
                      </div>
                    ) : (
                      renderTextMessage(message.content)
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
            })}

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

            <div ref={messagesEndRef} />
          </CardContent>

          <div className="px-4 pt-3 border-t border-border/70 bg-background/60">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Read replies aloud</p>
                  <p className="text-xs text-muted-foreground">
                    {isSpeechSynthesisSupported
                      ? isSpeaking
                        ? "Assistant reply is being spoken."
                        : "New assistant replies will be spoken automatically."
                      : "Text-to-speech is not available in this browser."}
                  </p>
                </div>
              </div>
              <Switch
                checked={readRepliesAloud && isSpeechSynthesisSupported}
                onCheckedChange={setReadRepliesAloud}
                disabled={!isSpeechSynthesisSupported}
                aria-label="Toggle read replies aloud"
              />
            </div>
          </div>

          {combinedMessages.length <= 1 && (
            <div className="px-4 pb-2">
              <p className="text-xs text-muted-foreground mb-2">
                Suggested prompts:
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSuggestedPrompt(prompt)}
                    className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 border-t border-border">
            {(voiceError || isListening || interimTranscript || !isSpeechRecognitionSupported) && (
              <div className="mb-3 rounded-lg border border-border/70 bg-secondary/60 px-3 py-2 text-xs">
                {voiceError ? (
                  <p className="text-destructive">{voiceError}</p>
                ) : isListening ? (
                  <p className="text-foreground">
                    Listening in Vietnamese...
                    {interimTranscript ? ` ${interimTranscript}` : ""}
                  </p>
                ) : !isSpeechRecognitionSupported ? (
                  <p className="text-muted-foreground">
                    Voice input is not available in this browser.
                  </p>
                ) : null}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => {
                  if (isListening) {
                    stopListening();
                    resetTranscript();
                  }
                  setInput(e.target.value);
                }}
                onKeyPress={handleKeyPress}
                placeholder="Ask anything about your tasks..."
                className="flex-1 bg-secondary border-border"
                disabled={isTyping || isSending}
              />
              {isSpeechRecognitionSupported && (
                <Button
                  type="button"
                  variant={isListening ? "destructive" : "outline"}
                  onClick={handleVoiceInputToggle}
                  disabled={isTyping || isSending}
                  className="shrink-0"
                  aria-label={isListening ? "Stop voice input" : "Start voice input"}
                >
                  {isListening ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                onClick={handleSend}
                disabled={
                  !input.trim() ||
                  isTyping ||
                  isSending
                }
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>
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
