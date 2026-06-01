import type { WidgetConfig } from "@/types";
import {
  SD_WIDGET_SIZE_BY_KEY,
  resolveSdWidgetSize,
  toSdWidgetSizeKey,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  SD_POEM_CATALOG_ID,
  SD_POEM_DATA_VERSION,
  SD_POEM_DEFAULT_SIZE,
  SD_POEM_RUNTIME,
  SD_POEM_WIDGET_TYPE,
  type SdPoemApiData,
  type SdPoemWidgetData,
} from "./sdPoemTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.map(normalizeString).filter((item) => item.length > 0)
    : [];

const normalizePaletteIndex = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : 0;

const normalizePaletteDate = (value: unknown) => {
  const date = normalizeString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
};

export const isSdPoemSizeKey = (value: unknown): value is SdWidgetSizeKey =>
  typeof value === "string" &&
  SD_WIDGET_SIZE_BY_KEY.has(value as SdWidgetSizeKey);

const normalizeSdPoemData = (raw: unknown): SdPoemApiData | undefined => {
  if (!isObject(raw)) return undefined;
  const sentence = normalizeString(raw.sentence);
  const poemTitle = normalizeString(raw.poemTitle);
  const author = normalizeString(raw.author);
  const dynasty = normalizeString(raw.dynasty);
  if (!sentence || !poemTitle || !author || !dynasty) return undefined;
  const fullText = normalizeStringArray(raw.fullText);

  return {
    id: normalizeString(raw.id) || undefined,
    sentence,
    poemTitle,
    author,
    dynasty,
    fullText: fullText.length ? fullText : [sentence],
    translation: normalizeStringArray(raw.translation),
    annotations: normalizeStringArray(raw.annotations),
    preface: normalizeStringArray(raw.preface),
    popularity:
      typeof raw.popularity === "number" && Number.isFinite(raw.popularity)
        ? raw.popularity
        : undefined,
    cacheAt: normalizeString(raw.cacheAt) || undefined,
    sourceStatus: normalizeString(raw.sourceStatus) || undefined,
  };
};

export const normalizeSdPoemWidgetData = (
  raw: unknown,
): SdPoemWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isSdPoemSizeKey(input.sizeKey)
    ? input.sizeKey
    : SD_POEM_DEFAULT_SIZE;
  const currentPoem = normalizeSdPoemData(input.currentPoem);
  const paletteDate = normalizePaletteDate(input.paletteDate);
  return {
    runtime: SD_POEM_RUNTIME,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    version: SD_POEM_DATA_VERSION,
    sizeKey,
    ...(currentPoem ? { currentPoem } : {}),
    paletteIndex: normalizePaletteIndex(input.paletteIndex),
    ...(paletteDate ? { paletteDate } : {}),
  };
};

export const createDefaultSdPoemWidget = (): WidgetConfig => {
  const size = resolveSdWidgetSize(SD_POEM_DEFAULT_SIZE);
  return {
    id: SD_POEM_CATALOG_ID,
    type: SD_POEM_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: SD_POEM_RUNTIME,
      layoutSystem: SD_GRID_SCHEMA_VERSION,
      version: SD_POEM_DATA_VERSION,
      sizeKey: SD_POEM_DEFAULT_SIZE,
      paletteIndex: 0,
    } satisfies SdPoemWidgetData,
  };
};

export const applySdPoemSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: SdWidgetSizeKey,
) => {
  const size = resolveSdWidgetSize(sizeKey);
  const data = normalizeSdPoemWidgetData(widget.data);
  widget.id = SD_POEM_CATALOG_ID;
  widget.type = SD_POEM_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies SdPoemWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncSdPoemSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toSdWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applySdPoemSizeToWidget(widget, sizeKey);
};
