/**
 * API Configuration
 * Base URL for backend API endpoints
 */
export const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5116',
  timeout: 10000, // 10 seconds
} as const

/**
 * Get full API URL for a given endpoint
 */
export const getApiUrl = (endpoint: string): string => {
  const base = API_CONFIG.baseURL.replace(/\/$/, '') // Remove trailing slash
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${base}${path}`
}
