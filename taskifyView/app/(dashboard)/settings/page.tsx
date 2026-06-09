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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useChatSessionStore } from "@/lib/chat-session-store";
import { geminiSettingsApi } from "@/lib/api/geminiSettingsApi";
import { aiFallbackApi } from "@/lib/api/aiFallbackApi";
import { ApiError } from "@/lib/api/taskApi";
import {
  formatConfidence,
  parseChatLogMetadata,
} from "@/components/javis/chat-utils";
import type {
  AiFallbackSettingsResponse,
  AiProvider,
  GeminiCredentialStatus,
  GeminiCredentialStatusResponse,
  OllamaModelSummary,
} from "@/lib/types";

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

const emptyGeminiStatus: GeminiCredentialStatusResponse = {
  configured: false,
  status: "NotConfigured",
  lastValidatedAtUtc: null,
  lastValidationError: null,
};

const emptyFallbackSettings: AiFallbackSettingsResponse = {
  activeProvider: null,
  gemini: emptyGeminiStatus,
  ollama: {
    configured: false,
    baseUrl: null,
    model: null,
    lastValidatedAtUtc: null,
    lastValidationError: null,
  },
};

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

function formatGeminiStatusLabel(status: GeminiCredentialStatus): string {
  switch (status) {
    case "Valid":
      return "Connected";
    case "Invalid":
      return "Invalid";
    case "ValidationFailed":
      return "Validation failed";
    default:
      return "Not configured";
  }
}

function formatGeminiStatusClass(status: GeminiCredentialStatus): string {
  switch (status) {
    case "Valid":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
    case "Invalid":
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
    case "ValidationFailed":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300";
  }
}

function formatStatusTimestamp(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatProviderLabel(provider: AiProvider | null): string {
  if (!provider) {
    return "No active provider";
  }

  return provider === "Gemini" ? "Gemini" : "Ollama";
}

function formatProviderClass(provider: AiProvider | null): string {
  if (provider === "Gemini") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  }

  if (provider === "Ollama") {
    return "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300";
  }

  return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300";
}

