"use client";

import { create } from "zustand";
import { financeApi } from "./api/financeApi";
import { ApiError } from "./api/taskApi";
import type { FinanceEntry, FinanceSummary } from "./types";
import { toast } from "sonner";

interface FinanceFilters {
  from?: string;
  to?: string;
  category?: string;
  search?: string;
}

interface FinanceStore {
  entries: FinanceEntry[];
  summary: FinanceSummary;
  isLoading: boolean;
  isSummaryLoading: boolean;
  error: string | null;
  filters: FinanceFilters;

  setFilters: (filters: FinanceFilters) => void;
  fetchEntries: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  refresh: () => Promise<void>;
  createEntry: (payload: { date: string; category: string; description?: string; amount: number }) => Promise<FinanceEntry>;
  updateEntry: (
    id: string,
    payload: { date: string; category: string; description?: string; amount: number }
  ) => Promise<FinanceEntry>;
  deleteEntry: (id: string) => Promise<void>;
}

const emptySummary: FinanceSummary = {
  totalAmount: 0,
  count: 0,
  averageAmount: 0,
  dailyTotals: [],
};

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  entries: [],
  summary: emptySummary,
  isLoading: false,
  isSummaryLoading: false,
  error: null,
  filters: {},

  setFilters: (filters) => set({ filters }),

  fetchEntries: async () => {
    set({ isLoading: true, error: null });
    try {
      const entries = await financeApi.getAll(get().filters);
      set({
        entries: [...entries].sort((a, b) => {
          const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateCompare !== 0) return dateCompare;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }),
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to load finance entries";
      set({ error: message, isLoading: false });
      toast.error(message);
    }
  },

  fetchSummary: async () => {
    set({ isSummaryLoading: true });
    try {
      const { from, to, category } = get().filters;
      const summary = await financeApi.getSummary({ from, to, category });
      set({ summary, isSummaryLoading: false });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to load finance summary";
      set({ error: message, isSummaryLoading: false });
      toast.error(message);
    }
  },

  refresh: async () => {
    await Promise.all([get().fetchEntries(), get().fetchSummary()]);
  },

  createEntry: async (payload) => {
    const created = await financeApi.create(payload);
    await get().refresh();
    toast.success("Finance entry created");
    return created;
  },

  updateEntry: async (id, payload) => {
    const updated = await financeApi.update(id, payload);
    await get().refresh();
    toast.success("Finance entry updated");
    return updated;
  },

  deleteEntry: async (id) => {
    await financeApi.delete(id);
    await get().refresh();
    toast.success("Finance entry deleted");
  },
}));
