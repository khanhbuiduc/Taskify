"use client"

import { create } from "zustand"
import { authApi, AuthError, tokenStorage, type UserInfo, type LoginInput, type RegisterInput } from "./api/authApi"
import { useTaskStore } from "./task-store"
import { toast } from "sonner"

interface AuthStore {
  user: UserInfo | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Actions
  login: (input: LoginInput) => Promise<boolean>
  register: (input: RegisterInput) => Promise<boolean>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  updateProfile: (fullName: string, avatarFile?: File) => Promise<boolean>
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<boolean>
  clearError: () => void
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,

  /**
   * Login with email and password
   */
  login: async (input: LoginInput): Promise<boolean> => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await authApi.login(input)
      
      // Fetch full user info to get userName and avatarUrl
      let userInfo: UserInfo
      try {
        userInfo = await authApi.getCurrentUser()
      } catch {
        // Fallback if getCurrentUser fails
        userInfo = {
          userId: response.userId,
          email: response.email,
          roles: response.roles,
        }
      }
      
      set({
        user: userInfo,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })
      
      // Reset task store to fetch fresh data for new user
      useTaskStore.getState().reset()
      
      toast.success("Login successful!")
      return true
    } catch (error) {
      const errorMessage = error instanceof AuthError 
        ? error.message 
        : "Login failed. Please try again."
      
      set({ 
        isLoading: false, 
        error: errorMessage,
        isAuthenticated: false,
        user: null,
        token: null,
      })
      
      toast.error(errorMessage)
      return false
    }
  },

  /**
   * Register a new user
   */
  register: async (input: RegisterInput): Promise<boolean> => {
    set({ isLoading: true, error: null })
    
    // Validate password match
    if (input.password !== input.confirmPassword) {
      set({ 
        isLoading: false, 
        error: "Passwords do not match" 
      })
      toast.error("Passwords do not match")
      return false
    }
    
    try {
      const response = await authApi.register(input)
      
      // Fetch full user info to get userName and avatarUrl
      let userInfo: UserInfo
      try {
        userInfo = await authApi.getCurrentUser()
      } catch {
        // Fallback if getCurrentUser fails
        userInfo = {
          userId: response.userId,
          email: response.email,
          roles: response.roles,
        }
      }
      
      set({
        user: userInfo,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })
      
      // Reset task store to fetch fresh data for new user
      useTaskStore.getState().reset()
      
      toast.success("Registration successful!")
      return true
    } catch (error) {
      const errorMessage = error instanceof AuthError 
        ? error.message 
        : "Registration failed. Please try again."
      
      set({ 
        isLoading: false, 
        error: errorMessage,
        isAuthenticated: false,
        user: null,
        token: null,
      })
      
      toast.error(errorMessage)
      return false
    }
  },

  /**
   * Logout current user
   */
  logout: async (): Promise<void> => {
    set({ isLoading: true })
    
    try {
      await authApi.logout()
    } catch {
      // Ignore errors - we'll clear state anyway
    }
    
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
    
    // Clear task store when logging out
    useTaskStore.getState().reset()
    
    toast.success("Logged out successfully")
  },

  /**
   * Check authentication status on app load
   */
  checkAuth: async (): Promise<void> => {
    // Don't check if already initialized
    if (get().isInitialized) return
    
    set({ isLoading: true })
    
    const token = tokenStorage.getToken()
    const storedUser = tokenStorage.getUser()
    
    if (!token) {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      })
      return
    }
    
    // Token exists, verify with API
    try {
      const user = await authApi.getCurrentUser()
      
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
      })
    } catch (error) {
      // Token is invalid or expired
      tokenStorage.clear()
      
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      })
    }
  },

  /**
   * Update user profile
   */
  updateProfile: async (fullName: string, avatarFile?: File): Promise<boolean> => {
    set({ isLoading: true, error: null })
    
    try {
      // Upload avatar if file is provided
      if (avatarFile) {
        await authApi.uploadAvatar(avatarFile)
        // Avatar is already updated in database by uploadAvatar endpoint
      }
      
      // Get current avatarUrl to preserve it if no new file
      const currentAvatarUrl = get().user?.avatarUrl
      
      // Update profile with fullName and current avatarUrl (to preserve it)
      const updatedUser = await authApi.updateProfile(fullName, currentAvatarUrl)
      
      // Fetch latest user info to ensure we have the most up-to-date data
      const latestUser = await authApi.getCurrentUser()
      
      set({
        user: latestUser,
        isLoading: false,
        error: null,
      })
      
      toast.success("Profile updated successfully!")
      return true
    } catch (error) {
      const errorMessage = error instanceof AuthError 
        ? error.message 
        : "Failed to update profile. Please try again."
      
      set({ 
        isLoading: false, 
        error: errorMessage,
      })
      
      toast.error(errorMessage)
      return false
    }
  },

  /**
   * Change user password
   */
  changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string): Promise<boolean> => {
    set({ isLoading: true, error: null })
    
    // Validate password match
    if (newPassword !== confirmPassword) {
      set({ 
        isLoading: false, 
        error: "New passwords do not match" 
      })
      toast.error("New passwords do not match")
      return false
    }
    
    try {
      await authApi.changePassword(currentPassword, newPassword, confirmPassword)
      
      set({
        isLoading: false,
        error: null,
      })
      
      toast.success("Password changed successfully!")
      return true
    } catch (error) {
      const errorMessage = error instanceof AuthError 
        ? error.message 
        : "Failed to change password. Please try again."
      
      set({ 
        isLoading: false, 
        error: errorMessage,
      })
      
      toast.error(errorMessage)
      return false
    }
  },

  /**
   * Clear error state
   */
  clearError: () => {
    set({ error: null })
  },
}))
