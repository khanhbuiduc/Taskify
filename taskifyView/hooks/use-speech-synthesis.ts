"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

interface UseSpeechSynthesisOptions {
  lang?: string;
}

interface UseSpeechSynthesisResult {
  isSupported: boolean;
  isSpeaking: boolean;
  speakTexts: (texts: string[]) => void;
  cancel: () => void;
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const exactMatch = voices.find((voice) => voice.lang.toLowerCase() === lang.toLowerCase());
  if (exactMatch) {
    return exactMatch;
  }

  const languagePrefix = lang.split("-")[0]?.toLowerCase();
  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith(`${languagePrefix}-`)) ?? null
  );
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {},
): UseSpeechSynthesisResult {
  const { lang = "vi-VN" } = options;
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const requestIdRef = useRef(0);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  const cancel = useEffectEvent(() => {
    requestIdRef.current += 1;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  });

  const speakTexts = useEffectEvent((texts: string[]) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const cleanedTexts = texts.map((text) => text.trim()).filter(Boolean);
    if (cleanedTexts.length === 0) {
      return;
    }

    cancel();
    const requestId = requestIdRef.current;
    const synth = window.speechSynthesis;
    const selectedVoice = pickVoice(voicesRef.current, lang);

    const speakNext = (index: number) => {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (index >= cleanedTexts.length) {
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanedTexts[index]);
      utterance.lang = lang;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onend = () => {
        speakNext(index + 1);
      };
      utterance.onerror = () => {
        if (requestId === requestIdRef.current) {
          setIsSpeaking(false);
        }
      };

      setIsSpeaking(true);
      synth.speak(utterance);
    };

    speakNext(0);
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const hasSupport =
      "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
    setIsSupported(hasSupport);

    if (!hasSupport) {
      return;
    }

    const synth = window.speechSynthesis;
    const syncVoices = () => {
      voicesRef.current = synth.getVoices();
    };

    syncVoices();
    synth.addEventListener("voiceschanged", syncVoices);

    return () => {
      synth.removeEventListener("voiceschanged", syncVoices);
      synth.cancel();
    };
  }, []);

  return {
    isSupported,
    isSpeaking,
    speakTexts,
    cancel,
  };
}
