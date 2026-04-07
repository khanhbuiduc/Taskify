"use client";

import { create } from "zustand";
import { noteApi } from "./api/noteApi";
import { ApiError } from "./api/taskApi";
import type { Note } from "./types";
import { toast } from "sonner";

interface NoteStore {
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  searchTerm: string;

  fetchNotes: (opts?: { search?: string }) => Promise<void>;
  createNote: (payload: { title: string; content?: string; isPinned?: boolean }) => Promise<Note>;
  updateNote: (id: string, payload: { title: string; content?: string; isPinned?: boolean }) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  togglePin: (id: string, isPinned?: boolean) => Promise<Note>;
  setSearchTerm: (value: string) => void;
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  isLoading: false,
  error: null,
  searchTerm: "",

  fetchNotes: async (opts) => {
    set({ isLoading: true, error: null });
    try {
      const notes = await noteApi.getAll({
        search: opts?.search ?? get().searchTerm,
      });
      // ensure pinned first, then updated desc
      const sorted = [...notes].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      set({ notes: sorted, isLoading: false });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to load notes";
      set({ error: message, isLoading: false });
      toast.error(message);
    }
  },

  createNote: async (payload) => {
    const note = await noteApi.create(payload);
    set((state) => ({
      notes: [note, ...state.notes].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
    }));
    toast.success("Note created");
    return note;
  },

  updateNote: async (id, payload) => {
    const updated = await noteApi.update(id, payload);
    set((state) => ({
      notes: state.notes
        .map((n) => (n.id === id ? updated : n))
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }),
    }));
    toast.success("Note updated");
    return updated;
  },

  deleteNote: async (id) => {
    await noteApi.delete(id);
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
    toast.success("Note deleted");
  },

  togglePin: async (id, isPinned) => {
    const note = await noteApi.togglePin(id, isPinned);
    set((state) => ({
      notes: state.notes
        .map((n) => (n.id === id ? note : n))
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }),
    }));
    toast.success(note.isPinned ? "Pinned note" : "Unpinned note");
    return note;
  },

  setSearchTerm: (value) => set({ searchTerm: value }),
}));
