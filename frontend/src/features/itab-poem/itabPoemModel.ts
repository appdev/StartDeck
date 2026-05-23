import type { WidgetConfig } from "@/types";
import {
  ITAB_WIDGET_SIZE_BY_KEY,
  resolveItabWidgetSize,
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  ITAB_POEM_CATALOG_ID,
  ITAB_POEM_DATA_VERSION,
  ITAB_POEM_DEFAULT_SIZE,
  ITAB_POEM_RUNTIME,
  ITAB_POEM_WIDGET_TYPE,
  type ItabPoemApiData,
  type ItabPoemWidgetData,
} from "./itabPoemTypes";

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

export const isItabPoemSizeKey = (value: unknown): value is ItabWidgetSizeKey =>
  typeof value === "string" &&
  ITAB_WIDGET_SIZE_BY_KEY.has(value as ItabWidgetSizeKey);

const normalizeItabPoemData = (raw: unknown): ItabPoemApiData | undefined => {
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

export const normalizeItabPoemWidgetData = (
  raw: unknown,
): ItabPoemWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isItabPoemSizeKey(input.sizeKey)
    ? input.sizeKey
    : ITAB_POEM_DEFAULT_SIZE;
  const currentPoem = normalizeItabPoemData(input.currentPoem);
  const paletteDate = normalizePaletteDate(input.paletteDate);
  return {
    runtime: ITAB_POEM_RUNTIME,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    version: ITAB_POEM_DATA_VERSION,
    sizeKey,
    ...(currentPoem ? { currentPoem } : {}),
    paletteIndex: normalizePaletteIndex(input.paletteIndex),
    ...(paletteDate ? { paletteDate } : {}),
  };
};

export const createDefaultItabPoemWidget = (): WidgetConfig => {
  const size = resolveItabWidgetSize(ITAB_POEM_DEFAULT_SIZE);
  return {
    id: ITAB_POEM_CATALOG_ID,
    type: ITAB_POEM_WIDGET_TYPE,
    enable: true,
    isPublic: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: ITAB_POEM_RUNTIME,
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: ITAB_POEM_DATA_VERSION,
      sizeKey: ITAB_POEM_DEFAULT_SIZE,
      paletteIndex: 0,
    } satisfies ItabPoemWidgetData,
  };
};

export const applyItabPoemSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: ItabWidgetSizeKey,
) => {
  const size = resolveItabWidgetSize(sizeKey);
  const data = normalizeItabPoemWidgetData(widget.data);
  widget.id = ITAB_POEM_CATALOG_ID;
  widget.type = ITAB_POEM_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies ItabPoemWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncItabPoemSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toItabWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applyItabPoemSizeToWidget(widget, sizeKey);
};
