import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export const ITAB_POMODORO_WIDGET_TYPE = "itab-pomodoro-29";
export const ITAB_POMODORO_CATALOG_ID = "pomodoro";
export const ITAB_POMODORO_RUNTIME = "itab-pomodoro";
export const ITAB_POMODORO_DATA_VERSION = 1;
export const ITAB_POMODORO_DEFAULT_SIZE: ItabWidgetSizeKey = "2x2";
export const ITAB_POMODORO_DEFAULT_DURATION_SECONDS = 25 * 60;
export const ITAB_POMODORO_THEME_COUNT = 13;

export type ItabPomodoroPhase = "idle" | "focus" | "completed";

export interface ItabPomodoroTheme {
  name: string;
  key: string;
  path: string;
  audio: string;
}

export interface ItabPomodoroWidgetData {
  runtime: typeof ITAB_POMODORO_RUNTIME;
  layoutSystem?: string;
  version: typeof ITAB_POMODORO_DATA_VERSION;
  sizeKey: ItabWidgetSizeKey;
  duration: number;
  remainingSeconds: number;
  phase: ItabPomodoroPhase;
  isRunning: boolean;
  sessions: number;
  themeIndex: number;
  audioEnabled: boolean;
  updatedAt?: number;
}
