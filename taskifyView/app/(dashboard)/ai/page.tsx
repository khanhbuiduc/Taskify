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
import type { ChatMessageRole } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";

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

            {combinedMessages.map((message) => (
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
                  {renderTextMessage(message.content)}
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
            ))}

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
      </div>
    </div>
  );
}
