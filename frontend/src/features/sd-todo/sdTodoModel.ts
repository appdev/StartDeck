import type { WidgetConfig } from "@/types";
import { toSdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  resolveRuntimeWidgetSize,
  resolveRuntimeWidgetSizeKey,
} from "@/features/widget-runtime/widgetRuntimeSizes";
import {
  SD_TODO_CATALOG_ID,
  SD_TODO_DATA_VERSION,
  SD_TODO_DEFAULT_SIZE,
  SD_TODO_RUNTIME,
  SD_TODO_WIDGET_TYPE,
  type SdTodoSizeKey,
  type SdTodoTask,
  type SdTodoWidgetData,
} from "./sdTodoTypes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isSdTodoSizeKey = (value: unknown): value is SdTodoSizeKey =>
  typeof value === "string" &&
  resolveRuntimeWidgetSizeKey(SD_TODO_WIDGET_TYPE, { sizeKey: value }) ===
    value;

const normalizeTask = (value: unknown, index: number): SdTodoTask | null => {
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

export const normalizeSdTodoTasks = (raw: unknown): SdTodoTask[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => normalizeTask(item, index))
    .filter((item): item is SdTodoTask => item !== null);
};

export const normalizeSdTodoWidgetData = (
  raw: unknown,
): SdTodoWidgetData => {
  const input = isObject(raw) ? raw : {};
  const sizeKey = isSdTodoSizeKey(input.sizeKey)
    ? input.sizeKey
    : SD_TODO_DEFAULT_SIZE;
  const rawTasks = Array.isArray(raw) ? raw : input.tasks;
  return {
    runtime: SD_TODO_RUNTIME,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    version: SD_TODO_DATA_VERSION,
    sizeKey,
    tasks: normalizeSdTodoTasks(rawTasks),
  };
};

export const createDefaultSdTodoWidget = (): WidgetConfig => {
  const size = resolveRuntimeWidgetSize(SD_TODO_DEFAULT_SIZE);
  return {
    id: SD_TODO_CATALOG_ID,
    type: SD_TODO_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: {
      runtime: SD_TODO_RUNTIME,
      layoutSystem: SD_GRID_SCHEMA_VERSION,
      version: SD_TODO_DATA_VERSION,
      sizeKey: SD_TODO_DEFAULT_SIZE,
      tasks: [],
    } satisfies SdTodoWidgetData,
  };
};

export const applySdTodoSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: SdTodoSizeKey,
) => {
  const resolvedSizeKey =
    resolveRuntimeWidgetSizeKey(SD_TODO_WIDGET_TYPE, { sizeKey }) ||
    SD_TODO_DEFAULT_SIZE;
  const size = resolveRuntimeWidgetSize(resolvedSizeKey);
  const data = normalizeSdTodoWidgetData(widget.data);
  widget.id = SD_TODO_CATALOG_ID;
  widget.type = SD_TODO_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    sizeKey: resolvedSizeKey,
  } satisfies SdTodoWidgetData & { layoutSystem: string };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};

export const syncSdTodoSizeFromWidgetSpans = (widget: WidgetConfig) => {
  const sizeKey =
    toSdWidgetSizeKey({
      colSpan: widget.w ?? widget.colSpan,
      rowSpan: widget.h ?? widget.rowSpan,
    }) ||
    resolveRuntimeWidgetSizeKey(SD_TODO_WIDGET_TYPE, {
      colSpan: widget.w ?? widget.colSpan,
      rowSpan: widget.h ?? widget.rowSpan,
    });
  if (sizeKey) applySdTodoSizeToWidget(widget, sizeKey);
};
