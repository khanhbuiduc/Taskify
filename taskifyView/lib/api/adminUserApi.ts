import { getApiUrl } from "./config"
import { getAuthHeaders, tokenStorage } from "./authApi"
import type { AdminUser, AdminUserRole, PagedResult } from "../types"
import { ApiError } from "./taskApi"

export interface AdminUserListParams {
  search?: string
  role?: AdminUserRole
  status?: "active" | "banned"
  page?: number
  pageSize?: number
}

export interface CreateAdminUserInput {
  email: string
  displayName: string
  password: string
  role: AdminUserRole
}

export interface UpdateAdminUserInput {
  email: string
  displayName: string
  role: AdminUserRole
  newPassword?: string
  confirmNewPassword?: string
}

async function fetchAdminApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = getApiUrl(endpoint)

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options?.headers,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        tokenStorage.clear()
        if (typeof window !== "undefined") {
          window.location.href = "/login"
        }
        throw new ApiError("Session expired. Please login again.", 401, response)
      }

      let errorMessage = `API Error: ${response.status} ${response.statusText}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
      } catch {
        // Ignore non-JSON responses.
      }

      throw new ApiError(errorMessage, response.status, response)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return await response.json()
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError(
      error instanceof Error ? error.message : "Network error occurred",
      undefined,
      error,
    )
  }
}

export const adminUserApi = {
  async getAll(params: AdminUserListParams): Promise<PagedResult<AdminUser>> {
    const query = new URLSearchParams()

    if (params.search) query.set("search", params.search)
    if (params.role) query.set("role", params.role)
    if (params.status) query.set("status", params.status)
    if (params.page) query.set("page", String(params.page))
    if (params.pageSize) query.set("pageSize", String(params.pageSize))

    const queryString = query.toString()
    return await fetchAdminApi<PagedResult<AdminUser>>(
      `/api/AdminUsers${queryString ? `?${queryString}` : ""}`,
    )
  },

  async getById(id: string): Promise<AdminUser> {
    return await fetchAdminApi<AdminUser>(`/api/AdminUsers/${id}`)
  },

  async create(input: CreateAdminUserInput): Promise<AdminUser> {
    return await fetchAdminApi<AdminUser>("/api/AdminUsers", {
      method: "POST",
      body: JSON.stringify(input),
    })
  },

  async update(id: string, input: UpdateAdminUserInput): Promise<AdminUser> {
    return await fetchAdminApi<AdminUser>(`/api/AdminUsers/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    })
  },

  async ban(id: string): Promise<AdminUser> {
    return await fetchAdminApi<AdminUser>(`/api/AdminUsers/${id}/ban`, {
      method: "POST",
    })
  },

  async unban(id: string): Promise<AdminUser> {
    return await fetchAdminApi<AdminUser>(`/api/AdminUsers/${id}/unban`, {
      method: "POST",
    })
  },
}
