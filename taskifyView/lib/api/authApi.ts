import { getApiUrl } from './config'

/**
 * Auth Types
 */
export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  email: string
  password: string
  confirmPassword: string
}

export interface AuthResponse {
  token: string
  userId: string
  email: string
  roles: string[]
}

export interface UserInfo {
  userId: string
  email: string
  userName?: string
  avatarUrl?: string
  roles: string[]
}

/**
 * Token storage keys
 */
const TOKEN_KEY = 'taskify_token'
const USER_KEY = 'taskify_user'

/**
 * Token management
 */
export const tokenStorage = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_KEY)
  },

  setToken: (token: string): void => {
    if (typeof window === 'undefined') return
    localStorage.setItem(TOKEN_KEY, token)
  },

  removeToken: (): void => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(TOKEN_KEY)
  },

  getUser: (): UserInfo | null => {
    if (typeof window === 'undefined') return null
    const userStr = localStorage.getItem(USER_KEY)
    if (!userStr) return null
    try {
      return JSON.parse(userStr)
    } catch {
      return null
    }
  },

  setUser: (user: UserInfo): void => {
    if (typeof window === 'undefined') return
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },

  removeUser: (): void => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(USER_KEY)
  },

  clear: (): void => {
    tokenStorage.removeToken()
    tokenStorage.removeUser()
  }
}

/**
 * Get authorization headers with token
 */
export const getAuthHeaders = (): HeadersInit => {
  const token = tokenStorage.getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

/**
 * Auth API Error class
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public status?: number,
    public errors?: any[]
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * Auth API service
 */
export const authApi = {
  /**
   * Login with email and password
   */
  login: async (input: LoginInput): Promise<AuthResponse> => {
    const url = getApiUrl('/api/Auth/login')
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      let errorMessage = 'Login failed'
      let errors: any[] = []
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
        errors = errorData.errors || []
      } catch {
        // If response is not JSON, use default message
      }
      throw new AuthError(errorMessage, response.status, errors)
    }

    const data: AuthResponse = await response.json()
    
    // Store token
    tokenStorage.setToken(data.token)
    // User info will be fetched by store after login

    return data
  },

  /**
   * Update user profile
   */
  updateProfile: async (fullName: string, avatarUrl?: string): Promise<UserInfo> => {
    const url = getApiUrl('/api/Auth/profile')
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ fullName, avatarUrl }),
    })

    if (!response.ok) {
      let errorMessage = 'Failed to update profile'
      let errors: any[] = []
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
        errors = errorData.errors || []
      } catch {
        // If response is not JSON, use default message
      }
      throw new AuthError(errorMessage, response.status, errors)
    }

    const data: UserInfo = await response.json()
    
    // Update stored user info
    tokenStorage.setUser(data)

    return data
  },

  /**
   * Upload avatar image
   */
  uploadAvatar: async (file: File): Promise<UserInfo> => {
    const url = getApiUrl('/api/Auth/avatar')
    const token = tokenStorage.getToken()
    
    const formData = new FormData()
    formData.append('file', file)
    
    const headers: HeadersInit = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      let errorMessage = 'Failed to upload avatar'
      let errors: any[] = []
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
        errors = errorData.errors || []
      } catch {
        // If response is not JSON, use default message
      }
      throw new AuthError(errorMessage, response.status, errors)
    }

    const data: UserInfo = await response.json()
    
    // Update stored user info
    tokenStorage.setUser(data)

    return data
  },

  /**
   * Change user password
   */
  changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> => {
    const url = getApiUrl('/api/Auth/change-password')
    
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword,
      }),
    })

    if (!response.ok) {
      let errorMessage = 'Failed to change password'
      let errors: any[] = []
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
        errors = errorData.errors || []
      } catch {
        // If response is not JSON, use default message
      }
      throw new AuthError(errorMessage, response.status, errors)
    }
  },

  /**
   * Register a new user
   */
  register: async (input: RegisterInput): Promise<AuthResponse> => {
    const url = getApiUrl('/api/Auth/register')
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      let errorMessage = 'Registration failed'
      let errors: any[] = []
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
        errors = errorData.errors || []
      } catch {
        // If response is not JSON, use default message
      }
      throw new AuthError(errorMessage, response.status, errors)
    }

    const data: AuthResponse = await response.json()
    
    // Store token
    tokenStorage.setToken(data.token)
    // User info will be fetched by store after register

    return data
  },

  /**
   * Logout current user
   */
  logout: async (): Promise<void> => {
    const token = tokenStorage.getToken()
    
    if (token) {
      try {
        const url = getApiUrl('/api/Auth/logout')
        await fetch(url, {
          method: 'POST',
          headers: getAuthHeaders(),
        })
      } catch {
        // Ignore errors - we'll clear local storage anyway
      }
    }

    // Clear local storage
    tokenStorage.clear()
  },

  /**
   * Get current user information
   */
  getCurrentUser: async (): Promise<UserInfo> => {
    const url = getApiUrl('/api/Auth/me')
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      if (response.status === 401) {
        tokenStorage.clear()
        throw new AuthError('Session expired', 401)
      }
      throw new AuthError('Failed to get user info', response.status)
    }

    const data: UserInfo = await response.json()
    
    // Update stored user info
    tokenStorage.setUser(data)

    return data
  },

  /**
   * Check if user is authenticated (has valid token)
   */
  isAuthenticated: (): boolean => {
    return !!tokenStorage.getToken()
  },

  /**
   * Get stored user info (without API call)
   */
  getStoredUser: (): UserInfo | null => {
    return tokenStorage.getUser()
  },
}
