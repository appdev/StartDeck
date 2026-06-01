import type { WidgetConfig } from "@/types";
import {
  SD_WIDGET_SIZE_BY_KEY,
  resolveSdWidgetSize,
  toSdWidgetSizeKey,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  SD_POMODORO_CATALOG_ID,
  SD_POMODORO_DATA_VERSION,
  SD_POMODORO_DEFAULT_DURATION_SECONDS,
  SD_POMODORO_DEFAULT_SIZE,
  SD_POMODORO_RUNTIME,
  SD_POMODORO_THEME_COUNT,
  SD_POMODORO_WIDGET_TYPE,
  type SdPomodoroPhase,
  type SdPomodoroWidgetData,
} from "./sdPomodoroTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isSdPomodoroSizeKey = (
  value: unknown,
): value is SdWidgetSizeKey =>
  typeof value === "string" &&
  SD_WIDGET_SIZE_BY_KEY.has(value as SdWidgetSizeKey);

const normalizePositiveSeconds = (value: unknown, fallback: number) => {
  const next = Number(value);
  if (!Number.isFinite(next) || next <= 0) return fallback;
  return Math.floor(next);
};

const normalizePhase = (value: unknown): SdPomodoroPhase =>
  value === "focus" || value === "completed" ? value : "idle";

const normalizeThemeIndex = (value: unknown) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0;
  return Math.min(SD_POMODORO_THEME_COUNT - 1, Math.max(0, Math.floor(next)));
};

export const normalizeSdPomodoroWidgetData = (
  raw: unknown,
): SdPomodoroWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isSdPomodoroSizeKey(input.sizeKey)
    ? input.sizeKey
    : SD_POMODORO_DEFAULT_SIZE;
  const duration = normalizePositiveSeconds(
    input.duration,
    SD_POMODORO_DEFAULT_DURATION_SECONDS,
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
    runtime: SD_POMODORO_RUNTIME,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    version: SD_POMODORO_DATA_VERSION,
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

export const createDefaultSdPomodoroWidget = (): WidgetConfig => {
  const size = resolveSdWidgetSize(SD_POMODORO_DEFAULT_SIZE);
  return {
    id: SD_POMODORO_CATALOG_ID,
    type: SD_POMODORO_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: SD_POMODORO_RUNTIME,
      layoutSystem: SD_GRID_SCHEMA_VERSION,
      version: SD_POMODORO_DATA_VERSION,
      sizeKey: SD_POMODORO_DEFAULT_SIZE,
      duration: SD_POMODORO_DEFAULT_DURATION_SECONDS,
      remainingSeconds: SD_POMODORO_DEFAULT_DURATION_SECONDS,
      phase: "idle",
      isRunning: false,
      sessions: 0,
      themeIndex: 0,
      audioEnabled: true,
    } satisfies SdPomodoroWidgetData,
  };
};

export const applySdPomodoroSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: SdWidgetSizeKey,
) => {
  const size = resolveSdWidgetSize(sizeKey);
  const data = normalizeSdPomodoroWidgetData(widget.data);
  widget.id = SD_POMODORO_CATALOG_ID;
  widget.type = SD_POMODORO_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies SdPomodoroWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncSdPomodoroSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toSdWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applySdPomodoroSizeToWidget(widget, sizeKey);
};
