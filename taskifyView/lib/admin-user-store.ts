"use client"

import { create } from "zustand"
import { toast } from "sonner"
import { adminUserApi, type CreateAdminUserInput, type UpdateAdminUserInput } from "./api/adminUserApi"
import { ApiError } from "./api/taskApi"
import type { AdminUser, AdminUserRole } from "./types"

type AdminUserStatusFilter = "all" | "active" | "banned"
type AdminUserRoleFilter = "all" | AdminUserRole

interface AdminUserStore {
  users: AdminUser[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  search: string
  roleFilter: AdminUserRoleFilter
  statusFilter: AdminUserStatusFilter
  isLoading: boolean
  isSaving: boolean
  error: string | null
  setSearch: (value: string) => void
  setRoleFilter: (value: AdminUserRoleFilter) => void
  setStatusFilter: (value: AdminUserStatusFilter) => void
  setPage: (value: number) => void
  fetchUsers: () => Promise<void>
  refresh: () => Promise<void>
  createUser: (input: CreateAdminUserInput) => Promise<boolean>
  updateUser: (id: string, input: UpdateAdminUserInput) => Promise<boolean>
  banUser: (id: string) => Promise<boolean>
  unbanUser: (id: string) => Promise<boolean>
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

export const useAdminUserStore = create<AdminUserStore>((set, get) => ({
  users: [],
  page: 1,
  pageSize: 10,
  totalCount: 0,
  totalPages: 0,
  search: "",
  roleFilter: "all",
  statusFilter: "all",
  isLoading: false,
  isSaving: false,
  error: null,

  setSearch: (value) => set({ search: value, page: 1 }),
  setRoleFilter: (value) => set({ roleFilter: value, page: 1 }),
  setStatusFilter: (value) => set({ statusFilter: value, page: 1 }),
  setPage: (value) => set({ page: value }),

  fetchUsers: async () => {
    set({ isLoading: true, error: null })

    try {
      const { search, roleFilter, statusFilter, page, pageSize } = get()
      const response = await adminUserApi.getAll({
        search: search.trim() || undefined,
        role: roleFilter === "all" ? undefined : roleFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        pageSize,
      })

      set({
        users: response.items,
        totalCount: response.totalCount,
        totalPages: response.totalPages,
        page: response.page,
        pageSize: response.pageSize,
        isLoading: false,
      })
    } catch (error) {
      const message = getErrorMessage(error, "Failed to load users")
      set({ error: message, isLoading: false })
      toast.error(message)
    }
  },

  refresh: async () => {
    await get().fetchUsers()
  },

  createUser: async (input) => {
    set({ isSaving: true, error: null })

    try {
      await adminUserApi.create(input)
      set({ isSaving: false, page: 1 })
      toast.success("User created")
      await get().fetchUsers()
      return true
    } catch (error) {
      const message = getErrorMessage(error, "Failed to create user")
      set({ isSaving: false, error: message })
      toast.error(message)
      return false
    }
  },

  updateUser: async (id, input) => {
    set({ isSaving: true, error: null })

    try {
      await adminUserApi.update(id, input)
      set({ isSaving: false })
      toast.success("User updated")
      await get().fetchUsers()
      return true
    } catch (error) {
      const message = getErrorMessage(error, "Failed to update user")
      set({ isSaving: false, error: message })
      toast.error(message)
      return false
    }
  },

  banUser: async (id) => {
    set({ isSaving: true, error: null })

    try {
      await adminUserApi.ban(id)
      set({ isSaving: false })
      toast.success("User banned")
      await get().fetchUsers()
      return true
    } catch (error) {
      const message = getErrorMessage(error, "Failed to ban user")
      set({ isSaving: false, error: message })
      toast.error(message)
      return false
    }
  },

  unbanUser: async (id) => {
    set({ isSaving: true, error: null })

    try {
      await adminUserApi.unban(id)
      set({ isSaving: false })
      toast.success("User unbanned")
      await get().fetchUsers()
      return true
    } catch (error) {
      const message = getErrorMessage(error, "Failed to unban user")
      set({ isSaving: false, error: message })
      toast.error(message)
      return false
    }
  },
}))
