import { getApiUrl } from "./config";
import { getAuthHeaders, tokenStorage } from "./authApi";
import { ApiError } from "./taskApi";
import type { FinanceEntry, FinanceSummary } from "../types";

type FinanceEntryPayload = {
  date: string;
  category: string;
  description?: string;
  amount: number;
};

type FinanceQuery = {
  from?: string;
  to?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
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

export const financeApi = {
  getAll: async (params?: FinanceQuery): Promise<FinanceEntry[]> => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.category) query.set("category", params.category);
    if (params?.search) query.set("search", params.search);
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return await fetchApi<FinanceEntry[]>(`/api/FinanceEntries${suffix}`);
  },

  getSummary: async (params?: Pick<FinanceQuery, "from" | "to" | "category">): Promise<FinanceSummary> => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.category) query.set("category", params.category);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return await fetchApi<FinanceSummary>(`/api/FinanceEntries/summary${suffix}`);
  },

  create: async (payload: FinanceEntryPayload): Promise<FinanceEntry> => {
    return await fetchApi<FinanceEntry>("/api/FinanceEntries", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update: async (id: string, payload: FinanceEntryPayload): Promise<FinanceEntry> => {
    return await fetchApi<FinanceEntry>(`/api/FinanceEntries/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  delete: async (id: string): Promise<void> => {
    await fetchApi<void>(`/api/FinanceEntries/${id}`, {
      method: "DELETE",
    });
  },
};
