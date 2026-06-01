import type { WidgetConfig } from "@/types";
import { toSdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  resolveRuntimeWidgetSize,
  resolveRuntimeWidgetSizeKey,
} from "@/features/widget-runtime/widgetRuntimeSizes";
import {
  SD_MEMO_CATALOG_ID,
  SD_MEMO_DATA_VERSION,
  SD_MEMO_DEFAULT_SIZE,
  SD_MEMO_RUNTIME,
  SD_MEMO_WIDGET_TYPE,
  type SdMemoSizeKey,
  type SdMemoNote,
  type SdMemoWidgetData,
} from "./sdMemoTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isSdMemoSizeKey = (value: unknown): value is SdMemoSizeKey =>
  typeof value === "string" &&
  resolveRuntimeWidgetSizeKey(SD_MEMO_WIDGET_TYPE, { sizeKey: value }) ===
    value;

const formatTimestamp = (input?: unknown) => {
  if (typeof input === "string" && input.trim()) return input.trim();
  if (typeof input === "number" && Number.isFinite(input)) {
    return new Date(input).toISOString();
  }
  return new Date().toISOString();
};

const titleFromBody = (body: string) => {
  const firstLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine?.slice(0, 32) || "未命名备忘录";
};

export const createDefaultSdMemoNotes = (): SdMemoNote[] => [];

const normalizeNote = (value: unknown, index: number): SdMemoNote | null => {
  if (!isObject(value)) return null;
  const body =
    typeof value.body === "string"
      ? value.body
      : typeof value.content === "string"
        ? value.content
        : "";
  const rawTitle = typeof value.title === "string" ? value.title.trim() : "";
  const title = rawTitle || titleFromBody(body);
  const updatedAt = formatTimestamp(value.updatedAt ?? value.server_ts);
  return {
    id:
      typeof value.id === "string" && value.id.trim()
        ? value.id
        : `memo-note-${index}`,
    title,
    body,
    pinned: Boolean(value.pinned),
    createdAt: formatTimestamp(value.createdAt ?? updatedAt),
    updatedAt,
    listTime: typeof value.listTime === "string" ? value.listTime : undefined,
  };
};

export const normalizeSdMemoNotes = (raw: unknown): SdMemoNote[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => normalizeNote(item, index))
    .filter((item): item is SdMemoNote => item !== null);
};

export const normalizeSdMemoWidgetData = (
  raw: unknown,
): SdMemoWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isSdMemoSizeKey(input.sizeKey)
    ? input.sizeKey
    : SD_MEMO_DEFAULT_SIZE;
  const normalizedNotes = normalizeSdMemoNotes(input.notes);
  const activeNoteId =
    typeof input.activeNoteId === "string" &&
    normalizedNotes.some((note) => note.id === input.activeNoteId)
      ? input.activeNoteId
      : normalizedNotes[0]?.id;
  return {
    runtime: SD_MEMO_RUNTIME,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    version: SD_MEMO_DATA_VERSION,
    sizeKey,
    notes: normalizedNotes,
    ...(activeNoteId ? { activeNoteId } : {}),
  };
};

export const createDefaultSdMemoWidget = (): WidgetConfig => {
  const size = resolveRuntimeWidgetSize(SD_MEMO_DEFAULT_SIZE);
  return {
    id: SD_MEMO_CATALOG_ID,
    type: SD_MEMO_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: SD_MEMO_RUNTIME,
      layoutSystem: SD_GRID_SCHEMA_VERSION,
      version: SD_MEMO_DATA_VERSION,
      sizeKey: SD_MEMO_DEFAULT_SIZE,
      notes: [],
    } satisfies SdMemoWidgetData,
  };
};

export const applySdMemoSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: SdMemoSizeKey,
) => {
  const resolvedSizeKey =
    resolveRuntimeWidgetSizeKey(SD_MEMO_WIDGET_TYPE, { sizeKey }) ||
    SD_MEMO_DEFAULT_SIZE;
  const size = resolveRuntimeWidgetSize(resolvedSizeKey);
  const data = normalizeSdMemoWidgetData(widget.data);
  widget.id = SD_MEMO_CATALOG_ID;
  widget.type = SD_MEMO_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    sizeKey: resolvedSizeKey,
  } satisfies SdMemoWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncSdMemoSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey =
    resolveRuntimeWidgetSizeKey(SD_MEMO_WIDGET_TYPE, {
      colSpan: widget.w ?? widget.colSpan,
      rowSpan: widget.h ?? widget.rowSpan,
    }) ||
    toSdWidgetSizeKey({
      colSpan: widget.w ?? widget.colSpan,
      rowSpan: widget.h ?? widget.rowSpan,
    });
  if (sizeKey) applySdMemoSizeToWidget(widget, sizeKey);
};
