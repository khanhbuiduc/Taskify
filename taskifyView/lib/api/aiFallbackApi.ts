import { getApiUrl } from "./config";
import { getAuthHeaders, tokenStorage } from "./authApi";
import { ApiError } from "./taskApi";
import type {
  AiFallbackSettingsResponse,
  AiProvider,
  OllamaModelSummary,
} from "../types";

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

export const aiFallbackApi = {
  async getSettings(): Promise<AiFallbackSettingsResponse> {
    const response = await fetch(getApiUrl("/api/settings/ai/fallback"), {
      method: "GET",
      headers: getAuthHeaders(),
    });

    return handleResponse<AiFallbackSettingsResponse>(response);
  },

  async saveActiveProvider(provider: AiProvider): Promise<AiFallbackSettingsResponse> {
    const response = await fetch(getApiUrl("/api/settings/ai/fallback/provider"), {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ provider }),
    });

    return handleResponse<AiFallbackSettingsResponse>(response);
  },

  async loadOllamaModels(baseUrl: string): Promise<OllamaModelSummary[]> {
    const response = await fetch(getApiUrl("/api/settings/ai/ollama/models"), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ baseUrl }),
    });

    const data = await handleResponse<{ models: OllamaModelSummary[] }>(response);
    return data.models ?? [];
  },

  async saveOllamaSettings(baseUrl: string, model: string): Promise<AiFallbackSettingsResponse> {
    const response = await fetch(getApiUrl("/api/settings/ai/ollama"), {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ baseUrl, model }),
    });

    return handleResponse<AiFallbackSettingsResponse>(response);
  },

  async deleteOllamaSettings(): Promise<AiFallbackSettingsResponse> {
    const response = await fetch(getApiUrl("/api/settings/ai/ollama"), {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    return handleResponse<AiFallbackSettingsResponse>(response);
  },
};
