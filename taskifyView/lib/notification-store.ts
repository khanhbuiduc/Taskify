"use client";

import { create } from "zustand";

// ============================================================================
// Types
// ============================================================================

export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "task";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  taskId?: string; // Optional link to a task
}

export type SoundType = "default" | "chime" | "bell" | "subtle";

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  volume: number; // 0-100
  soundType: SoundType;
  showBrowserNotifications: boolean;
}

// ============================================================================
// LocalStorage helpers
// ============================================================================

const SETTINGS_KEY = "taskify_notification_settings";
const NOTIFICATIONS_KEY = "taskify_notifications";

const defaultSettings: NotificationSettings = {
  enabled: true,
  soundEnabled: true,
  volume: 70,
  soundType: "default",
  showBrowserNotifications: false,
};

export const notificationSettingsStorage = {
  get: (): NotificationSettings => {
    if (typeof window === "undefined") return defaultSettings;
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      return stored
        ? { ...defaultSettings, ...JSON.parse(stored) }
        : defaultSettings;
    } catch {
      return defaultSettings;
    }
  },
  set: (settings: NotificationSettings) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },
};

export const notificationListStorage = {
  get: (): Notification[] => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },
  set: (notifications: Notification[]) => {
    if (typeof window === "undefined") return;
    // Keep only the last 50 notifications
    const limited = notifications.slice(0, 50);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(limited));
  },
};

// ============================================================================
// Sound player (using Web Audio API for generated sounds)
// ============================================================================

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
  }
  return audioContext;
};

// Sound configurations for different notification types
interface SoundConfig {
  frequencies: number[];
  durations: number[];
  type: OscillatorType;
}

const soundConfigs: Record<SoundType, SoundConfig> = {
  default: {
    frequencies: [523.25, 659.25, 783.99], // C5, E5, G5 (C major chord arpeggio)
    durations: [0.1, 0.1, 0.15],
    type: "sine",
  },
  chime: {
    frequencies: [880, 1108.73, 1318.51], // A5, C#6, E6
    durations: [0.15, 0.15, 0.2],
    type: "triangle",
  },
  bell: {
    frequencies: [698.46, 880], // F5, A5
    durations: [0.2, 0.3],
    type: "sine",
  },
  subtle: {
    frequencies: [440], // A4 (just a simple tone)
    durations: [0.1],
    type: "sine",
  },
};

const playTone = (
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType,
): void => {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);

  // Envelope: attack, sustain, release
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume * 0.3, startTime + 0.02); // Attack
  gainNode.gain.linearRampToValueAtTime(
    volume * 0.2,
    startTime + duration - 0.05,
  ); // Sustain
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration); // Release

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
};

export const playNotificationSound = async (
  settings: NotificationSettings,
): Promise<void> => {
  if (!settings.soundEnabled || settings.volume === 0) return;
  if (typeof window === "undefined") return;

  try {
    const ctx = getAudioContext();

    // Resume audio context if suspended (browser autoplay policy)
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const config = soundConfigs[settings.soundType];
    const volume = settings.volume / 100;
    let currentTime = ctx.currentTime;

    // Play each note in sequence
    config.frequencies.forEach((freq, index) => {
      playTone(
        ctx,
        freq,
        currentTime,
        config.durations[index],
        volume,
        config.type,
      );
      currentTime += config.durations[index] * 0.7; // Slight overlap
    });
  } catch (error) {
    console.warn("Failed to play notification sound:", error);
  }
};

// ============================================================================
// Browser Notifications
// ============================================================================

export const requestBrowserNotificationPermission =
  async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("Notification" in window))
      return false;

    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;

    const permission = await Notification.requestPermission();
    return permission === "granted";
  };

export const showBrowserNotification = (
  title: string,
  message: string,
): void => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  new Notification(title, {
    body: message,
    icon: "/favicon.ico",
  });
};

// ============================================================================
// Store
// ============================================================================

interface NotificationStore {
  notifications: Notification[];
  settings: NotificationSettings;
  isInitialized: boolean;
  unreadCount: number;

  // Actions
  initialize: () => void;
  addNotification: (
    notification: Omit<Notification, "id" | "createdAt" | "read">,
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  testSound: () => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  settings: defaultSettings,
  isInitialized: false,
  unreadCount: 0,

  initialize: () => {
    if (get().isInitialized) return;

    const settings = notificationSettingsStorage.get();
    const notifications = notificationListStorage.get();
    const unreadCount = notifications.filter((n) => !n.read).length;

    set({
      settings,
      notifications,
      unreadCount,
      isInitialized: true,
    });
  },

  addNotification: (notification) => {
    const { settings, notifications } = get();

    if (!settings.enabled) return;

    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      read: false,
    };

    const updatedNotifications = [newNotification, ...notifications];
    notificationListStorage.set(updatedNotifications);

    set({
      notifications: updatedNotifications,
      unreadCount: get().unreadCount + 1,
    });

    // Play sound
    playNotificationSound(settings);

    // Show browser notification if enabled and tab is not focused
    if (settings.showBrowserNotifications && document.hidden) {
      showBrowserNotification(notification.title, notification.message);
    }
  },

  markAsRead: (id) => {
    const { notifications } = get();
    const updatedNotifications = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    );
    notificationListStorage.set(updatedNotifications);

    const unreadCount = updatedNotifications.filter((n) => !n.read).length;
    set({ notifications: updatedNotifications, unreadCount });
  },

  markAllAsRead: () => {
    const { notifications } = get();
    const updatedNotifications = notifications.map((n) => ({
      ...n,
      read: true,
    }));
    notificationListStorage.set(updatedNotifications);
    set({ notifications: updatedNotifications, unreadCount: 0 });
  },

  removeNotification: (id) => {
    const { notifications } = get();
    const notification = notifications.find((n) => n.id === id);
    const updatedNotifications = notifications.filter((n) => n.id !== id);
    notificationListStorage.set(updatedNotifications);

    const unreadDecrease = notification && !notification.read ? 1 : 0;
    set({
      notifications: updatedNotifications,
      unreadCount: Math.max(0, get().unreadCount - unreadDecrease),
    });
  },

  clearAll: () => {
    notificationListStorage.set([]);
    set({ notifications: [], unreadCount: 0 });
  },

  updateSettings: (newSettings) => {
    const { settings } = get();
    const updatedSettings = { ...settings, ...newSettings };
    notificationSettingsStorage.set(updatedSettings);
    set({ settings: updatedSettings });
  },

  testSound: async () => {
    const { settings } = get();
    await playNotificationSound({ ...settings, soundEnabled: true });
  },
}));
