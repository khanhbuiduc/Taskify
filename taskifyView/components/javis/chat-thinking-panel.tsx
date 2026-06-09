"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatConfidence, type ThinkingTraceViewModel } from "./chat-utils";

interface ChatThinkingPanelProps {
  trace: ThinkingTraceViewModel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StepCard({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/80 p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
          {index}
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function EntityDetailCard({
  entity,
  value,
  start,
  end,
  confidence,
}: {
  entity: string;
  value: string;
  start: number;
  end: number;
  confidence: number;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-background/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono text-[11px] uppercase">
          {entity}
        </Badge>
        <Badge variant="secondary" className="text-[11px]">
          {formatConfidence(confidence)}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Span {start}-{end}
        </span>
      </div>
      <p className="mt-2 break-words rounded-sm bg-muted/40 px-2 py-1 font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}

function PanelBody({
  trace,
  onClose,
}: {
  trace: ThinkingTraceViewModel;
  onClose: () => void;
}) {
  const normalizedMessage =
    trace.normalizedMessage && trace.normalizedMessage !== trace.userMessage
      ? trace.normalizedMessage
      : null;
  const entities = trace.geminiEntityExtraction?.entities ?? [];
  const topIntents = trace.intentRanking.slice(0, 3);
  const hasAnalysisData =
    Boolean(normalizedMessage) ||
    Boolean(trace.intent) ||
    topIntents.length > 0 ||
    entities.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">
              Luồng xử lý
            </h2>
            <p className="text-sm text-muted-foreground">
              Giải thích cách Taskify tạo ra phản hồi này.
            </p>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onClose}
            aria-label="Đóng luồng xử lý"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            Đã suy nghĩ trong {trace.thinkingDurationSeconds}s
          </Badge>
          <Badge variant="outline">{trace.result.resultLabel}</Badge>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-4">
          <StepCard index={1} title="Yêu cầu gốc">
            <p className="whitespace-pre-wrap break-words text-foreground">
              {trace.userMessage}
            </p>
          </StepCard>

          <StepCard index={2} title="Chuẩn hoá câu hỏi">
            {normalizedMessage ? (
              <p className="whitespace-pre-wrap break-words text-foreground">
                {normalizedMessage}
              </p>
            ) : (
              <p>Hệ thống giữ nguyên câu hỏi vì không cần chuẩn hoá thêm.</p>
            )}
          </StepCard>

          <StepCard index={3} title="Nhận diện ý định">
            {trace.intent ? (
              <div className="space-y-2">
                <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
                  Best: {trace.intent.name}{" "}
                  {formatConfidence(trace.intent.confidence)}
                </Badge>
                {topIntents.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {topIntents.map((intent, index) => (
                      <Badge
                        key={`${intent.name}-${index}`}
                        variant="outline"
                        className="border-sky-300/80 bg-white/70 text-sky-800 dark:border-sky-700 dark:bg-sky-950/20 dark:text-sky-200"
                      >
                        #{index + 1} {intent.name}{" "}
                        {formatConfidence(intent.confidence)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p>Không có dữ liệu intent chi tiết cho lượt hỏi đáp này.</p>
            )}
          </StepCard>

          <StepCard index={4} title="Entity đã nhận diện">
            {entities.length > 0 ? (
              <div className="space-y-2">
                <div className="rounded-md border border-emerald-200/70 bg-emerald-50/60 p-3 dark:border-emerald-900/70 dark:bg-emerald-950/20">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Gemini Extraction
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>
                      Provider:{" "}
                      <span className="font-medium text-foreground">
                        {trace.geminiEntityExtraction?.provider}
                      </span>
                    </span>
                    <span>
                      Schema:{" "}
                      <span className="font-medium text-foreground">
                        {trace.geminiEntityExtraction?.schemaVersion}
                      </span>
                    </span>
                    <span>
                      Count:{" "}
                      <span className="font-medium text-foreground">
                        {entities.length}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {entities.map((entity, index) => (
                    <Badge
                      key={`${entity.entity}-${entity.value}-${index}`}
                      variant="outline"
                    >
                      {entity.entity}: {entity.value}{" "}
                      {formatConfidence(entity.confidence)}
                    </Badge>
                  ))}
                </div>
                <div className="space-y-2">
                  {entities.map((entity, index) => (
                    <EntityDetailCard
                      key={`${entity.entity}-${entity.value}-${index}-detail`}
                      entity={entity.entity}
                      value={entity.value}
                      start={entity.start}
                      end={entity.end}
                      confidence={entity.confidence}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p>Không có entity nào được trích xuất rõ ràng.</p>
            )}
          </StepCard>

          <StepCard index={5} title="Hành động được chọn">
            <p className="font-medium text-foreground">
              {trace.result.actionLabel}
            </p>
            <p>Loại kết quả: {trace.result.kind}</p>
          </StepCard>

          <StepCard index={6} title="Kết quả trả về">
            <p className="font-medium text-foreground">
              {trace.result.resultLabel}
            </p>
            <p className="whitespace-pre-wrap break-words">
              {trace.result.summary}
            </p>
          </StepCard>

          {!hasAnalysisData && (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
              Chưa có thêm dữ liệu phân tích cho lượt này. Panel vẫn đang hiển
              thị thời gian xử lý và kết quả nghiệp vụ tối thiểu.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function ChatThinkingPanel({
  trace,
  open,
  onOpenChange,
}: ChatThinkingPanelProps) {
  const isMobile = useIsMobile();

  if (!trace) return null;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Luồng xử lý</SheetTitle>
            <SheetDescription>
              Giải thích cách Taskify tạo ra phản hồi này.
            </SheetDescription>
          </SheetHeader>
          <PanelBody trace={trace} onClose={() => onOpenChange(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <aside className="hidden h-full w-[360px] shrink-0 overflow-hidden rounded-lg border border-border/70 bg-background md:flex">
      <PanelBody trace={trace} onClose={() => onOpenChange(false)} />
    </aside>
  );
}
