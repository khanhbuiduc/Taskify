import { getApiUrl } from "./config";
import { getAuthHeaders, tokenStorage } from "./authApi";
import { ApiError } from "./taskApi";
import type { GeminiCredentialStatusResponse } from "../types";

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
      // Ignore non-JSON errors.
    }
    throw new ApiError(errorMessage, response.status, response);
  }

  return response.json() as Promise<T>;
}

export const geminiSettingsApi = {
  async getStatus(): Promise<GeminiCredentialStatusResponse> {
    const response = await fetch(getApiUrl("/api/settings/ai/gemini"), {
      method: "GET",
      headers: getAuthHeaders(),
    });

    return handleResponse<GeminiCredentialStatusResponse>(response);
  },

  async save(apiKey: string): Promise<GeminiCredentialStatusResponse> {
    const response = await fetch(getApiUrl("/api/settings/ai/gemini"), {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ apiKey }),
    });

    return handleResponse<GeminiCredentialStatusResponse>(response);
  },

  async remove(): Promise<GeminiCredentialStatusResponse> {
    const response = await fetch(getApiUrl("/api/settings/ai/gemini"), {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    return handleResponse<GeminiCredentialStatusResponse>(response);
  },
};
