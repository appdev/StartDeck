import type { WidgetConfig } from "@/types";
import {
  ITAB_WIDGET_SIZE_BY_KEY,
  resolveItabWidgetSize,
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  ITAB_POMODORO_CATALOG_ID,
  ITAB_POMODORO_DATA_VERSION,
  ITAB_POMODORO_DEFAULT_DURATION_SECONDS,
  ITAB_POMODORO_DEFAULT_SIZE,
  ITAB_POMODORO_RUNTIME,
  ITAB_POMODORO_THEME_COUNT,
  ITAB_POMODORO_WIDGET_TYPE,
  type ItabPomodoroPhase,
  type ItabPomodoroWidgetData,
} from "./itabPomodoroTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isItabPomodoroSizeKey = (
  value: unknown,
): value is ItabWidgetSizeKey =>
  typeof value === "string" &&
  ITAB_WIDGET_SIZE_BY_KEY.has(value as ItabWidgetSizeKey);

const normalizePositiveSeconds = (value: unknown, fallback: number) => {
  const next = Number(value);
  if (!Number.isFinite(next) || next <= 0) return fallback;
  return Math.floor(next);
};

const normalizePhase = (value: unknown): ItabPomodoroPhase =>
  value === "focus" || value === "completed" ? value : "idle";

const normalizeThemeIndex = (value: unknown) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0;
  return Math.min(ITAB_POMODORO_THEME_COUNT - 1, Math.max(0, Math.floor(next)));
};

export const normalizeItabPomodoroWidgetData = (
  raw: unknown,
): ItabPomodoroWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isItabPomodoroSizeKey(input.sizeKey)
    ? input.sizeKey
    : ITAB_POMODORO_DEFAULT_SIZE;
  const duration = normalizePositiveSeconds(
    input.duration,
    ITAB_POMODORO_DEFAULT_DURATION_SECONDS,
  );
  const remainingSeconds = Math.min(
    duration,
    Math.max(
      0,
      Math.floor(
        Number.isFinite(Number(input.remainingSeconds))
          ? Number(input.remainingSeconds)
          : duration,
      ),
    ),
  );
  const updatedAt = Number(input.updatedAt);

  return {
    runtime: ITAB_POMODORO_RUNTIME,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    version: ITAB_POMODORO_DATA_VERSION,
    sizeKey,
    duration,
    remainingSeconds,
    phase: normalizePhase(input.phase),
    isRunning: Boolean(input.isRunning),
    sessions: Math.max(0, Math.floor(Number(input.sessions) || 0)),
    themeIndex: normalizeThemeIndex(input.themeIndex),
    audioEnabled:
      typeof input.audioEnabled === "boolean" ? input.audioEnabled : true,
    ...(Number.isFinite(updatedAt) && updatedAt > 0
      ? { updatedAt: Math.floor(updatedAt) }
      : {}),
  };
};

export const createDefaultItabPomodoroWidget = (): WidgetConfig => {
  const size = resolveItabWidgetSize(ITAB_POMODORO_DEFAULT_SIZE);
  return {
    id: ITAB_POMODORO_CATALOG_ID,
    type: ITAB_POMODORO_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: ITAB_POMODORO_RUNTIME,
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: ITAB_POMODORO_DATA_VERSION,
      sizeKey: ITAB_POMODORO_DEFAULT_SIZE,
      duration: ITAB_POMODORO_DEFAULT_DURATION_SECONDS,
      remainingSeconds: ITAB_POMODORO_DEFAULT_DURATION_SECONDS,
      phase: "idle",
      isRunning: false,
      sessions: 0,
      themeIndex: 0,
      audioEnabled: true,
    } satisfies ItabPomodoroWidgetData,
  };
};

export const applyItabPomodoroSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: ItabWidgetSizeKey,
) => {
  const size = resolveItabWidgetSize(sizeKey);
  const data = normalizeItabPomodoroWidgetData(widget.data);
  widget.id = ITAB_POMODORO_CATALOG_ID;
  widget.type = ITAB_POMODORO_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies ItabPomodoroWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncItabPomodoroSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toItabWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applyItabPomodoroSizeToWidget(widget, sizeKey);
};
