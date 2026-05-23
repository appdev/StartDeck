import type { WidgetConfig } from "@/types";
import {
  ITAB_WIDGET_SIZE_BY_KEY,
  resolveItabWidgetSize,
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  ITAB_TODO_CATALOG_ID,
  ITAB_TODO_DATA_VERSION,
  ITAB_TODO_DEFAULT_SIZE,
  ITAB_TODO_RUNTIME,
  ITAB_TODO_WIDGET_TYPE,
  type ItabTodoTask,
  type ItabTodoWidgetData,
} from "./itabTodoTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isItabTodoSizeKey = (value: unknown): value is ItabWidgetSizeKey =>
  typeof value === "string" &&
  ITAB_WIDGET_SIZE_BY_KEY.has(value as ItabWidgetSizeKey);

const normalizeTask = (value: unknown, index: number): ItabTodoTask | null => {
  if (!isObject(value)) return null;
  const text = typeof value.text === "string" ? value.text : "";
  const title = typeof value.title === "string" ? value.title : "";
  const normalizedText = text || title;
  if (!normalizedText.trim()) return null;
  return {
    id:
      typeof value.id === "string" && value.id.trim()
        ? value.id
        : `todo-task-${index}`,
    text: normalizedText,
    done: Boolean(value.done),
  };
};

export const normalizeItabTodoTasks = (raw: unknown): ItabTodoTask[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => normalizeTask(item, index))
    .filter((item): item is ItabTodoTask => item !== null);
};

export const normalizeItabTodoWidgetData = (
  raw: unknown,
): ItabTodoWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isItabTodoSizeKey(input.sizeKey)
    ? input.sizeKey
    : ITAB_TODO_DEFAULT_SIZE;
  const rawTasks = Array.isArray(raw) ? raw : input.tasks;
  return {
    runtime: ITAB_TODO_RUNTIME,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    version: ITAB_TODO_DATA_VERSION,
    sizeKey,
    tasks: normalizeItabTodoTasks(rawTasks),
  };
};

export const createDefaultItabTodoWidget = (): WidgetConfig => {
  const size = resolveItabWidgetSize(ITAB_TODO_DEFAULT_SIZE);
  return {
    id: ITAB_TODO_CATALOG_ID,
    type: ITAB_TODO_WIDGET_TYPE,
    enable: true,
    isPublic: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: ITAB_TODO_RUNTIME,
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: ITAB_TODO_DATA_VERSION,
      sizeKey: ITAB_TODO_DEFAULT_SIZE,
      tasks: [],
    } satisfies ItabTodoWidgetData,
  };
};

export const applyItabTodoSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: ItabWidgetSizeKey,
) => {
  const size = resolveItabWidgetSize(sizeKey);
  const data = normalizeItabTodoWidgetData(widget.data);
  widget.id = ITAB_TODO_CATALOG_ID;
  widget.type = ITAB_TODO_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    sizeKey,
  } satisfies ItabTodoWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncItabTodoSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey = toItabWidgetSizeKey({
    colSpan: widget.w ?? widget.colSpan,
    rowSpan: widget.h ?? widget.rowSpan,
  });
  if (sizeKey) applyItabTodoSizeToWidget(widget, sizeKey);
};
