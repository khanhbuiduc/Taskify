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

export type ChatMessageRole = "user" | "assistant"

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
}
