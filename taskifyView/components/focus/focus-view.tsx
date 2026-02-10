"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FocusTimer } from "./focus-timer";
import { FocusMusicPlayer } from "./focus-music-player";
import { DailyGoals } from "./daily-goals";
import { BreakDialog } from "./break-dialog";
import { useFocusStore } from "@/lib/focus-store";
import { cn } from "@/lib/utils";

export function FocusView() {
  const [showBreakDialog, setShowBreakDialog] = useState(false);
  const { isActive, isBreak } = useFocusStore();

  const handleBreakStart = useCallback(() => {
    setShowBreakDialog(true);
  }, []);

  return (
    <>
      <div className="space-y-6">
        {/* Focus Timer Card */}
        <Card>
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
              Focus Timer
              {isActive && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  {isBreak ? "(Break)" : "(Active)"}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <FocusTimer onBreakStart={handleBreakStart} />
            </div>
          </CardContent>
        </Card>

        {/* Music and Daily Goals Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Music Card */}
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>Background Music</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <FocusMusicPlayer />
            </CardContent>
          </Card>

          {/* Daily Goals Card */}
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>Today&apos;s Tasks</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <DailyGoals />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Break Dialog */}
      <BreakDialog open={showBreakDialog} onOpenChange={setShowBreakDialog} />
    </>
  );
}
