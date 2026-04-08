"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

type SpeechRecognitionStatus = "idle" | "listening" | "error";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
  length: number;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

interface UseSpeechRecognitionOptions {
  lang?: string;
  onDraftChange?: (draft: string) => void;
}

interface UseSpeechRecognitionResult {
  isSupported: boolean;
  isListening: boolean;
  status: SpeechRecognitionStatus;
  finalTranscript: string;
  interimTranscript: string;
  error: string | null;
  startListening: (baseText?: string) => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

function getRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function composeDraft(baseText: string, transcript: string): string {
  const normalizedTranscript = transcript.trim();
  if (!normalizedTranscript) {
    return baseText;
  }

  const trimmedBase = baseText.trimEnd();
  if (!trimmedBase) {
    return normalizedTranscript;
  }

  return `${trimmedBase} ${normalizedTranscript}`;
}

function mapRecognitionError(error: string): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was denied.";
    case "audio-capture":
      return "No microphone was found for voice input.";
    case "no-speech":
      return "No speech detected. Try again.";
    case "network":
      return "Voice input failed because the speech service is unavailable.";
    default:
      return "Voice input is unavailable right now.";
  }
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionResult {
  const { lang = "vi-VN", onDraftChange } = options;
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const baseTextRef = useRef("");
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<SpeechRecognitionStatus>("idle");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const publishDraft = useEffectEvent((draft: string) => {
    onDraftChange?.(draft);
  });

  const syncTranscripts = useEffectEvent(() => {
    setFinalTranscript(finalTranscriptRef.current);
    setInterimTranscript(interimTranscriptRef.current);
    const combined = [finalTranscriptRef.current, interimTranscriptRef.current]
      .filter(Boolean)
      .join(" ")
      .trim();
    publishDraft(composeDraft(baseTextRef.current, combined));
  });

  const stopListening = useEffectEvent(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    if (status !== "error") {
      setStatus("idle");
    }
  });

  const resetTranscript = useEffectEvent(() => {
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);
    if (!isListening) {
      setStatus("idle");
    }
  });

  const startListening = useEffectEvent((baseText = "") => {
    const RecognitionCtor = getRecognitionConstructor();
    if (!RecognitionCtor) {
      setIsSupported(false);
      setStatus("error");
      setError("This browser does not support voice input.");
      return;
    }

    recognitionRef.current?.abort();
    baseTextRef.current = baseText;
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);

    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus("listening");
    };

    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) {
        return;
      }

      let appendedFinal = "";
      let nextInterim = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          appendedFinal += ` ${transcript}`;
        } else {
          nextInterim += ` ${transcript}`;
        }
      }

      if (appendedFinal.trim()) {
        finalTranscriptRef.current = `${finalTranscriptRef.current} ${appendedFinal}`.trim();
      }
      interimTranscriptRef.current = nextInterim.trim();
      syncTranscripts();
    };

    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) {
        return;
      }

      setError(mapRecognitionError(event.error));
      setStatus("error");
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) {
        return;
      }

      recognitionRef.current = null;
      setIsListening(false);
      if (status !== "error") {
        setStatus("idle");
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError("Voice input could not be started.");
      setStatus("error");
      setIsListening(false);
      recognitionRef.current = null;
    }
  });

  useEffect(() => {
    setIsSupported(Boolean(getRecognitionConstructor()));
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return {
    isSupported,
    isListening,
    status,
    finalTranscript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
