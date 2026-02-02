import { getApiUrl } from './config'
import { getAuthHeaders, tokenStorage } from './authApi'
import { ApiError } from './taskApi'

export interface ChatMessage {
  text: string
}

export interface ChatResponse {
  messages: ChatMessage[]
}

/**
 * Send a message to the AI assistant (proxied to Rasa via TaskifyAPI).
 * Returns list of assistant message texts. On error, throws ApiError or returns a single fallback message.
 */
export async function sendChatMessage(message: string): Promise<ChatResponse> {
  const url = getApiUrl('/api/Chat')

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ message }),
    })

    if (response.status === 401) {
      tokenStorage.clear()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new ApiError('Session expired. Please login again.', 401, response)
    }

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
      } catch {
        // ignore
      }
      throw new ApiError(errorMessage, response.status, response)
    }

    const data = (await response.json()) as ChatResponse
    return data
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error occurred',
      undefined,
      error
    )
  }
}
