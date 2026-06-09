import { getApiUrl } from "./config";
import { getAuthHeaders, tokenStorage } from "./authApi";
import { ApiError } from "./taskApi";
import type { ChatMessageRole } from "../types";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  text: string;
  metadataJson?: string | null;
  sentAt: string;
  isStreaming?: boolean;
  isComplete?: boolean;
}

export interface ChatThreadResponse {
  session: ChatSession;
  messages: ChatMessage[];
}

export interface ChatStreamEvent {
  type:
    | "session_ready"
    | "user_message_saved"
    | "stage"
    | "assistant_message_start"
    | "assistant_message_delta"
    | "assistant_message_complete"
    | "error";
  session?: ChatSession;
  message?: ChatMessage;
  messageId?: string | null;
  deltaText?: string | null;
  fullText?: string | null;
  metadataJson?: string | null;
  stage?: string | null;
  sentAt?: string | null;
  errorMessage?: string | null;
}

export interface ChatStreamResponse {
  session: ChatSession | null;
  messages: ChatMessage[];
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    tokenStorage.clear();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError("Session expired. Please login again.", 401, response);
  }

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      // ignore
    }
    throw new ApiError(errorMessage, response.status, response);
  }

  return (await response.json()) as T;
}

function normalizeMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    role: String(message.role).toLowerCase() as ChatMessageRole,
  };
}

export const chatApi = {
  async listSessions(): Promise<ChatSession[]> {
    const url = getApiUrl("/api/Chat/sessions");
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...getAuthHeaders(),
      },
    });
    return handleResponse<ChatSession[]>(response);
  },

  async getMessages(sessionId: string, page = 1, pageSize = 30): Promise<ChatThreadResponse> {
    const url = getApiUrl(`/api/Chat/${sessionId}/messages?page=${page}&pageSize=${pageSize}`);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...getAuthHeaders(),
      },
    });
    return handleResponse<ChatThreadResponse>(response);
  },

  async sendMessage(
    sessionId: string,
    message: string,
    metadataJson?: string,
  ): Promise<ChatThreadResponse> {
    const url = getApiUrl(`/api/Chat/${sessionId}/messages`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ message, metadataJson }),
    });
    return handleResponse<ChatThreadResponse>(response);
  },

  async sendMessageStream(
    sessionId: string,
    message: string,
    metadataJson?: string,
    onEvent?: (event: ChatStreamEvent) => void,
  ): Promise<ChatStreamResponse> {
    const url = getApiUrl(`/api/Chat/${sessionId}/messages/stream`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        Accept: "application/x-ndjson",
      },
      body: JSON.stringify({ message, metadataJson }),
    });

    if (response.status === 401) {
      tokenStorage.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new ApiError("Session expired. Please login again.", 401, response);
    }

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        try {
          const text = await response.text();
          if (text) errorMessage = text;
        } catch {
          // ignore
        }
      }
      throw new ApiError(errorMessage, response.status, response);
    }

    if (!response.body) {
      throw new ApiError("Streaming response body is empty.", response.status, response);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let session: ChatSession | null = null;
    const completedMessages: ChatMessage[] = [];

    const processLine = (line: string) => {
      if (!line.trim()) return;
      const event = JSON.parse(line) as ChatStreamEvent;

      if (event.message) {
        event.message = normalizeMessage(event.message);
      }

      onEvent?.(event);

      if (event.type === "error") {
        throw new ApiError(
          event.errorMessage || "Failed to stream chat response.",
          response.status,
          response,
        );
      }

      if (event.session) {
        session = event.session;
      }

      if (event.type === "assistant_message_complete" && event.message) {
        completedMessages.push(event.message);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        processLine(line);
        newlineIndex = buffer.indexOf("\n");
      }

      if (done) {
        break;
      }
    }

    if (buffer.trim()) {
      processLine(buffer);
    }

    return { session, messages: completedMessages };
  },

  async deleteSession(sessionId: string): Promise<void> {
    const url = getApiUrl(`/api/Chat/${sessionId}`);
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        ...getAuthHeaders(),
      },
    });
    
    if (response.status === 401) {
      tokenStorage.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new ApiError("Session expired. Please login again.", 401, response);
    }

    if (!response.ok) {
      throw new ApiError(`API Error: ${response.status} ${response.statusText}`, response.status, response);
    }
  },
};
