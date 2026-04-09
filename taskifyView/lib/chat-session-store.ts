"use client";

import { create } from "zustand";
import { chatApi } from "./api/chatApi";
import type { ChatMessage, ChatSession } from "./types";
import { ApiError } from "./api/taskApi";
import { toast } from "sonner";

type MessageMap = Record<string, ChatMessage[]>;
type PageMap = Record<string, number>;
type HasMoreMap = Record<string, boolean>;

interface ChatSessionStore {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: MessageMap;
  pages: PageMap;
  hasMore: HasMoreMap;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;

  init: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  loadMessages: (sessionId: string, nextPage?: boolean) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  createNewSession: () => Promise<void>;
  sendMessage: (text: string, metadata?: unknown) => Promise<ChatMessage[]>;
  appendMessages: (sessionId: string, msgs: ChatMessage[]) => void;
}

function newGuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useChatSessionStore = create<ChatSessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: {},
  pages: {},
  hasMore: {},
  isLoading: false,
  isSending: false,
  error: null,

  init: async () => {
    await get().refreshSessions();
    const active = get().activeSessionId;
    if (active) {
      await get().loadMessages(active);
    }
  },

  refreshSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const sessions = await chatApi.listSessions();
      const active = sessions[0]?.id ?? get().activeSessionId;
      set({ sessions, activeSessionId: active, isLoading: false });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to load chat sessions";
      set({ error: message, isLoading: false });
      toast.error(message);
    }
  },

  loadMessages: async (sessionId, nextPage = false) => {
    const currentPage = get().pages[sessionId] ?? 0;
    const page = nextPage ? currentPage + 1 : 1;
    try {
      const thread = await chatApi.getMessages(sessionId, page);
      const existing = get().messages[sessionId] ?? [];
      // API returns newest-first; reverse to chronological
      const fetched = [...thread.messages]
        .reverse()
        .map((m) => ({ ...m, role: (m.role as string).toLowerCase() as ChatMessage["role"] }));
      const merged =
        page === 1
          ? fetched
          : [...fetched, ...existing];
      set((state) => ({
        messages: { ...state.messages, [sessionId]: merged },
        pages: { ...state.pages, [sessionId]: page },
        hasMore: { ...state.hasMore, [sessionId]: thread.messages.length > 0 },
        activeSessionId: sessionId,
      }));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to load messages";
      set({ error: message });
      toast.error(message);
      if (!nextPage) {
        set((state) => ({
          messages: { ...state.messages, [sessionId]: state.messages[sessionId] ?? [] },
        }));
      }
    }
  },

  selectSession: async (sessionId: string) => {
    set({ activeSessionId: sessionId });
    if (!get().messages[sessionId]) {
      await get().loadMessages(sessionId);
    }
  },

  createNewSession: async () => {
    const newId = newGuid();
    set((state) => ({
      activeSessionId: newId,
      messages: { ...state.messages, [newId]: [] },
      pages: { ...state.pages, [newId]: 0 },
      hasMore: { ...state.hasMore, [newId]: false },
    }));
  },

  sendMessage: async (text: string, metadata?: unknown) => {
    const sessionId = get().activeSessionId ?? newGuid();
    if (!get().activeSessionId) {
      set({ activeSessionId: sessionId, messages: { ...get().messages, [sessionId]: [] } });
    }
    set({ isSending: true });

    const optimisticUser: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      text,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
      sentAt: new Date().toISOString(),
    };
    const prevMessages = get().messages[sessionId] ?? [];
    get().appendMessages(sessionId, [optimisticUser]);

    try {
      const response = await chatApi.sendMessage(
        sessionId,
        text,
        metadata ? JSON.stringify(metadata) : undefined,
      );
      const normalized = [...response.messages]
        .map((m) => ({ ...m, role: (m.role as string).toLowerCase() as ChatMessage["role"] }))
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

      set((state) => ({
        sessions:
          state.sessions.some((s) => s.id === response.session.id)
            ? state.sessions.map((s) => (s.id === response.session.id ? response.session : s))
            : [response.session, ...state.sessions],
      }));

      set((state) => ({
        messages: {
          ...state.messages,
          [sessionId]: (() => {
            const previous = state.messages[sessionId] ?? [];
            const withoutTemps = previous.filter((m) => !m.id.startsWith("temp-"));
            const merged = [...withoutTemps, ...normalized];
            const dedup: ChatMessage[] = [];
            const seen = new Set<string>();
            for (const m of merged) {
              if (seen.has(m.id)) continue;
              seen.add(m.id);
              dedup.push(m);
            }
            return dedup.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
          })(),
        },
        isSending: false,
        pages: { ...state.pages, [sessionId]: Math.max(state.pages[sessionId] ?? 1, 1) },
        hasMore: { ...state.hasMore, [sessionId]: true },
      }));

      return normalized;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to send message";
      toast.error(message);
      set((state) => ({
        messages: { ...state.messages, [sessionId]: prevMessages },
        isSending: false,
        error: message,
      }));
      throw error;
    }
  },

  appendMessages: (sessionId, msgs) =>
    set((state) => ({
      messages: { ...state.messages, [sessionId]: [...(state.messages[sessionId] ?? []), ...msgs] },
    })),
}));
