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

export const createDefaultItabMemoNotes = (): ItabMemoNote[] => [
  {
    id: "memo-tip",
    title: "iTab操作小技巧",
    body: [
      "1. 切换搜索引擎: 点击搜索框左侧图标可快速切换搜索引擎",
      "2. 快速翻译: 点击搜索框联想列表第一项可快速翻译文本",
      "3. 右键菜单: 在桌面空白处点击右键可快速添加图标、切换壁纸、设置、备份等操作",
      "4. 极简模式: 点击标签页时间快速切换到极简模式",
      "5. 动态壁纸: 点击【i壁纸】 打开壁纸应用 - 动态壁纸,选择壁纸",
    ].join("\n"),
    pinned: false,
    createdAt: "2021-10-16 12:07:14",
    updatedAt: "2026-5-21 17:08:20",
    listTime: "2026/5/21 17:08",
  },
  {
    id: "memo-third",
    title: "第三",
    body: "第三",
    pinned: false,
    createdAt: "2026-5-21 16:50:00",
    updatedAt: "2026-5-21 16:50:00",
    listTime: "2026/5/21 16:50",
  },
  {
    id: "memo-date",
    title: "2026-05-21",
    body: "2026-05-21",
    pinned: false,
    createdAt: "2026-5-21 16:49:00",
    updatedAt: "2026-5-21 16:49:00",
    listTime: "2026/5/21 16:49",
  },
];

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
  if (!Array.isArray(raw)) return createDefaultItabMemoNotes();
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
  const normalizedNotes = Array.isArray(input.notes)
    ? normalizeItabMemoNotes(input.notes)
    : createDefaultItabMemoNotes();
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
    isPublic: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: ITAB_MEMO_RUNTIME,
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: ITAB_MEMO_DATA_VERSION,
      sizeKey: ITAB_MEMO_DEFAULT_SIZE,
      notes: createDefaultItabMemoNotes(),
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
