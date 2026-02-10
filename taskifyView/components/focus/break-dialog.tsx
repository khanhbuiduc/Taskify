"use client";

import { Coffee, Play, SkipForward } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFocusStore, formatTime } from "@/lib/focus-store";

interface BreakDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BreakDialog({ open, onOpenChange }: BreakDialogProps) {
  const { breakDuration, timeRemaining, isBreak, skipBreak, resumeSession } =
    useFocusStore();

  const handleSkipBreak = () => {
    skipBreak();
    onOpenChange(false);
  };

  const handleTakeBreak = () => {
    // Break is already started, just close dialog
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 size-16 rounded-full bg-chart-2/20 flex items-center justify-center">
            <Coffee className="size-8 text-chart-2" />
          </div>
          <DialogTitle className="text-xl">Time for a break!</DialogTitle>
          <DialogDescription className="text-center">
            You&apos;ve been focusing hard. Take a {breakDuration}-minute break
            to recharge.
            {isBreak && (
              <span className="block mt-2 text-lg font-medium text-foreground">
                {formatTime(timeRemaining)} remaining
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">
              Break suggestions:
            </p>
            <ul className="space-y-1">
              <li>• Stretch your body</li>
              <li>• Rest your eyes - look at something far away</li>
              <li>• Get some water</li>
              <li>• Take a short walk</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-center">
          <Button variant="outline" onClick={handleSkipBreak} className="gap-2">
            <SkipForward className="size-4" />
            Skip break
          </Button>
          <Button onClick={handleTakeBreak} className="gap-2">
            <Play className="size-4" />
            Take break
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
