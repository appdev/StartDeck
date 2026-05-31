import type { WidgetConfig } from "@/types";
import { toItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  resolveRuntimeWidgetSize,
  resolveRuntimeWidgetSizeKey,
} from "@/features/widget-runtime/widgetRuntimeSizes";
import {
  ITAB_MEMO_CATALOG_ID,
  ITAB_MEMO_DATA_VERSION,
  ITAB_MEMO_DEFAULT_SIZE,
  ITAB_MEMO_RUNTIME,
  ITAB_MEMO_WIDGET_TYPE,
  type ItabMemoSizeKey,
  type ItabMemoNote,
  type ItabMemoWidgetData,
} from "./itabMemoTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isItabMemoSizeKey = (value: unknown): value is ItabMemoSizeKey =>
  typeof value === "string" &&
  resolveRuntimeWidgetSizeKey(ITAB_MEMO_WIDGET_TYPE, { sizeKey: value }) ===
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

export const createDefaultItabMemoNotes = (): ItabMemoNote[] => [];

const normalizeNote = (value: unknown, index: number): ItabMemoNote | null => {
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

export const normalizeItabMemoNotes = (raw: unknown): ItabMemoNote[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => normalizeNote(item, index))
    .filter((item): item is ItabMemoNote => item !== null);
};

export const normalizeItabMemoWidgetData = (
  raw: unknown,
): ItabMemoWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isItabMemoSizeKey(input.sizeKey)
    ? input.sizeKey
    : ITAB_MEMO_DEFAULT_SIZE;
  const normalizedNotes = normalizeItabMemoNotes(input.notes);
  const activeNoteId =
    typeof input.activeNoteId === "string" &&
    normalizedNotes.some((note) => note.id === input.activeNoteId)
      ? input.activeNoteId
      : normalizedNotes[0]?.id;
  return {
    runtime: ITAB_MEMO_RUNTIME,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    version: ITAB_MEMO_DATA_VERSION,
    sizeKey,
    notes: normalizedNotes,
    ...(activeNoteId ? { activeNoteId } : {}),
  };
};

export const createDefaultItabMemoWidget = (): WidgetConfig => {
  const size = resolveRuntimeWidgetSize(ITAB_MEMO_DEFAULT_SIZE);
  return {
    id: ITAB_MEMO_CATALOG_ID,
    type: ITAB_MEMO_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: ITAB_MEMO_RUNTIME,
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: ITAB_MEMO_DATA_VERSION,
      sizeKey: ITAB_MEMO_DEFAULT_SIZE,
      notes: [],
    } satisfies ItabMemoWidgetData,
  };
};

export const applyItabMemoSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: ItabMemoSizeKey,
) => {
  const resolvedSizeKey =
    resolveRuntimeWidgetSizeKey(ITAB_MEMO_WIDGET_TYPE, { sizeKey }) ||
    ITAB_MEMO_DEFAULT_SIZE;
  const size = resolveRuntimeWidgetSize(resolvedSizeKey);
  const data = normalizeItabMemoWidgetData(widget.data);
  widget.id = ITAB_MEMO_CATALOG_ID;
  widget.type = ITAB_MEMO_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    sizeKey: resolvedSizeKey,
  } satisfies ItabMemoWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncItabMemoSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey =
    resolveRuntimeWidgetSizeKey(ITAB_MEMO_WIDGET_TYPE, {
      colSpan: widget.w ?? widget.colSpan,
      rowSpan: widget.h ?? widget.rowSpan,
    }) ||
    toItabWidgetSizeKey({
      colSpan: widget.w ?? widget.colSpan,
      rowSpan: widget.h ?? widget.rowSpan,
    });
  if (sizeKey) applyItabMemoSizeToWidget(widget, sizeKey);
};
