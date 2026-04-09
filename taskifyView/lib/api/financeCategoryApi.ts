import { getApiUrl } from "./config";
import { getAuthHeaders, tokenStorage } from "./authApi";
import { ApiError } from "./taskApi";
import type { FinanceCategory } from "../types";

type FinanceCategoryPayload = {
  name: string;
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

export const financeCategoryApi = {
  getAll: async (): Promise<FinanceCategory[]> => {
    return await fetchApi<FinanceCategory[]>("/api/FinanceCategories");
  },

  create: async (payload: FinanceCategoryPayload): Promise<FinanceCategory> => {
    return await fetchApi<FinanceCategory>("/api/FinanceCategories", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update: async (id: string, payload: FinanceCategoryPayload): Promise<FinanceCategory> => {
    return await fetchApi<FinanceCategory>(`/api/FinanceCategories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  delete: async (id: string): Promise<void> => {
    await fetchApi<void>(`/api/FinanceCategories/${id}`, {
      method: "DELETE",
    });
  },
};
