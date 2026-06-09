export type TaskPriority = "low" | "medium" | "high"
export type TaskStatus = "todo" | "in-progress" | "completed"

export interface Label {
  id: number
  name: string
  color: string
}

export interface Task {
  id: string
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  dueDate: string
  createdAt: string
  labels: Label[]
}

export interface Note {
  id: string
  title: string
  content: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
}

export interface FinanceEntry {
  id: string
  date: string
  category: string
  description: string
  amount: number
  createdAt: string
  updatedAt: string
}

export interface FinanceCategory {
  id: string
  name: string
  createdAt: string
}

export interface FinanceSummaryDaily {
  date: string
  totalAmount: number
}

export interface FinanceSummary {
  totalAmount: number
  count: number
  averageAmount: number
  dailyTotals: FinanceSummaryDaily[]
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasPrevious: boolean
  hasNext: boolean
}

export type AdminUserRole = "Admin" | "User"
export type AdminUserStatus = "Active" | "Banned"

export interface AdminUser {
  userId: string
  email: string
  userName: string
  avatarUrl?: string | null
  roles: AdminUserRole[]
  isBanned: boolean
  lockoutEndUtc?: string | null
  status: AdminUserStatus
}

export type ChatMessageRole = "user" | "assistant"
export type GeminiCredentialStatus = "NotConfigured" | "Valid" | "Invalid" | "ValidationFailed"
export type AiProvider = "Gemini" | "Ollama"

export interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  text: string
  metadataJson?: string | null
  sentAt: string
  isStreaming?: boolean
  isComplete?: boolean
}

export interface GeminiCredentialStatusResponse {
  configured: boolean
  status: GeminiCredentialStatus
  lastValidatedAtUtc?: string | null
  lastValidationError?: string | null
}

export interface OllamaModelSummary {
  name: string
  family?: string | null
  parameterSize?: string | null
  quantizationLevel?: string | null
}

export interface OllamaSettingsStatus {
  configured: boolean
  baseUrl?: string | null
  model?: string | null
  lastValidatedAtUtc?: string | null
  lastValidationError?: string | null
}

export interface AiFallbackSettingsResponse {
  activeProvider: AiProvider | null
  gemini: GeminiCredentialStatusResponse
  ollama: OllamaSettingsStatus
}
