import type { WidgetConfig } from "@/types";
import {
  SD_WIDGET_SIZE_BY_KEY,
  resolveSdWidgetSize,
  toSdWidgetSizeKey,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";

export type { SdWidgetSizeKey };

export const SD_GRID_SCHEMA_VERSION = "sd-grid/2026-05-22";
export const SD_GRID_CELL = 60;
export const SD_GRID_GAP = 30;
export const SD_GRID_PITCH = SD_GRID_CELL + SD_GRID_GAP;
export const SD_GRID_MAX_COLUMNS = 14;

export interface SdGridSpec {
  cell: number;
  gap: number;
  columns: number;
}

export interface SdGridRect {
  sizeKey: SdWidgetSizeKey;
  width: number;
  height: number;
  cols: number;
  rows: number;
}

export interface SdGridLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  sizeKey: SdWidgetSizeKey;
}

export const SD_GRID_DEFAULT_SPEC: SdGridSpec = {
  cell: SD_GRID_CELL,
  gap: SD_GRID_GAP,
  columns: 4,
};

const positiveInteger = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0
    ? Math.max(1, Math.floor(value))
    : fallback;

export const resolveSdGridRect = (
  sizeKey: SdWidgetSizeKey,
): SdGridRect => {
  const size = resolveSdWidgetSize(sizeKey);
  return {
    sizeKey,
    width: size.width,
    height: size.height,
    cols: size.colSpan,
    rows: size.rowSpan,
  };
};

export const resolveSdGridContainerWidth = (
  columns: number,
  spec: Pick<SdGridSpec, "cell" | "gap"> = SD_GRID_DEFAULT_SPEC,
) => {
  const safeColumns = positiveInteger(columns, SD_GRID_DEFAULT_SPEC.columns);
  return safeColumns * spec.cell + (safeColumns + 1) * spec.gap;
};

export const resolveSdGridColumns = (
  availableWidth: number,
  maxColumns = SD_GRID_MAX_COLUMNS,
  spec: Pick<SdGridSpec, "cell" | "gap"> = SD_GRID_DEFAULT_SPEC,
) => {
  const safeAvailable = Number.isFinite(availableWidth) ? availableWidth : 0;
  const fit = Math.floor((safeAvailable - spec.gap) / (spec.cell + spec.gap));
  return Math.max(
    1,
    Math.min(positiveInteger(maxColumns, SD_GRID_MAX_COLUMNS), fit),
  );
};

export const resolveSdGridTrackColumns = (
  availableWidth: number,
  maxColumns = SD_GRID_MAX_COLUMNS,
  spec: Pick<SdGridSpec, "cell" | "gap"> = SD_GRID_DEFAULT_SPEC,
) => {
  const safeAvailable = Number.isFinite(availableWidth) ? availableWidth : 0;
  const fit = Math.floor(safeAvailable / (spec.cell + spec.gap));
  return Math.max(
    1,
    Math.min(positiveInteger(maxColumns, SD_GRID_MAX_COLUMNS), fit),
  );
};

export const isSdWidgetSizeKey = (
  value: unknown,
): value is SdWidgetSizeKey =>
  typeof value === "string" &&
  SD_WIDGET_SIZE_BY_KEY.has(value as SdWidgetSizeKey);

export const resolveSdWidgetSizeKey = (
  input: Pick<WidgetConfig, "w" | "h" | "colSpan" | "rowSpan" | "data">,
  fallback: SdWidgetSizeKey = "1x2",
): SdWidgetSizeKey => {
  const data = input.data && typeof input.data === "object" ? input.data : {};
  if (isSdWidgetSizeKey((data as { sizeKey?: unknown }).sizeKey)) {
    return (data as { sizeKey: SdWidgetSizeKey }).sizeKey;
  }
  return (
    toSdWidgetSizeKey({
      colSpan: input.w ?? input.colSpan,
      rowSpan: input.h ?? input.rowSpan,
    }) || fallback
  );
};

export const resolveSdGridLayout = (
  widget: Pick<
    WidgetConfig,
    "x" | "y" | "w" | "h" | "colSpan" | "rowSpan" | "data"
  >,
): SdGridLayout => {
  const sizeKey = resolveSdWidgetSizeKey(widget);
  const rect = resolveSdGridRect(sizeKey);
  return {
    x: Math.max(0, Math.floor(widget.x ?? 0)),
    y: Math.max(0, Math.floor(widget.y ?? 0)),
    w: rect.cols,
    h: rect.rows,
    sizeKey,
  };
};

export const withSdGridData = <T extends WidgetConfig>(
  widget: T,
  sizeKey?: SdWidgetSizeKey,
): T => {
  const resolvedSizeKey = sizeKey || resolveSdWidgetSizeKey(widget);
  const rect = resolveSdGridRect(resolvedSizeKey);
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
      layoutSystem: SD_GRID_SCHEMA_VERSION,
      sizeKey: resolvedSizeKey,
    },
  };
  delete normalized.layouts;
  return normalized;
};

export const hasSdGridSchema = (widget: WidgetConfig) =>
  widget.data &&
  typeof widget.data === "object" &&
  (widget.data as { layoutSystem?: unknown }).layoutSystem ===
    SD_GRID_SCHEMA_VERSION;
