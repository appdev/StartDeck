import {
  ITAB_WIDGET_SIZE_BY_KEY,
  resolveItabWidgetSize,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import type { WidgetConfig } from "@/types";
import type {
  ItabWallpaperEntry,
  ItabWallpaperSettings,
  ItabWallpaperState,
  ItabWallpaperWidgetData,
} from "./itabWallpaperTypes";
import {
  ITAB_WALLPAPER_CATALOG_ID,
  ITAB_WALLPAPER_DATA_VERSION,
  ITAB_WALLPAPER_DEFAULT_SIZE,
  ITAB_WALLPAPER_RUNTIME,
  ITAB_WALLPAPER_WIDGET_TYPE,
} from "./itabWallpaperTypes";

export const DEFAULT_ITAB_WALLPAPER_VISIBLE_COUNT = 12;
export const DEFAULT_ITAB_WALLPAPER_PAGE_SIZE = 24;

const COPYRIGHT_VISIBLE_SIZES = new Set<ItabWidgetSizeKey>([
  "1x2",
  "2x2",
  "2x4",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const asBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;
const asNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const isItabWallpaperCopyrightVisible = (sizeKey: ItabWidgetSizeKey) =>
  COPYRIGHT_VISIBLE_SIZES.has(sizeKey);

export const isItabWallpaperSizeKey = (
  value: unknown,
): value is ItabWidgetSizeKey =>
  typeof value === "string" &&
  ITAB_WIDGET_SIZE_BY_KEY.has(value as ItabWidgetSizeKey);

export const readItabWallpaperState = (data: unknown): ItabWallpaperState => {
  if (!isRecord(data)) return {};
  const itab = isRecord(data.itab) ? data.itab : undefined;
  const rawState = isRecord(itab?.state) ? itab.state : {};
  return {
    selectedWallpaperId: asString(rawState.selectedWallpaperId),
    selectedWallpaperTitle: asString(rawState.selectedWallpaperTitle),
    wallpaperUrl: asString(rawState.wallpaperUrl),
    wallpaperThumbnailUrl: asString(rawState.wallpaperThumbnailUrl),
    dailyAutoUpdate:
      typeof rawState.dailyAutoUpdate === "boolean"
        ? rawState.dailyAutoUpdate
        : undefined,
    dimWallpaper:
      typeof rawState.dimWallpaper === "boolean"
        ? rawState.dimWallpaper
        : undefined,
    blurLevel:
      typeof rawState.blurLevel === "number" &&
      Number.isFinite(rawState.blurLevel)
        ? rawState.blurLevel
        : undefined,
    updatedAt: asString(rawState.updatedAt),
  };
};

export const resolveItabWallpaperSettings = (
  state: ItabWallpaperState,
): ItabWallpaperSettings => ({
  dailyAutoUpdate: asBoolean(state.dailyAutoUpdate, true),
  dimWallpaper: asBoolean(state.dimWallpaper, false),
  blurLevel: Math.min(20, Math.max(0, asNumber(state.blurLevel, 0))),
});

export const patchItabWallpaperData = (
  data: unknown,
  entry: ItabWallpaperEntry,
  settings: ItabWallpaperSettings,
  updatedAt = new Date().toISOString(),
): Record<string, unknown> => {
  const root = isRecord(data) ? { ...data } : {};
  const itab = isRecord(root.itab) ? { ...root.itab } : {};
  const state = isRecord(itab.state) ? { ...itab.state } : {};

  return {
    ...root,
    itab: {
      ...itab,
      state: {
        ...state,
        selectedWallpaperId: entry.id,
        selectedWallpaperTitle: entry.title,
        wallpaperUrl: entry.downloadUrl,
        wallpaperThumbnailUrl: entry.thumbnailUrl,
        dailyAutoUpdate: settings.dailyAutoUpdate,
        dimWallpaper: settings.dimWallpaper,
        blurLevel: settings.blurLevel,
        updatedAt,
      },
    },
  };
};

export const normalizeItabWallpaperWidgetData = (
  raw: unknown,
): ItabWallpaperWidgetData => {
  const root = isRecord(raw) ? raw : {};
  const itab = isRecord(root.itab) ? root.itab : {};
  const state = isRecord(itab.state) ? itab.state : {};
  const sizeKey = isItabWallpaperSizeKey(root.sizeKey)
    ? root.sizeKey
    : ITAB_WALLPAPER_DEFAULT_SIZE;

  return {
    ...root,
    runtime: ITAB_WALLPAPER_RUNTIME,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    version: ITAB_WALLPAPER_DATA_VERSION,
    sizeKey,
    itab: {
      namespace: "itab",
      captureIndex: 16,
      catalogId: ITAB_WALLPAPER_WIDGET_TYPE,
      localStateKey: "itab.wallpaper.16",
      adapterKind: "wallpaper",
      state: {
        progress: 0.8,
        updatedAt: "2026-05-20T23:40:00+08:00",
        ...state,
      },
    },
  };
};

export const createDefaultItabWallpaperWidget = (): WidgetConfig => {
  const size = resolveItabWidgetSize(ITAB_WALLPAPER_DEFAULT_SIZE);
  return {
    id: ITAB_WALLPAPER_CATALOG_ID,
    type: ITAB_WALLPAPER_WIDGET_TYPE,
    enable: true,
    isPublic: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: normalizeItabWallpaperWidgetData({}),
  };
};

export const applyItabWallpaperSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: ItabWidgetSizeKey,
) => {
  const size = resolveItabWidgetSize(sizeKey);
  const data = normalizeItabWallpaperWidgetData(widget.data);
  widget.type = ITAB_WALLPAPER_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: ITAB_GRID_SCHEMA_VERSION,
    sizeKey,
  };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};
