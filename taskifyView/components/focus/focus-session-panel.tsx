"use client";

import { useState, useCallback } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FocusTimer } from "./focus-timer";
import { FocusMusicPlayer } from "./focus-music-player";
import { DailyGoals } from "./daily-goals";
import { BreakDialog } from "./break-dialog";
import { useFocusStore } from "@/lib/focus-store";
import { cn } from "@/lib/utils";

export function FocusSessionPanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showBreakDialog, setShowBreakDialog] = useState(false);
  const { isActive, isBreak } = useFocusStore();

  const handleBreakStart = useCallback(() => {
    setShowBreakDialog(true);
  }, []);

  return (
    <>
      <Card className={cn("w-full transition-all", !isExpanded && "py-3")}>
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-75",
                  isActive && !isBreak && "animate-ping bg-accent",
                  isBreak && "animate-ping bg-chart-2",
                )}
              />
              <span
                className={cn(
                  "relative inline-flex size-2 rounded-full",
                  isActive && !isBreak && "bg-accent",
                  isBreak && "bg-chart-2",
                  !isActive && "bg-muted-foreground/50",
                )}
              />
            </span>
            Focus Session
            {isActive && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                {isBreak ? "(Break)" : "(Active)"}
              </span>
            )}
          </CardTitle>
          <CardAction>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </Button>
          </CardAction>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-6">
            <div className="grid gap-8 lg:grid-cols-3">
              {/* Timer Section */}
              <div className="flex justify-center">
                <FocusTimer onBreakStart={handleBreakStart} />
              </div>

              {/* Music Section */}
              <div className="border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
                <FocusMusicPlayer />
              </div>

              {/* Goals Section */}
              <div className="border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
                <DailyGoals />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Break Dialog */}
      <BreakDialog open={showBreakDialog} onOpenChange={setShowBreakDialog} />
    </>
  );
}
