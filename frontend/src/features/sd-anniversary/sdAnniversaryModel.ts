import type { WidgetConfig } from "@/types";
import {
  SD_WIDGET_SIZE_BY_KEY,
  resolveSdWidgetSize,
  toSdWidgetSizeKey,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  SD_ANNIVERSARY_CATALOG_ID,
  SD_ANNIVERSARY_DATA_VERSION,
  SD_ANNIVERSARY_DEFAULT_SIZE,
  SD_ANNIVERSARY_RUNTIME,
  SD_ANNIVERSARY_WIDGET_TYPE,
  type SdAnniversaryBackgroundMode,
  type SdAnniversaryMode,
  type SdAnniversaryRepeat,
  type SdAnniversaryWidgetData,
} from "./sdAnniversaryTypes";

export const SD_ANNIVERSARY_IMAGE_COUNT = 25;
export const SD_ANNIVERSARY_DEFAULT_BACKGROUND_IMAGE =
  "/sd-live-assets/anniversary/yiyan-12.webp";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isSdAnniversarySizeKey = (
  value: unknown,
): value is SdWidgetSizeKey =>
  typeof value === "string" &&
  SD_WIDGET_SIZE_BY_KEY.has(value as SdWidgetSizeKey);

const normalizeText = (value: unknown, fallback = "") => {
  if (typeof value !== "string") return fallback;
  const next = value.trim();
  return next || fallback;
};

const normalizeMode = (value: unknown): SdAnniversaryMode =>
  value === "remaining" ? "remaining" : "elapsed";

const normalizeRepeat = (value: unknown): SdAnniversaryRepeat => {
  if (
    value === "每周" ||
    value === "每月" ||
    value === "每年" ||
    value === "节日"
  ) {
    return value;
  }
  return "不重复";
};

const normalizeBackgroundMode = (
  value: unknown,
): SdAnniversaryBackgroundMode => (value === "color" ? "color" : "image");

const normalizeMask = (value: unknown) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0;
  return Math.min(100, Math.max(0, Math.round(next)));
};

export const normalizeSdAnniversaryWidgetData = (
  raw: unknown,
): SdAnniversaryWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isSdAnniversarySizeKey(input.sizeKey)
    ? input.sizeKey
    : SD_ANNIVERSARY_DEFAULT_SIZE;
  const eventName = normalizeText(input.eventName);

  return {
    runtime: SD_ANNIVERSARY_RUNTIME,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    version: SD_ANNIVERSARY_DATA_VERSION,
    sizeKey,
    title: normalizeText(input.title),
    label: normalizeText(input.label, eventName),
    eventName,
    date: normalizeText(input.date),
    mode: normalizeMode(input.mode),
    repeat: normalizeRepeat(input.repeat),
    textColor: normalizeText(input.textColor, "#ffffff"),
    backgroundColor: normalizeText(input.backgroundColor, "#8e726f"),
    backgroundImage: normalizeText(
      input.backgroundImage,
      SD_ANNIVERSARY_DEFAULT_BACKGROUND_IMAGE,
    ),
    backgroundMode: normalizeBackgroundMode(input.backgroundMode),
    mask: normalizeMask(input.mask),
  };
};

export const createDefaultSdAnniversaryWidget = (): WidgetConfig => {
  const size = resolveSdWidgetSize(SD_ANNIVERSARY_DEFAULT_SIZE);
  return {
    id: SD_ANNIVERSARY_CATALOG_ID,
    type: SD_ANNIVERSARY_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: normalizeSdAnniversaryWidgetData({}),
  };
};

export const applySdAnniversarySizeToWidget = (
  widget: WidgetConfig,
  sizeKey: SdWidgetSizeKey,
) => {
  const size = resolveSdWidgetSize(sizeKey);
  const data = normalizeSdAnniversaryWidgetData(widget.data);
  widget.type = SD_ANNIVERSARY_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies SdAnniversaryWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncSdAnniversarySizeFromWidgetSpans = (
  widget: WidgetConfig,
) => {
  const sizeKey = toSdWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applySdAnniversarySizeToWidget(widget, sizeKey);
};
