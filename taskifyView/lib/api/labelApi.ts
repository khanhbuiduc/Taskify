import { getApiUrl } from './config'
import { getAuthHeaders } from './authApi'
import type { Label } from '../types'
import { ApiError } from './taskApi'

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = getApiUrl(endpoint)
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options?.headers,
    },
  })

  if (!response.ok) {
    let message = `API Error: ${response.status} ${response.statusText}`
    try {
      const data = await response.json()
      message = data.message || message
    } catch {
      // ignore
    }
    throw new ApiError(message, response.status, response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export const labelApi = {
  getAll: async (): Promise<Label[]> => {
    return await fetchApi<Label[]>('/api/Label')
  },
  create: async (payload: { name: string; color: string }): Promise<Label> => {
    return await fetchApi<Label>('/api/Label', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  update: async (id: number, payload: { name: string; color: string }): Promise<Label> => {
    return await fetchApi<Label>(`/api/Label/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
  delete: async (id: number): Promise<void> => {
    await fetchApi<void>(`/api/Label/${id}`, {
      method: 'DELETE',
    })
  },
}