function FallbackProviderSettingsCard() {
  const [settings, setSettings] = useState<AiFallbackSettingsResponse>(emptyFallbackSettings);
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>("Gemini");
  const [geminiDraftKey, setGeminiDraftKey] = useState("");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("");
  const [ollamaSelectedModel, setOllamaSelectedModel] = useState("");
  const [ollamaModels, setOllamaModels] = useState<OllamaModelSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingGemini, setIsSavingGemini] = useState(false);
  const [isDeletingGemini, setIsDeletingGemini] = useState(false);
  const [isLoadingOllamaModels, setIsLoadingOllamaModels] = useState(false);
  const [isSavingOllama, setIsSavingOllama] = useState(false);
  const [isDeletingOllama, setIsDeletingOllama] = useState(false);
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const syncSettings = (nextSettings: AiFallbackSettingsResponse) => {
    setSettings(nextSettings);
    setSelectedProvider(nextSettings.activeProvider ?? "Gemini");
    setOllamaBaseUrl(nextSettings.ollama.baseUrl ?? "");
    setOllamaSelectedModel(nextSettings.ollama.model ?? "");
  };

  useEffect(() => {
    let isMounted = true;

    const loadStatus = async () => {
      setIsLoading(true);
      try {
        const nextSettings = await aiFallbackApi.getSettings();
        if (isMounted) {
          syncSettings(nextSettings);
          setSubmitError(null);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof ApiError ? error.message : "Failed to load Gemini status.";
        setSubmitError(message);
        toast.error(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const ollamaModelOptions = useMemo(() => {
    const map = new Map<string, OllamaModelSummary>();
    for (const model of ollamaModels) {
      map.set(model.name, model);
    }
    if (ollamaSelectedModel && !map.has(ollamaSelectedModel)) {
      map.set(ollamaSelectedModel, { name: ollamaSelectedModel });
    }
    return [...map.values()];
  }, [ollamaModels, ollamaSelectedModel]);

  const handleSaveGemini = async () => {
    const normalizedKey = geminiDraftKey.trim();
    if (!normalizedKey) {
      setSubmitError("Gemini API key is required.");
      return;
    }

    setIsSavingGemini(true);
    setSubmitError(null);
    try {
      await geminiSettingsApi.save(normalizedKey);
      const nextSettings = await aiFallbackApi.getSettings();
      syncSettings(nextSettings);
      setGeminiDraftKey("");
      toast.success("Gemini API key saved successfully.");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to save Gemini API key.";
      setSubmitError(message);
      setSettings((current) => ({
        ...current,
        gemini: {
          ...current.gemini,
          status:
            error instanceof ApiError && error.status === 400
              ? "Invalid"
              : "ValidationFailed",
          lastValidationError: message,
        },
      }));
      toast.error(message);
    } finally {
      setIsSavingGemini(false);
    }
  };

  const handleDeleteGemini = async () => {
    setIsDeletingGemini(true);
    setSubmitError(null);
    try {
      await geminiSettingsApi.remove();
      const nextSettings = await aiFallbackApi.getSettings();
      syncSettings(nextSettings);
      setGeminiDraftKey("");
      toast.success("Gemini API key removed.");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to remove Gemini API key.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsDeletingGemini(false);
    }
  };

  const handleLoadOllamaModels = async () => {
    const normalizedUrl = ollamaBaseUrl.trim();
    if (!normalizedUrl) {
      setSubmitError("Ollama URL is required to load models.");
      return;
    }

    setIsLoadingOllamaModels(true);
    setSubmitError(null);
    try {
      const models = await aiFallbackApi.loadOllamaModels(normalizedUrl);
      setOllamaModels(models);
      if (models.length > 0 && !models.some((model) => model.name === ollamaSelectedModel)) {
        setOllamaSelectedModel(models[0].name);
      }
      toast.success(`Loaded ${models.length} Ollama model(s).`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to load Ollama models.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsLoadingOllamaModels(false);
    }
  };

  const handleSaveOllama = async () => {
    const normalizedUrl = ollamaBaseUrl.trim();
    const normalizedModel = ollamaSelectedModel.trim();
    if (!normalizedUrl || !normalizedModel) {
      setSubmitError("Both Ollama URL and model are required.");
      return;
    }

    setIsSavingOllama(true);
    setSubmitError(null);
    try {
      const nextSettings = await aiFallbackApi.saveOllamaSettings(normalizedUrl, normalizedModel);
      syncSettings(nextSettings);
      toast.success("Ollama configuration saved successfully.");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to save Ollama configuration.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSavingOllama(false);
    }
  };

  const handleDeleteOllama = async () => {
    setIsDeletingOllama(true);
    setSubmitError(null);
    try {
      const nextSettings = await aiFallbackApi.deleteOllamaSettings();
      syncSettings(nextSettings);
      setOllamaModels([]);
      toast.success("Ollama configuration removed.");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to remove Ollama configuration.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsDeletingOllama(false);
    }
  };

  const handleSaveProvider = async () => {
    setIsSavingProvider(true);
    setSubmitError(null);
    try {
      const nextSettings = await aiFallbackApi.saveActiveProvider(selectedProvider);
      syncSettings(nextSettings);
      toast.success(`Active fallback provider set to ${selectedProvider}.`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to update active provider.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSavingProvider(false);
    }
  };

  const geminiValidatedAt = formatStatusTimestamp(settings.gemini.lastValidatedAtUtc);
  const ollamaValidatedAt = formatStatusTimestamp(settings.ollama.lastValidatedAtUtc);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              Fallback Provider
            </CardTitle>
            <CardDescription>
              Choose which AI provider handles Rasa fallback for this account. Gemini keeps cloud fallback, while Ollama uses a model running on your local or custom server.
            </CardDescription>
          </div>
          <Badge className={formatProviderClass(settings.activeProvider)}>
            {formatProviderLabel(settings.activeProvider)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="active-fallback-provider">Active provider</Label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              id="active-fallback-provider"
              className="h-10 min-w-[220px] rounded-md border bg-background px-3 text-sm"
              value={selectedProvider}
              onChange={(event) => setSelectedProvider(event.target.value as AiProvider)}
              disabled={isLoading || isSavingProvider}
            >
              <option value="Gemini">Gemini</option>
              <option value="Ollama">Ollama</option>
            </select>
            <Button
              onClick={() => void handleSaveProvider()}
              disabled={isLoading || isSavingProvider || selectedProvider === settings.activeProvider}
            >
              {isSavingProvider ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Set active provider"
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            The selected provider is used only when chat falls into Rasa `nlu_fallback`.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-md border bg-muted/20 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Gemini</p>
                <p className="text-sm text-muted-foreground">
                  Cloud fallback using a per-user encrypted API key.
                </p>
              </div>
              <Badge className={formatGeminiStatusClass(settings.gemini.status)}>
                {formatGeminiStatusLabel(settings.gemini.status)}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gemini-api-key">Gemini API key</Label>
              <Input
                id="gemini-api-key"
                type="password"
                value={geminiDraftKey}
                placeholder="Paste your Gemini API key"
                onChange={(event) => setGeminiDraftKey(event.target.value)}
                disabled={isLoading || isSavingGemini || isDeletingGemini}
                autoComplete="off"
              />
              <p className="text-sm text-muted-foreground">
                Frontend only keeps this value in the current form state until you save it.
              </p>
            </div>

            <div className="rounded-md border bg-background p-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                {settings.gemini.configured
                  ? "A Gemini key is configured for this account."
                  : "No Gemini key is configured for this account yet."}
              </p>
              {geminiValidatedAt && (
                <p className="text-sm text-muted-foreground">
                  Last validated: {geminiValidatedAt}
                </p>
              )}
              {settings.gemini.lastValidationError && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {settings.gemini.lastValidationError}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => void handleSaveGemini()}
                disabled={isLoading || isSavingGemini || isDeletingGemini || geminiDraftKey.trim().length === 0}
              >
                {isSavingGemini ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Gemini key"
                )}
              </Button>
              {settings.gemini.configured && (
                <Button
                  variant="outline"
                  onClick={() => void handleDeleteGemini()}
                  disabled={isLoading || isSavingGemini || isDeletingGemini}
                >
                  {isDeletingGemini ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    "Remove Gemini key"
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Ollama</p>
                <p className="text-sm text-muted-foreground">
                  Local or custom Ollama endpoint with runtime model discovery.
                </p>
              </div>
              <Badge className={formatProviderClass(settings.activeProvider === "Ollama" ? "Ollama" : null)}>
                {settings.ollama.configured ? "Configured" : "Not configured"}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ollama-base-url">Ollama URL</Label>
              <div className="flex flex-wrap gap-3">
                <Input
                  id="ollama-base-url"
                  value={ollamaBaseUrl}
                  placeholder="http://localhost:11434"
                  onChange={(event) => setOllamaBaseUrl(event.target.value)}
                  disabled={isLoading || isLoadingOllamaModels || isSavingOllama || isDeletingOllama}
                />
                <Button
                  variant="outline"
                  onClick={() => void handleLoadOllamaModels()}
                  disabled={isLoading || isLoadingOllamaModels || isSavingOllama || isDeletingOllama || ollamaBaseUrl.trim().length === 0}
                >
                  {isLoadingOllamaModels ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load models"
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ollama-model">Ollama model</Label>
              <select
                id="ollama-model"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={ollamaSelectedModel}
                onChange={(event) => setOllamaSelectedModel(event.target.value)}
                disabled={isLoading || isSavingOllama || isDeletingOllama}
              >
                <option value="">Select a model</option>
                {ollamaModelOptions.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                    {model.parameterSize ? ` - ${model.parameterSize}` : ""}
                  </option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground">
                Load models from the configured Ollama URL, then choose which model handles fallback.
              </p>
            </div>

            <div className="rounded-md border bg-background p-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                {settings.ollama.configured
                  ? `Configured at ${settings.ollama.baseUrl} using model ${settings.ollama.model}.`
                  : "No Ollama configuration is saved for this account yet."}
              </p>
              {ollamaValidatedAt && (
                <p className="text-sm text-muted-foreground">
                  Last validated: {ollamaValidatedAt}
                </p>
              )}
              {settings.ollama.lastValidationError && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {settings.ollama.lastValidationError}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => void handleSaveOllama()}
                disabled={isLoading || isSavingOllama || isDeletingOllama || ollamaBaseUrl.trim().length === 0 || ollamaSelectedModel.trim().length === 0}
              >
                {isSavingOllama ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Ollama config"
                )}
              </Button>
              {settings.ollama.configured && (
                <Button
                  variant="outline"
                  onClick={() => void handleDeleteOllama()}
                  disabled={isLoading || isSavingOllama || isDeletingOllama}
                >
                  {isDeletingOllama ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    "Remove Ollama config"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {submitError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {submitError}
          </div>
        )}
      </CardContent>
    </Card>
  );
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
              const chatLogMetadata = isUser ? parseChatLogMetadata(m.metadataJson) : null;
              const topIntents = (chatLogMetadata?.intentRanking ?? []).slice(0, 3);
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
                  {isUser && topIntents.length > 0 && (
                    <div className="mt-3 rounded-md border border-sky-200/70 bg-sky-50/70 p-3 dark:border-sky-700 dark:bg-sky-950/30">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                          Intent Top 3
                        </span>
                        {chatLogMetadata?.intent && (
                          <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
                            Best: {chatLogMetadata.intent.name} {formatConfidence(chatLogMetadata.intent.confidence)}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {topIntents.map((intent, index) => (
                          <Badge
                            key={`${m.id}-${intent.name}-${index}`}
                            variant="outline"
                            className="border-sky-300/80 bg-white/70 text-sky-800 dark:border-sky-700 dark:bg-sky-950/20 dark:text-sky-200"
                          >
                            #{index + 1} {intent.name} {formatConfidence(intent.confidence)}
                          </Badge>
                        ))}
                      </div>
                      {chatLogMetadata?.normalizedMessage &&
                        chatLogMetadata.normalizedMessage !== m.text && (
                          <p className="mt-2 text-xs text-sky-700/80 dark:text-sky-300/80">
                            Parsed text: {chatLogMetadata.normalizedMessage}
                          </p>
                        )}
                    </div>
                  )}
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
          <Tabs defaultValue="cloud" className="space-y-4">
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
            <TabsContent value="local">
              <ComingSoonCard title="Local Model" />
            </TabsContent>
            <TabsContent value="download">
              <ComingSoonCard title="Model Download" />
            </TabsContent>
            <TabsContent value="cloud">
              <FallbackProviderSettingsCard />
            </TabsContent>
          </Tabs>
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
