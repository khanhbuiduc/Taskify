"use client";

import { useEffect, useCallback } from "react";
import {
  Timer,
  Play,
  Pause,
  Square,
  ChevronUp,
  ChevronDown,
  Coffee,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useFocusStore, formatTime, calculateBreaks } from "@/lib/focus-store";
import { cn } from "@/lib/utils";

interface FocusTimerProps {
  onBreakStart?: () => void;
}

export function FocusTimer({ onBreakStart }: FocusTimerProps) {
  const {
    isActive,
    isPaused,
    timeRemaining,
    totalDuration,
    isBreak,
    breakCount,
    skipBreaks,
    focusDuration,
    setFocusDuration,
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    tick,
    setSkipBreaks,
    skipBreak,
  } = useFocusStore();

  // Timer tick effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && !isPaused) {
      interval = setInterval(() => {
        tick();
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, isPaused, tick]);

  // Notify parent when break starts
  useEffect(() => {
    if (isBreak && onBreakStart) {
      onBreakStart();
    }
  }, [isBreak, onBreakStart]);

  const handleDurationChange = useCallback(
    (delta: number) => {
      if (isActive) return;
      const newDuration = Math.max(5, Math.min(300, focusDuration + delta));
      setFocusDuration(newDuration);
    },
    [isActive, focusDuration, setFocusDuration],
  );

  const progress =
    totalDuration > 0
      ? ((totalDuration - timeRemaining) / totalDuration) * 100
      : 0;
  const expectedBreaks = calculateBreaks(focusDuration);

  // Calculate stroke dasharray for circular progress
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-muted-foreground">
        {isBreak ? (
          <>
            <Coffee className="size-5" />
            <span className="text-sm font-medium">Break Time</span>
          </>
        ) : (
          <>
            <Timer className="size-5" />
            <span className="text-sm font-medium">
              {isActive ? "Focus Session" : "Get ready to focus"}
            </span>
          </>
        )}
      </div>

      {/* Description */}
      {!isActive && (
        <p className="text-center text-sm text-muted-foreground max-w-xs">
          We&apos;ll help you stay focused. For longer sessions, we&apos;ll add
          short breaks so you can recharge.
        </p>
      )}

      {/* Timer Display */}
      <div className="relative">
        {/* Circular Progress */}
        <svg className="size-48 -rotate-90" viewBox="0 0 200 200">
          {/* Background circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/30"
          />
          {/* Progress circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={isActive ? strokeDashoffset : circumference}
            className={cn(
              "transition-all duration-1000",
              isBreak ? "text-chart-2" : "text-accent",
            )}
          />
        </svg>

        {/* Time Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {!isActive ? (
            /* Duration Picker */
            <div className="flex flex-col items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDurationChange(5)}
                disabled={isActive}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronUp className="size-6" />
              </Button>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-light tabular-nums">
                  {focusDuration}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">mins</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDurationChange(-5)}
                disabled={isActive}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className="size-6" />
              </Button>
            </div>
          ) : (
            /* Running Timer */
            <div className="flex flex-col items-center">
              <span className="text-4xl font-light tabular-nums">
                {formatTime(timeRemaining)}
              </span>
              <span className="text-sm text-muted-foreground mt-1">
                {isBreak ? "break" : "remaining"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Break Info */}
      {!isBreak && (
        <div className="flex flex-col items-center gap-2">
          {!isActive && expectedBreaks > 0 && (
            <span className="text-sm text-muted-foreground">
              You&apos;ll have {expectedBreaks} break
              {expectedBreaks > 1 ? "s" : ""}
            </span>
          )}
          {isActive && (
            <span className="text-sm text-muted-foreground">
              Breaks taken: {breakCount}
            </span>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={skipBreaks}
              onCheckedChange={(checked) => setSkipBreaks(checked === true)}
            />
            <span className="text-sm text-muted-foreground">Skip breaks</span>
          </label>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        {!isActive ? (
          <Button onClick={startSession} className="gap-2">
            <Play className="size-4" />
            Start focus session
          </Button>
        ) : isBreak ? (
          <Button onClick={skipBreak} variant="secondary" className="gap-2">
            <Play className="size-4" />
            Skip break
          </Button>
        ) : (
          <>
            {isPaused ? (
              <Button onClick={resumeSession} className="gap-2">
                <Play className="size-4" />
                Resume
              </Button>
            ) : (
              <Button
                onClick={pauseSession}
                variant="secondary"
                className="gap-2"
              >
                <Pause className="size-4" />
                Pause
              </Button>
            )}
            <Button onClick={endSession} variant="outline" size="icon">
              <Square className="size-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
