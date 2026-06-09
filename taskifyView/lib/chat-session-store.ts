"use client";

import { create } from "zustand";
import { chatApi, type ChatStreamEvent } from "./api/chatApi";
import type { ChatMessage, ChatSession } from "./types";
import { ApiError } from "./api/taskApi";
import { toast } from "sonner";

type MessageMap = Record<string, ChatMessage[]>;
type PageMap = Record<string, number>;
type HasMoreMap = Record<string, boolean>;
type StreamingMessageMap = Record<string, ChatMessage | null>;
type StreamStageMap = Record<string, string | null>;

interface ChatSessionStore {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: MessageMap;
  pages: PageMap;
  hasMore: HasMoreMap;
  streamingMessageBySession: StreamingMessageMap;
  streamStageBySession: StreamStageMap;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;

  init: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  loadMessages: (sessionId: string, nextPage?: boolean) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  createNewSession: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  sendMessageStream: (text: string, metadata?: unknown) => Promise<ChatMessage[]>;
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
  streamingMessageBySession: {},
  streamStageBySession: {},
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
        .map((m) => ({
          ...m,
          role: (m.role as string).toLowerCase() as ChatMessage["role"],
          isStreaming: false,
          isComplete: true,
        }));
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
      streamingMessageBySession: { ...state.streamingMessageBySession, [newId]: null },
      streamStageBySession: { ...state.streamStageBySession, [newId]: null },
    }));
  },

  deleteSession: async (sessionId: string) => {
    try {
      await chatApi.deleteSession(sessionId);
      
      set((state) => {
        const remainingSessions = state.sessions.filter(s => s.id !== sessionId);
        const isActiveDeleted = state.activeSessionId === sessionId;
        
        let newActiveSessionId = state.activeSessionId;
        if (isActiveDeleted) {
          newActiveSessionId = remainingSessions.length > 0 ? remainingSessions[0].id : null;
        }

        const newMessages = { ...state.messages };
        delete newMessages[sessionId];
        const newStreamingMessages = { ...state.streamingMessageBySession };
        delete newStreamingMessages[sessionId];
        const newStages = { ...state.streamStageBySession };
        delete newStages[sessionId];
        
        return {
          sessions: remainingSessions,
          activeSessionId: newActiveSessionId,
          messages: newMessages,
          streamingMessageBySession: newStreamingMessages,
          streamStageBySession: newStages,
        };
      });
      
      toast.success("Xoá đoạn chat thành công");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to delete session";
      toast.error(message);
    }
  },

  sendMessageStream: async (text: string, metadata?: unknown) => {
    const sessionId = get().activeSessionId ?? newGuid();
    if (!get().activeSessionId) {
      set((state) => ({
        activeSessionId: sessionId,
        messages: { ...state.messages, [sessionId]: [] },
        streamingMessageBySession: {
          ...state.streamingMessageBySession,
          [sessionId]: null,
        },
        streamStageBySession: { ...state.streamStageBySession, [sessionId]: null },
      }));
    }
    set((state) => ({
      isSending: true,
      error: null,
      streamStageBySession: { ...state.streamStageBySession, [sessionId]: "starting" },
      streamingMessageBySession: {
        ...state.streamingMessageBySession,
        [sessionId]: null,
      },
    }));

    const tempUserId = `temp-${Date.now()}`;
    const optimisticUser: ChatMessage = {
      id: tempUserId,
      role: "user",
      text,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
      sentAt: new Date().toISOString(),
      isStreaming: false,
      isComplete: false,
    };
    const prevMessages = get().messages[sessionId] ?? [];
    get().appendMessages(sessionId, [optimisticUser]);
    let didPersistUserMessage = false;

    const upsertSession = (session: ChatSession) => {
      set((state) => ({
        sessions: state.sessions.some((item) => item.id === session.id)
          ? state.sessions.map((item) => (item.id === session.id ? session : item))
          : [session, ...state.sessions],
      }));
    };

    const mergeMessage = (
      currentMessages: ChatMessage[],
      incoming: ChatMessage,
      replaceId?: string,
    ) => {
      let replaced = false;
      const next = currentMessages.map((message) => {
        if (message.id === incoming.id || (replaceId && message.id === replaceId)) {
          replaced = true;
          return incoming;
        }
        return message;
      });

      if (!replaced) {
        next.push(incoming);
      }

      return next.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
    };

    const handleStreamEvent = (event: ChatStreamEvent) => {
      if (event.session) {
        upsertSession(event.session);
      }

      if (event.type === "stage") {
        set((state) => ({
          streamStageBySession: {
            ...state.streamStageBySession,
            [sessionId]: event.stage ?? null,
          },
        }));
        return;
      }

      if (event.type === "user_message_saved" && event.message) {
        didPersistUserMessage = true;
        const persistedUser = {
          ...event.message,
          isStreaming: false,
          isComplete: true,
        };

        set((state) => ({
          messages: {
            ...state.messages,
            [sessionId]: mergeMessage(
              state.messages[sessionId] ?? [],
              persistedUser,
              tempUserId,
            ),
          },
        }));
        return;
      }

      if (event.type === "assistant_message_start") {
        const messageId = event.messageId || `stream-${Date.now()}`;
        const streamingMessage: ChatMessage = {
          id: messageId,
          role: "assistant",
          text: "",
          metadataJson: null,
          sentAt: event.sentAt || new Date().toISOString(),
          isStreaming: true,
          isComplete: false,
        };

        set((state) => ({
          messages: {
            ...state.messages,
            [sessionId]: mergeMessage(state.messages[sessionId] ?? [], streamingMessage),
          },
          streamingMessageBySession: {
            ...state.streamingMessageBySession,
            [sessionId]: streamingMessage,
          },
        }));
        return;
      }

      if (event.type === "assistant_message_delta" && event.messageId) {
        set((state) => {
          const existing = (state.messages[sessionId] ?? []).find(
            (message) => message.id === event.messageId,
          );
          const updated: ChatMessage = {
            id: event.messageId || `stream-${Date.now()}`,
            role: "assistant",
            text: `${existing?.text ?? ""}${event.deltaText ?? ""}`,
            metadataJson: existing?.metadataJson ?? null,
            sentAt: existing?.sentAt ?? new Date().toISOString(),
            isStreaming: true,
            isComplete: false,
          };

          return {
            messages: {
              ...state.messages,
              [sessionId]: mergeMessage(state.messages[sessionId] ?? [], updated),
            },
            streamingMessageBySession: {
              ...state.streamingMessageBySession,
              [sessionId]: updated,
            },
          };
        });
        return;
      }

      if (event.type === "assistant_message_complete" && event.message) {
        const completedMessage: ChatMessage = {
          ...event.message,
          metadataJson: event.message.metadataJson ?? event.metadataJson ?? null,
          text: event.message.text ?? event.fullText ?? "",
          isStreaming: false,
          isComplete: true,
        };

        set((state) => ({
          messages: {
            ...state.messages,
            [sessionId]: mergeMessage(state.messages[sessionId] ?? [], completedMessage),
          },
          streamingMessageBySession: {
            ...state.streamingMessageBySession,
            [sessionId]: null,
          },
        }));
      }
    };

    try {
      const streamResponse = await chatApi.sendMessageStream(
        sessionId,
        text,
        metadata ? JSON.stringify(metadata) : undefined,
        handleStreamEvent,
      );

      if (streamResponse.session) {
        upsertSession(streamResponse.session);
      }

      set((state) => ({
        isSending: false,
        streamStageBySession: { ...state.streamStageBySession, [sessionId]: null },
        streamingMessageBySession: {
          ...state.streamingMessageBySession,
          [sessionId]: null,
        },
        pages: { ...state.pages, [sessionId]: Math.max(state.pages[sessionId] ?? 1, 1) },
        hasMore: { ...state.hasMore, [sessionId]: true },
      }));

      return streamResponse.messages.map((message) => ({
        ...message,
        isStreaming: false,
        isComplete: true,
      }));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to send message";
      toast.error(message);
      set((state) => ({
        messages: {
          ...state.messages,
          [sessionId]: didPersistUserMessage
            ? (state.messages[sessionId] ?? []).filter((item) => !item.isStreaming)
            : prevMessages,
        },
        isSending: false,
        error: message,
        streamStageBySession: { ...state.streamStageBySession, [sessionId]: null },
        streamingMessageBySession: {
          ...state.streamingMessageBySession,
          [sessionId]: null,
        },
      }));
      throw error;
    }
  },

  appendMessages: (sessionId, msgs) =>
    set((state) => ({
      messages: { ...state.messages, [sessionId]: [...(state.messages[sessionId] ?? []), ...msgs] },
    })),
}));
