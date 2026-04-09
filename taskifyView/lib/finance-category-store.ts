"use client";

import { create } from "zustand";
import { financeCategoryApi } from "./api/financeCategoryApi";
import { ApiError } from "./api/taskApi";
import type { FinanceCategory } from "./types";
import { toast } from "sonner";

interface FinanceCategoryStore {
  categories: FinanceCategory[];
  isLoading: boolean;
  error: string | null;
  fetchCategories: () => Promise<void>;
  createCategory: (payload: { name: string }) => Promise<FinanceCategory>;
  updateCategory: (id: string, payload: { name: string }) => Promise<FinanceCategory>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useFinanceCategoryStore = create<FinanceCategoryStore>((set, get) => ({
  categories: [],
  isLoading: false,
  error: null,

  fetchCategories: async () => {
    set({ isLoading: true, error: null });
    try {
      const categories = await financeCategoryApi.getAll();
      set({
        categories: [...categories].sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to load finance categories";
      set({ error: message, isLoading: false });
      toast.error(message);
    }
  },

  createCategory: async (payload) => {
    const created = await financeCategoryApi.create(payload);
    set({
      categories: [...get().categories, created].sort((a, b) => a.name.localeCompare(b.name)),
    });
    toast.success("Category created");
    return created;
  },

  updateCategory: async (id, payload) => {
    const updated = await financeCategoryApi.update(id, payload);
    set({
      categories: get()
        .categories.map((c) => (c.id === id ? updated : c))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
    toast.success("Category updated");
    return updated;
  },

  deleteCategory: async (id) => {
    await financeCategoryApi.delete(id);
    set({ categories: get().categories.filter((c) => c.id !== id) });
    toast.success("Category deleted");
  },
}));
