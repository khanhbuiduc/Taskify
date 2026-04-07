import { getApiUrl } from "./config";
import { getAuthHeaders, tokenStorage } from "./authApi";
import { ApiError } from "./taskApi";
import type { Note } from "../types";

type NotePayload = {
  title: string;
  content?: string;
  isPinned?: boolean;
};

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = getApiUrl(endpoint);
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        tokenStorage.clear();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw new ApiError("Session expired. Please login again.", 401, response);
      }

      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      try {
        const data = await response.json();
        errorMessage = data.message || errorMessage;
      } catch {
        // ignore
      }
      throw new ApiError(errorMessage, response.status, response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error instanceof Error ? error.message : "Network error", undefined, error);
  }
}

export const noteApi = {
  getAll: async (params?: { search?: string; pinned?: boolean; page?: number; pageSize?: number }): Promise<Note[]> => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.pinned !== undefined) query.set("pinned", String(params.pinned));
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return await fetchApi<Note[]>(`/api/Notes${suffix}`);
  },

  create: async (payload: NotePayload): Promise<Note> => {
    return await fetchApi<Note>("/api/Notes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update: async (id: string, payload: NotePayload): Promise<Note> => {
    return await fetchApi<Note>(`/api/Notes/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  delete: async (id: string): Promise<void> => {
    await fetchApi<void>(`/api/Notes/${id}`, { method: "DELETE" });
  },

  togglePin: async (id: string, isPinned?: boolean): Promise<Note> => {
    return await fetchApi<Note>(`/api/Notes/${id}/pin`, {
      method: "PATCH",
      body: JSON.stringify(isPinned),
    });
  },
};
