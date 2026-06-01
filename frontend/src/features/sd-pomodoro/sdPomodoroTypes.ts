import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";

export const SD_POMODORO_WIDGET_TYPE = "sd-pomodoro-29";
export const SD_POMODORO_CATALOG_ID = "pomodoro";
export const SD_POMODORO_RUNTIME = "sd-pomodoro";
export const SD_POMODORO_DATA_VERSION = 1;
export const SD_POMODORO_DEFAULT_SIZE: SdWidgetSizeKey = "2x2";
export const SD_POMODORO_DEFAULT_DURATION_SECONDS = 25 * 60;
export const SD_POMODORO_THEME_COUNT = 13;

export type SdPomodoroPhase = "idle" | "focus" | "completed";

export interface SdPomodoroTheme {
  name: string;
  key: string;
  path: string;
  audio: string;
}

export interface SdPomodoroWidgetData {
  runtime: typeof SD_POMODORO_RUNTIME;
  layoutSystem?: string;
  version: typeof SD_POMODORO_DATA_VERSION;
  sizeKey: SdWidgetSizeKey;
  duration: number;
  remainingSeconds: number;
  phase: SdPomodoroPhase;
  isRunning: boolean;
  sessions: number;
  themeIndex: number;
  audioEnabled: boolean;
  updatedAt?: number;
}
