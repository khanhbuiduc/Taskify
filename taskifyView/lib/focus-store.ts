"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";

export interface DailyGoal {
  id: string;
  title: string;
  isCompleted: boolean;
  createdAt: string;
}

interface FocusStore {
  // Timer state
  isActive: boolean;
  isPaused: boolean;
  timeRemaining: number; // in seconds
  totalDuration: number; // in seconds
  isBreak: boolean;
  breakCount: number;
  skipBreaks: boolean;
  sessionStartTime: number | null;

  // Daily goals
  dailyGoals: DailyGoal[];

  // Settings
  focusDuration: number; // in minutes
  breakDuration: number; // in minutes
  breakInterval: number; // focus time before break (in minutes)

  // Timer actions
  setFocusDuration: (minutes: number) => void;
  startSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
  tick: () => void;
  startBreak: () => void;
  skipBreak: () => void;
  setSkipBreaks: (skip: boolean) => void;

  // Daily goals actions
  addGoal: (title: string) => void;
  toggleGoal: (id: string) => void;
  deleteGoal: (id: string) => void;
  clearCompletedGoals: () => void;

  // Reset
  reset: () => void;
}

const DEFAULT_FOCUS_DURATION = 25; // 25 minutes
const DEFAULT_BREAK_DURATION = 5; // 5 minutes
const DEFAULT_BREAK_INTERVAL = 25; // break every 25 minutes

export const useFocusStore = create<FocusStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isActive: false,
      isPaused: false,
      timeRemaining: DEFAULT_FOCUS_DURATION * 60,
      totalDuration: DEFAULT_FOCUS_DURATION * 60,
      isBreak: false,
      breakCount: 0,
      skipBreaks: false,
      sessionStartTime: null,
      dailyGoals: [],
      focusDuration: DEFAULT_FOCUS_DURATION,
      breakDuration: DEFAULT_BREAK_DURATION,
      breakInterval: DEFAULT_BREAK_INTERVAL,

      setFocusDuration: (minutes) => {
        const seconds = minutes * 60;
        set({
          focusDuration: minutes,
          timeRemaining: seconds,
          totalDuration: seconds,
        });
      },

      startSession: () => {
        const { focusDuration } = get();
        const totalSeconds = focusDuration * 60;
        set({
          isActive: true,
          isPaused: false,
          timeRemaining: totalSeconds,
          totalDuration: totalSeconds,
          isBreak: false,
          sessionStartTime: Date.now(),
        });
        toast.success("Focus session started! Stay focused 🎯");
      },

      pauseSession: () => {
        set({ isPaused: true });
      },

      resumeSession: () => {
        set({ isPaused: false });
      },

      endSession: () => {
        const { isBreak, breakCount } = get();
        set({
          isActive: false,
          isPaused: false,
          timeRemaining: get().focusDuration * 60,
          totalDuration: get().focusDuration * 60,
          isBreak: false,
          sessionStartTime: null,
        });
        if (!isBreak) {
          toast.success(`Session ended! You took ${breakCount} break(s) 🎉`);
        }
        set({ breakCount: 0 });
      },

      tick: () => {
        const {
          timeRemaining,
          isActive,
          isPaused,
          isBreak,
          skipBreaks,
          breakDuration,
          focusDuration,
        } = get();

        if (!isActive || isPaused) return;

        if (timeRemaining <= 1) {
          if (isBreak) {
            // Break ended, resume focus
            set({
              isBreak: false,
              timeRemaining: focusDuration * 60,
              totalDuration: focusDuration * 60,
            });
            toast.info("Break ended! Back to focus 💪");
          } else {
            // Focus period ended
            if (skipBreaks) {
              // Continue with new focus session
              set({
                timeRemaining: focusDuration * 60,
                totalDuration: focusDuration * 60,
              });
              toast.success("Focus period complete! Starting new cycle ✨");
            } else {
              // Start break
              set({
                isBreak: true,
                timeRemaining: breakDuration * 60,
                totalDuration: breakDuration * 60,
                breakCount: get().breakCount + 1,
              });
              toast.info("Time for a break! ☕");
            }
          }
        } else {
          set({ timeRemaining: timeRemaining - 1 });
        }
      },

      startBreak: () => {
        const { breakDuration } = get();
        set({
          isBreak: true,
          timeRemaining: breakDuration * 60,
          totalDuration: breakDuration * 60,
          breakCount: get().breakCount + 1,
        });
        toast.info("Break started! Relax for a bit ☕");
      },

      skipBreak: () => {
        const { focusDuration } = get();
        set({
          isBreak: false,
          timeRemaining: focusDuration * 60,
          totalDuration: focusDuration * 60,
        });
        toast.info("Break skipped! Back to focus 💪");
      },

      setSkipBreaks: (skip) => {
        set({ skipBreaks: skip });
      },

      // Daily goals
      addGoal: (title) => {
        const newGoal: DailyGoal = {
          id: `goal-${Date.now()}`,
          title,
          isCompleted: false,
          createdAt: new Date().toISOString(),
        };
        set({ dailyGoals: [...get().dailyGoals, newGoal] });
        toast.success("Goal added!");
      },

      toggleGoal: (id) => {
        set({
          dailyGoals: get().dailyGoals.map((goal) =>
            goal.id === id ? { ...goal, isCompleted: !goal.isCompleted } : goal,
          ),
        });
      },

      deleteGoal: (id) => {
        set({
          dailyGoals: get().dailyGoals.filter((goal) => goal.id !== id),
        });
      },

      clearCompletedGoals: () => {
        set({
          dailyGoals: get().dailyGoals.filter((goal) => !goal.isCompleted),
        });
        toast.success("Completed goals cleared!");
      },

      reset: () => {
        set({
          isActive: false,
          isPaused: false,
          timeRemaining: DEFAULT_FOCUS_DURATION * 60,
          totalDuration: DEFAULT_FOCUS_DURATION * 60,
          isBreak: false,
          breakCount: 0,
          skipBreaks: false,
          sessionStartTime: null,
          focusDuration: DEFAULT_FOCUS_DURATION,
          breakDuration: DEFAULT_BREAK_DURATION,
          breakInterval: DEFAULT_BREAK_INTERVAL,
        });
      },
    }),
    {
      name: "focus-session-storage",
      partialize: (state) => ({
        dailyGoals: state.dailyGoals,
        focusDuration: state.focusDuration,
        breakDuration: state.breakDuration,
        skipBreaks: state.skipBreaks,
      }),
    },
  ),
);

// Helper function to format time
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Calculate expected breaks for a duration
export function calculateBreaks(
  durationMinutes: number,
  breakIntervalMinutes: number = 25,
): number {
  return Math.floor(durationMinutes / breakIntervalMinutes);
}
