"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useChatSessionStore } from "@/lib/chat-session-store";

const settingTabs = [
  { value: "model", label: "Model" },
  { value: "agent", label: "Agent" },
  { value: "data-source", label: "Data Source" },
  { value: "message-channels", label: "Message Channels" },
  { value: "mcp", label: "MCP" },
  { value: "log", label: "Log" },
] as const;

const modelTabs = [
  { value: "local", label: "Local" },
  { value: "download", label: "Download" },
  { value: "cloud", label: "Cloud" },
] as const;

function ComingSoonCard({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xl">{title}</CardTitle>
        </div>
        <CardDescription>
          This section is under development and will be available soon.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-40 rounded-md border border-dashed border-border bg-muted/20" />
      </CardContent>
    </Card>
  );
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatJsonForView(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function LogTabContent() {
  const {
    sessions,
    messages,
    refreshSessions,
    loadMessages,
    activeSessionId,
    selectSession,
    isLoading,
  } = useChatSessionStore();
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!sessions.length) return;
    const preferred = activeSessionId ?? sessions[0]?.id ?? "";
    if (!preferred) return;
    setSelectedSessionId((prev) => prev || preferred);
  }, [sessions, activeSessionId]);

  useEffect(() => {
    if (!selectedSessionId) return;
    void selectSession(selectedSessionId);
    if (!messages[selectedSessionId]) {
      void loadMessages(selectedSessionId);
    }
  }, [selectedSessionId, selectSession, messages, loadMessages]);

  const selectedMessages = useMemo(
    () => (selectedSessionId ? (messages[selectedSessionId] ?? []) : []),
    [messages, selectedSessionId],
  );

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="text-xl">Conversation Log</CardTitle>
        <CardDescription>
          Human-readable logs for user and assistant messages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="h-9 min-w-[280px] rounded-md border bg-background px-3 text-sm"
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
          >
            {sessions.length === 0 && <option value="">No sessions</option>}
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title || session.id}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={() => void refreshSessions()}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>

        <div className="max-h-[560px] space-y-3 overflow-auto rounded-md border p-3">
          {selectedMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No logs to display.</p>
          ) : (
            selectedMessages.map((m) => {
              const prettyMetadata = formatJsonForView(m.metadataJson);
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`rounded-md border p-3 ${
                    isUser
                      ? "bg-blue-50/40 border-blue-100 dark:bg-blue-900/50 dark:border-blue-700"
                      : "bg-emerald-50/40 border-emerald-100 dark:bg-emerald-900/50 dark:border-emerald-700"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant="secondary">
                      {isUser ? "User" : "Assistant"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(m.sentAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {m.text}
                  </p>
                  {prettyMetadata && (
                    <pre className="mt-3 overflow-auto rounded bg-black/90 p-3 text-xs text-green-200">
                      {prettyMetadata}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure workspace-level settings and integrations
        </p>
      </div>

      <Tabs defaultValue="model" className="space-y-6">
        <TabsList className="flex w-full flex-wrap h-auto gap-1 justify-start">
          {settingTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="data-[state=active]:text-green-600 dark:data-[state=active]:bg-green-500 dark:data-[state=active]:text-white"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="model" className="space-y-4">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl">Model</CardTitle>
                <Tabs defaultValue="local">
                  <TabsList>
                    {modelTabs.map((tab) => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="data-[state=active]:text-green-600 dark:data-[state=active]:bg-green-500 dark:data-[state=active]:text-white"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <CardDescription>
                This section is under development and will be available soon.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-40 rounded-md border border-dashed border-border bg-muted/20" />
            </CardContent>
          </Card>
        </TabsContent>

        {settingTabs
          .filter((tab) => tab.value !== "model")
          .map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.value === "log" ? (
                <LogTabContent />
              ) : (
                <ComingSoonCard title={tab.label} />
              )}
            </TabsContent>
          ))}
      </Tabs>
    </div>
  );
}
