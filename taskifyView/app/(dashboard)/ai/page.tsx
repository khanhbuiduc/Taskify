"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Sparkles, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { sendChatMessage } from "@/lib/api/chatApi"
import { PriorityBadge } from "@/components/task-ui/priority-badge"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

const suggestedPrompts = [
  "What tasks are overdue?",
  "Summarize my week",
  "Help me prioritize tasks",
  "Create a new task for tomorrow",
]

const renderMessageContent = (content: string) => {
  const taskRegex = /✅\s*Đã tạo task:\s*\*\*(.*?)\*\*(?:.*?Độ ưu tiên:\s*([^\n]+))?/i;
  const match = content.match(taskRegex);

  if (match) {
    const title = match[1].trim();
    const priorityRaw = match[2]?.trim() || '';
    
    let priority: "low" | "medium" | "high" = "medium";
    if (priorityRaw.toLowerCase().includes("cao")) priority = "high";
    if (priorityRaw.toLowerCase().includes("thấp")) priority = "low";
    if (priorityRaw.toLowerCase().includes("trung bình")) priority = "medium";
    
    return (
      <div className="flex flex-col gap-2 min-w-[240px] max-w-sm w-full mt-1 mb-1">
        <p className="text-sm font-medium">✅ Đã tạo task</p>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm text-foreground">
          <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="flex-1 font-medium truncate text-sm">
             {title}
          </p>
          <PriorityBadge priority={priority} />
        </div>
      </div>
    );
  }

  return <p className="text-sm leading-relaxed">{content}</p>;
}

export default function AILayoutPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello! I'm your AI assistant for Taskify. I can help you manage tasks, analyze your productivity, and answer questions about your projects. How can I help you today?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const messageToSend = input
    setInput("")
    setIsTyping(true)

    try {
      const { messages: replyMessages } = await sendChatMessage(messageToSend)
      const now = Date.now()
      const assistantMessages: Message[] = (replyMessages?.length
        ? replyMessages
        : [{ text: "The assistant is temporarily unavailable. Please try again later." }]
      ).map((m, i) => ({
        id: `${now + i}`,
        role: "assistant" as const,
        content: typeof m === "string" ? m : (m?.text ?? ""),
        timestamp: new Date(),
      }))
      setMessages((prev) => [...prev, ...assistantMessages])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          role: "assistant",
          content: "Something went wrong. Please try again later.",
          timestamp: new Date(),
        },
      ])
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
      {/* Header */}
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

      {/* Chat Container */}
      <Card className="flex-1 flex flex-col overflow-hidden bg-card border-border">
        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  message.role === "user"
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-secondary-foreground"
                )}
              >
                {message.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-4 py-2.5",
                  message.role === "user"
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-secondary-foreground"
                )}
              >
                {renderMessageContent(message.content)}
                <p
                  className={cn(
                    "text-xs mt-1",
                    message.role === "user"
                      ? "text-accent-foreground/70"
                      : "text-muted-foreground"
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

          {isTyping && (
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

        {/* Suggested Prompts */}
        {messages.length === 1 && (
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

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask anything about your tasks..."
              className="flex-1 bg-secondary border-border"
              disabled={isTyping}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
