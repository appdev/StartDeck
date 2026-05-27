import type { WidgetConfig } from "@/types";
import {
  ITAB_WIDGET_SIZE_BY_KEY,
  resolveItabWidgetSize,
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";

export type { ItabWidgetSizeKey };

export const ITAB_GRID_SCHEMA_VERSION = "itab-grid/2026-05-22";
export const ITAB_GRID_CELL = 60;
export const ITAB_GRID_GAP = 30;
export const ITAB_GRID_PITCH = ITAB_GRID_CELL + ITAB_GRID_GAP;
export const ITAB_GRID_MAX_COLUMNS = 14;

export interface ItabGridSpec {
  cell: number;
  gap: number;
  columns: number;
}

export interface ItabGridRect {
  sizeKey: ItabWidgetSizeKey;
  width: number;
  height: number;
  cols: number;
  rows: number;
}

export interface ItabGridLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  sizeKey: ItabWidgetSizeKey;
}

export const ITAB_GRID_DEFAULT_SPEC: ItabGridSpec = {
  cell: ITAB_GRID_CELL,
  gap: ITAB_GRID_GAP,
  columns: 4,
};

const positiveInteger = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0
    ? Math.max(1, Math.floor(value))
    : fallback;

export const resolveItabGridRect = (
  sizeKey: ItabWidgetSizeKey,
): ItabGridRect => {
  const size = resolveItabWidgetSize(sizeKey);
  return {
    sizeKey,
    width: size.width,
    height: size.height,
    cols: size.colSpan,
    rows: size.rowSpan,
  };
};

export const resolveItabGridContainerWidth = (
  columns: number,
  spec: Pick<ItabGridSpec, "cell" | "gap"> = ITAB_GRID_DEFAULT_SPEC,
) => {
  const safeColumns = positiveInteger(columns, ITAB_GRID_DEFAULT_SPEC.columns);
  return safeColumns * spec.cell + (safeColumns + 1) * spec.gap;
};

export const resolveItabGridColumns = (
  availableWidth: number,
  maxColumns = ITAB_GRID_MAX_COLUMNS,
  spec: Pick<ItabGridSpec, "cell" | "gap"> = ITAB_GRID_DEFAULT_SPEC,
) => {
  const safeAvailable = Number.isFinite(availableWidth) ? availableWidth : 0;
  const fit = Math.floor((safeAvailable - spec.gap) / (spec.cell + spec.gap));
  return Math.max(
    1,
    Math.min(positiveInteger(maxColumns, ITAB_GRID_MAX_COLUMNS), fit),
  );
};

export const resolveItabGridTrackColumns = (
  availableWidth: number,
  maxColumns = ITAB_GRID_MAX_COLUMNS,
  spec: Pick<ItabGridSpec, "cell" | "gap"> = ITAB_GRID_DEFAULT_SPEC,
) => {
  const safeAvailable = Number.isFinite(availableWidth) ? availableWidth : 0;
  const fit = Math.floor(safeAvailable / (spec.cell + spec.gap));
  return Math.max(
    1,
    Math.min(positiveInteger(maxColumns, ITAB_GRID_MAX_COLUMNS), fit),
  );
};

export const isItabWidgetSizeKey = (
  value: unknown,
): value is ItabWidgetSizeKey =>
  typeof value === "string" &&
  ITAB_WIDGET_SIZE_BY_KEY.has(value as ItabWidgetSizeKey);

export const resolveItabWidgetSizeKey = (
  input: Pick<WidgetConfig, "w" | "h" | "colSpan" | "rowSpan" | "data">,
  fallback: ItabWidgetSizeKey = "1x2",
): ItabWidgetSizeKey => {
  const data = input.data && typeof input.data === "object" ? input.data : {};
  if (isItabWidgetSizeKey((data as { sizeKey?: unknown }).sizeKey)) {
    return (data as { sizeKey: ItabWidgetSizeKey }).sizeKey;
  }
  return (
    toItabWidgetSizeKey({
      colSpan: input.w ?? input.colSpan,
      rowSpan: input.h ?? input.rowSpan,
    }) || fallback
  );
};

export const resolveItabGridLayout = (
  widget: Pick<
    WidgetConfig,
    "x" | "y" | "w" | "h" | "colSpan" | "rowSpan" | "data"
  >,
): ItabGridLayout => {
  const sizeKey = resolveItabWidgetSizeKey(widget);
  const rect = resolveItabGridRect(sizeKey);
  return {
    x: Math.max(0, Math.floor(widget.x ?? 0)),
    y: Math.max(0, Math.floor(widget.y ?? 0)),
    w: rect.cols,
    h: rect.rows,
    sizeKey,
  };
};

export const withItabGridData = <T extends WidgetConfig>(
  widget: T,
  sizeKey?: ItabWidgetSizeKey,
): T => {
  const resolvedSizeKey = sizeKey || resolveItabWidgetSizeKey(widget);
  const rect = resolveItabGridRect(resolvedSizeKey);
  const data =
    widget.data && typeof widget.data === "object" ? widget.data : {};
  const normalized = {
    ...widget,
    w: rect.cols,
    h: rect.rows,
    colSpan: rect.cols,
    rowSpan: rect.rows,
    data: {
      ...data,
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      sizeKey: resolvedSizeKey,
    },
  };
  delete normalized.layouts;
  return normalized;
};

export const hasItabGridSchema = (widget: WidgetConfig) =>
  widget.data &&
  typeof widget.data === "object" &&
  (widget.data as { layoutSystem?: unknown }).layoutSystem ===
    ITAB_GRID_SCHEMA_VERSION;
