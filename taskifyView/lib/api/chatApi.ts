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
}

export interface ChatThreadResponse {
  session: ChatSession;
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
};
