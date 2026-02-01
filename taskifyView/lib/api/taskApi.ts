import { getApiUrl } from './config'
import { getAuthHeaders, tokenStorage } from './authApi'
import type { Task, TaskStatus, TaskPriority } from '../types'

/**
 * Input types for API calls
 */
export interface CreateTaskInput {
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  dueDate: string
  /** Optional "HH:mm". If omitted, deadline is end of that day. */
  dueTime?: string | null
}

export interface UpdateTaskInput {
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  dueDate: string
  dueTime?: string | null
}

/**
 * API Error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Fetch wrapper with error handling and authentication
 */
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
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
      // Handle 401 Unauthorized - clear token and redirect to login
      if (response.status === 401) {
        tokenStorage.clear()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        throw new ApiError('Session expired. Please login again.', 401, response)
      }

      let errorMessage = `API Error: ${response.status} ${response.statusText}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
      } catch {
        // If response is not JSON, use default message
      }
      throw new ApiError(errorMessage, response.status, response)
    }

    // Handle 204 No Content (for DELETE)
    if (response.status === 204) {
      return undefined as T
    }

    return await response.json()
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    // Network or other errors
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error occurred',
      undefined,
      error
    )
  }
}

/**
 * Task API service
 * All methods return promises and handle errors
 */
export const taskApi = {
  /**
   * Get all tasks
   */
  getAll: async (): Promise<Task[]> => {
    const response = await fetchApi<Task[]>('/api/TaskItem')
    return response
  },

  /**
   * Get a task by ID
   */
  getById: async (id: string): Promise<Task> => {
    const response = await fetchApi<Task>(`/api/TaskItem/${id}`)
    return response
  },

  /**
   * Create a new task
   */
  create: async (task: CreateTaskInput): Promise<Task> => {
    const response = await fetchApi<Task>('/api/TaskItem', {
      method: 'POST',
      body: JSON.stringify(task),
    })
    return response
  },

  /**
   * Update an existing task
   */
  update: async (id: string, task: UpdateTaskInput): Promise<Task> => {
    const response = await fetchApi<Task>(`/api/TaskItem/${id}`, {
      method: 'PUT',
      body: JSON.stringify(task),
    })
    return response
  },

  /**
   * Update task status only
   */
  updateStatus: async (id: string, status: TaskStatus): Promise<Task> => {
    const response = await fetchApi<Task>(`/api/TaskItem/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    return response
  },

  /**
   * Update task due date only
   */
  updateDueDate: async (id: string, dueDate: string, dueTime?: string | null): Promise<Task> => {
    const response = await fetchApi<Task>(`/api/TaskItem/${id}/duedate`, {
      method: 'PATCH',
      body: JSON.stringify({ dueDate, dueTime }),
    })
    return response
  },

  /**
   * Delete a task
   */
  delete: async (id: string): Promise<void> => {
    await fetchApi<void>(`/api/TaskItem/${id}`, {
      method: 'DELETE',
    })
  },
}
