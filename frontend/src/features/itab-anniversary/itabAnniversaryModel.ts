import type { WidgetConfig } from "@/types";
import {
  ITAB_WIDGET_SIZE_BY_KEY,
  resolveItabWidgetSize,
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  ITAB_ANNIVERSARY_CATALOG_ID,
  ITAB_ANNIVERSARY_DATA_VERSION,
  ITAB_ANNIVERSARY_DEFAULT_SIZE,
  ITAB_ANNIVERSARY_RUNTIME,
  ITAB_ANNIVERSARY_WIDGET_TYPE,
  type ItabAnniversaryBackgroundMode,
  type ItabAnniversaryMode,
  type ItabAnniversaryRepeat,
  type ItabAnniversaryWidgetData,
} from "./itabAnniversaryTypes";

export const ITAB_ANNIVERSARY_IMAGE_COUNT = 25;
export const ITAB_ANNIVERSARY_DEFAULT_BACKGROUND_IMAGE =
  "/itab-live-assets/anniversary/yiyan-12.webp";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isItabAnniversarySizeKey = (
  value: unknown,
): value is ItabWidgetSizeKey =>
  typeof value === "string" &&
  ITAB_WIDGET_SIZE_BY_KEY.has(value as ItabWidgetSizeKey);

const normalizeText = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const next = value.trim();
  return next || fallback;
};

const normalizeMode = (value: unknown): ItabAnniversaryMode =>
  value === "remaining" ? "remaining" : "elapsed";

const normalizeRepeat = (value: unknown): ItabAnniversaryRepeat => {
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
): ItabAnniversaryBackgroundMode => (value === "color" ? "color" : "image");

const normalizeMask = (value: unknown) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0;
  return Math.min(100, Math.max(0, Math.round(next)));
};

export const normalizeItabAnniversaryWidgetData = (
  raw: unknown,
): ItabAnniversaryWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isItabAnniversarySizeKey(input.sizeKey)
    ? input.sizeKey
    : ITAB_ANNIVERSARY_DEFAULT_SIZE;
  const eventName = normalizeText(input.eventName, "你在世界已经");

  return {
    runtime: ITAB_ANNIVERSARY_RUNTIME,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    version: ITAB_ANNIVERSARY_DATA_VERSION,
    sizeKey,
    title: normalizeText(input.title, "纪念日"),
    label: normalizeText(input.label, eventName),
    eventName,
    date: normalizeText(input.date, "1997-10-1"),
    mode: normalizeMode(input.mode),
    repeat: normalizeRepeat(input.repeat),
    textColor: normalizeText(input.textColor, "#ffffff"),
    backgroundColor: normalizeText(input.backgroundColor, "#8e726f"),
    backgroundImage: normalizeText(
      input.backgroundImage,
      ITAB_ANNIVERSARY_DEFAULT_BACKGROUND_IMAGE,
    ),
    backgroundMode: normalizeBackgroundMode(input.backgroundMode),
    mask: normalizeMask(input.mask),
  };
};

export const createDefaultItabAnniversaryWidget = (): WidgetConfig => {
  const size = resolveItabWidgetSize(ITAB_ANNIVERSARY_DEFAULT_SIZE);
  return {
    id: ITAB_ANNIVERSARY_CATALOG_ID,
    type: ITAB_ANNIVERSARY_WIDGET_TYPE,
    enable: true,
    isPublic: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: normalizeItabAnniversaryWidgetData({}),
  };
};

export const applyItabAnniversarySizeToWidget = (
  widget: WidgetConfig,
  sizeKey: ItabWidgetSizeKey,
) => {
  const size = resolveItabWidgetSize(sizeKey);
  const data = normalizeItabAnniversaryWidgetData(widget.data);
  widget.type = ITAB_ANNIVERSARY_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies ItabAnniversaryWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncItabAnniversarySizeFromWidgetSpans = (
  widget: WidgetConfig,
) => {
  const sizeKey = toItabWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applyItabAnniversarySizeToWidget(widget, sizeKey);
};
