"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import { Send, Bot, User, Sparkles, Circle, Trash2, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useChatSessionStore } from "@/lib/chat-session-store"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import {
  parseIntent,
  matchTasks,
  isAffirmative,
  isNegative,
  buildDefaultTask,
} from "@/lib/chat-task-orchestrator"
import { PriorityBadge } from "@/components/task-ui/priority-badge"

type ChatMessage =
  | { id: string; role: "user" | "assistant"; type: "text"; content: string; timestamp: Date }
  | { id: string; role: "assistant"; type: "task-list"; title: string; tasks: Task[]; action: "delete" | "list"; timestamp: Date }
  | { id: string; role: "assistant"; type: "result"; status: "success" | "error"; action: string; content: string; timestamp: Date }

type PendingDelete = { tasks: Task[] }

const suggestedPrompts = [
  "What tasks are overdue?",
  "Summarize my week",
  "Help me prioritize tasks",
  "Create a new task for tomorrow",
]

const renderTextMessage = (content: string) => (
  <p className="text-sm leading-relaxed whitespace-pre-line">{content}</p>
)

export default function AILayoutPage() {
  const {
    tasks,
    fetchTasks,
    fetchLabels,
    addTask,
    updateTask,
    deleteTask,
    isInitialized,
  } = useTaskStore()
  const {
    sessions,
    activeSessionId,
    messages: persistedMessages,
    hasMore,
    init,
    selectSession,
    loadMessages,
    createNewSession,
    sendMessage: sendPersistedMessage,
    isSending,
  } = useChatSessionStore()

  const greeting: ChatMessage = useMemo(
    () => ({
      id: "greeting",
      role: "assistant",
      type: "text",
      content:
        "Hello! I'm your AI assistant for Taskify. I can help you manage tasks, analyze your productivity, and answer questions about your projects. How can I help you today?",
      timestamp: new Date(),
    }),
    [],
  )
  const [localMessages, setLocalMessages] = useState<Record<string, ChatMessage[]>>({
    new: [greeting],
  })
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const persistedList = useMemo(() => {
    if (!activeSessionId) return []
    const list = persistedMessages[activeSessionId] ?? []
    return list.map<ChatMessage>((m) => ({
      id: m.id,
      role: m.role,
      type: "text",
      content: m.text,
      timestamp: new Date(m.sentAt),
    }))
  }, [activeSessionId, persistedMessages])

  const sessionKey = activeSessionId ?? "new"
  const localForSession = localMessages[sessionKey] ?? (sessionKey === "new" ? [greeting] : [])

  const combinedMessages = useMemo(() => {
    return [...persistedList, ...localForSession].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    )
  }, [localForSession, persistedList])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [combinedMessages])

  useEffect(() => {
    if (!isInitialized) {
      fetchTasks()
      fetchLabels()
    }
  }, [fetchTasks, fetchLabels, isInitialized])

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    setLocalMessages((prev) => {
      if (prev[sessionKey]) return prev
      return {
        ...prev,
        [sessionKey]: sessionKey === "new" ? [greeting] : [],
      }
    })
  }, [sessionKey, greeting])

  const appendMessage = (msg: ChatMessage | ChatMessage[]) => {
    const payload = Array.isArray(msg) ? msg : [msg]
    setLocalMessages((prev) => ({
      ...prev,
      [sessionKey]: [...(prev[sessionKey] ?? []), ...payload],
    }))
  }

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return
    const ids = selectedIds.length ? selectedIds : pendingDelete.tasks.map((t) => t.id)
    if (!ids.length) return
    try {
      for (const id of ids) {
        await deleteTask(id)
      }
      appendMessage({
        id: `${Date.now()}`,
        role: "assistant",
        type: "result",
        status: "success",
        action: "delete",
        content: `Deleted ${ids.length} task(s).`,
        timestamp: new Date(),
      })
    } catch (error) {
      appendMessage({
        id: `${Date.now()}`,
        role: "assistant",
        type: "result",
        status: "error",
        action: "delete",
        content: `Failed to delete tasks: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      })
    } finally {
      setPendingDelete(null)
      setSelectedIds([])
    }
  }

  const handleDeleteCancel = () => {
    setPendingDelete(null)
    setSelectedIds([])
    appendMessage({
      id: `${Date.now()}`,
      role: "assistant",
      type: "text",
      content: "Cancelled deletion.",
      timestamp: new Date(),
    })
  }

  const handleSend = async () => {
    if (!input.trim()) return

    const messageToSend = input
    setInput("")

    // pending delete confirm/cancel
    if (pendingDelete && isAffirmative(messageToSend)) {
      appendMessage({
        id: `${Date.now()}`,
        role: "user",
        type: "text",
        content: messageToSend,
        timestamp: new Date(),
      })
      await handleDeleteConfirm()
      return
    }
    if (pendingDelete && isNegative(messageToSend)) {
      appendMessage({
        id: `${Date.now()}`,
        role: "user",
        type: "text",
        content: messageToSend,
        timestamp: new Date(),
      })
      handleDeleteCancel()
      return
    }

    const intent = parseIntent(messageToSend)

    // Local quick actions stay in-memory (for speed)
    if (intent.kind === "create" || intent.kind === "list" || intent.kind === "delete") {
      appendMessage({
        id: Date.now().toString(),
        role: "user",
        type: "text",
        content: messageToSend,
        timestamp: new Date(),
      })
    }

    setIsTyping(true)

    try {
      if (intent.kind === "create") {
        const base = buildDefaultTask(intent.title)
        const task = {
          ...base,
          priority: intent.priority ?? base.priority,
          status: intent.status ?? base.status,
          dueDate: intent.dueDate ?? base.dueDate,
          description: intent.description ?? base.description,
        }
        await addTask(task)
        appendMessage({
          id: `${Date.now()}`,
          role: "assistant",
          type: "result",
          status: "success",
          action: "create",
          content: `Đã tạo việc "${task.title}". Muốn đặt hạn/ưu tiên khác hoặc thêm mô tả, nhắn tiếp cho mình nhé.`,
          timestamp: new Date(),
        })
      } else if (intent.kind === "list") {
        const matched = matchTasks(tasks, intent.query)
        appendMessage({
          id: `${Date.now()}`,
          role: "assistant",
          type: "task-list",
          title: matched.length ? "Here are your tasks" : "No tasks found",
          tasks: matched,
          action: "list",
          timestamp: new Date(),
        })
      } else if (intent.kind === "delete") {
        const matched = matchTasks(tasks, intent.query)
        if (!matched.length) {
          appendMessage({
            id: `${Date.now()}`,
            role: "assistant",
            type: "text",
            content: "No matching tasks to delete.",
            timestamp: new Date(),
          })
        } else {
          setPendingDelete({ tasks: matched })
          setSelectedIds([])
          appendMessage({
            id: `${Date.now()}`,
            role: "assistant",
            type: "task-list",
            title: "Select tasks to delete, then confirm.",
            tasks: matched,
            action: "delete",
            timestamp: new Date(),
          })
        }
      } else if (intent.kind === "update") {
        const matched = matchTasks(tasks, intent.query)
        if (!matched.length) {
          appendMessage({
            id: `${Date.now()}`,
            role: "assistant",
            type: "text",
            content: "No matching tasks to update.",
            timestamp: new Date(),
          })
        } else if (matched.length === 1) {
          const target = matched[0]
          await updateTask(target.id, {
            status: intent.status ?? target.status,
            priority: intent.priority ?? target.priority,
            title: intent.title ?? target.title,
            description: intent.description ?? target.description,
            dueDate: intent.dueDate ?? target.dueDate,
          })
          appendMessage({
            id: `${Date.now()}`,
            role: "assistant",
            type: "result",
            status: "success",
            action: "update",
            content: `Updated "${intent.title ?? target.title}".`,
            timestamp: new Date(),
          })
        } else {
          appendMessage({
            id: `${Date.now()}`,
            role: "assistant",
            type: "task-list",
            title: "Multiple tasks matched, please specify more clearly.",
            tasks: matched,
            action: "list",
            timestamp: new Date(),
          })
        }
      } else {
        await sendPersistedMessage(messageToSend)
      }
    } catch (error) {
      appendMessage({
        id: `${Date.now()}`,
        role: "assistant",
        type: "text",
        content: `Something went wrong. ${error instanceof Error ? error.message : "Please try again later."}`,
        timestamp: new Date(),
      })
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">AI Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Chat with AI to manage your tasks efficiently
            </p>
          </div>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden bg-card border-border">
        <div className="flex items-center justify-between px-4 pt-4 pb-1 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Session:</span>
            <div className="flex flex-wrap gap-2">
              {sessions.slice(0, 3).map((session) => (
                <Button
                  key={session.id}
                  size="sm"
                  variant={session.id === activeSessionId ? "default" : "outline"}
                  onClick={() => selectSession(session.id)}
                  className="text-xs"
                >
                  {session.title || "Untitled"}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={createNewSession} className="text-xs">
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            disabled={!activeSessionId || !hasMore[activeSessionId]}
            onClick={() => activeSessionId && loadMessages(activeSessionId, true)}
          >
            Load older
          </Button>
        </div>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {combinedMessages.map((message) => (
            <div key={message.id} className={cn("flex gap-3", message.role === "user" ? "flex-row-reverse" : "flex-row")}>
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  message.role === "user" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground",
                )}
              >
                {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>

              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-4 py-2.5",
                  message.role === "user" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground",
                )}
              >
                {message.type === "text" && renderTextMessage(message.content)}

                {message.type === "result" && (
                  <div className="flex items-start gap-3">
                    <Circle className={cn("h-5 w-5", message.status === "success" ? "text-green-500" : "text-red-500")} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{message.content}</p>
                    </div>
                  </div>
                )}

                {message.type === "task-list" && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{message.title}</p>
                    {message.tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks found.</p>}
                    {message.tasks.map((task) => (
                      <label
                        key={task.id}
                        className={cn(
                          "flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2",
                          message.action === "delete" ? "cursor-pointer" : "cursor-default",
                        )}
                      >
                        {message.action === "delete" ? (
                          <Checkbox
                            checked={selectedIds.includes(task.id)}
                            onCheckedChange={(checked) => {
                              setSelectedIds((prev) =>
                                checked ? [...prev, task.id] : prev.filter((id) => id !== task.id),
                              )
                            }}
                          />
                        ) : (
                          <Circle className="h-3 w-3 text-muted-foreground mt-1" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {task.description || "No description"}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <PriorityBadge priority={task.priority} />
                            <span>{task.status}</span>
                          </div>
                        </div>
                      </label>
                    ))}

                    {message.action === "delete" && message.tasks.length > 0 && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleDeleteConfirm} disabled={pendingDelete === null}>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Confirm
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleDeleteCancel}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <p
                  className={cn(
                    "text-xs mt-1",
                    message.role === "user" ? "text-accent-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {(isTyping || isSending) && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-secondary rounded-lg px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {combinedMessages.length <= 1 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2">Suggested prompts:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestedPrompt(prompt)}
                  className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask anything about your tasks..."
              className="flex-1 bg-secondary border-border"
              disabled={isTyping || isSending}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isTyping || isSending}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
