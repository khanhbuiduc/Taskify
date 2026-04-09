"use client";

/**
 * chat-input-bar.tsx — Thanh nhập liệu phía dưới chat.
 * Bao gồm: toggle đọc to, suggested prompts, voice input, ô nhập, nút gửi.
 */

import { Send, Loader2, Mic, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const SUGGESTED_PROMPTS = [
  "What tasks are overdue?",
  "Summarize my week",
  "Help me prioritize tasks",
  "Create a new task for tomorrow",
];

export interface ChatInputBarProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  isSending: boolean;
  isTyping: boolean;
  // Voice
  isSpeechRecognitionSupported: boolean;
  isSpeechSynthesisSupported: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  interimTranscript: string;
  voiceError: string | null;
  readRepliesAloud: boolean;
  onReadRepliesAloudChange: (v: boolean) => void;
  onVoiceToggle: () => void;
  // Suggested prompts
  showSuggestedPrompts: boolean;
  onSuggestedPrompt: (prompt: string) => void;
}

export function ChatInputBar({
  input,
  onInputChange,
  onSend,
  onKeyPress,
  isSending,
  isTyping,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  isListening,
  isSpeaking,
  interimTranscript,
  voiceError,
  readRepliesAloud,
  onReadRepliesAloudChange,
  onVoiceToggle,
  showSuggestedPrompts,
  onSuggestedPrompt,
}: ChatInputBarProps) {
  return (
    <>
      {/* Read replies aloud toggle */}
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
            onCheckedChange={onReadRepliesAloudChange}
            disabled={!isSpeechSynthesisSupported}
            aria-label="Toggle read replies aloud"
          />
        </div>
      </div>

      {/* Suggested prompts */}
      {showSuggestedPrompts && (
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-2">
            Suggested prompts:
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onSuggestedPrompt(prompt)}
                className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input row */}
      <div className="p-4 border-t border-border">
        {/* Voice status banner */}
        {(voiceError ||
          isListening ||
          interimTranscript ||
          !isSpeechRecognitionSupported) && (
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
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={onKeyPress}
            placeholder="Ask anything about your tasks..."
            className="flex-1 bg-secondary border-border"
            disabled={isTyping || isSending}
          />

          {isSpeechRecognitionSupported && (
            <Button
              type="button"
              variant={isListening ? "destructive" : "outline"}
              onClick={onVoiceToggle}
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
            onClick={onSend}
            disabled={!input.trim() || isTyping || isSending}
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
    </>
  );
}
