import {
  SD_WIDGET_SIZE_BY_KEY,
  resolveSdWidgetSize,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import type { WidgetConfig } from "@/types";
import type {
  SdWallpaperEntry,
  SdWallpaperSettings,
  SdWallpaperState,
  SdWallpaperWidgetData,
} from "./sdWallpaperTypes";
import {
  SD_WALLPAPER_CATALOG_ID,
  SD_WALLPAPER_DATA_VERSION,
  SD_WALLPAPER_DEFAULT_SIZE,
  SD_WALLPAPER_RUNTIME,
  SD_WALLPAPER_WIDGET_TYPE,
} from "./sdWallpaperTypes";

export const DEFAULT_SD_WALLPAPER_VISIBLE_COUNT = 12;
export const DEFAULT_SD_WALLPAPER_PAGE_SIZE = 24;

const COPYRIGHT_VISIBLE_SIZES = new Set<SdWidgetSizeKey>([
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

export const isSdWallpaperCopyrightVisible = (sizeKey: SdWidgetSizeKey) =>
  COPYRIGHT_VISIBLE_SIZES.has(sizeKey);

export const isSdWallpaperSizeKey = (
  value: unknown,
): value is SdWidgetSizeKey =>
  typeof value === "string" &&
  SD_WIDGET_SIZE_BY_KEY.has(value as SdWidgetSizeKey);

export const readSdWallpaperState = (data: unknown): SdWallpaperState => {
  if (!isRecord(data)) return {};
  const sd = isRecord(data.sd) ? data.sd : undefined;
  const rawState = isRecord(sd?.state) ? sd.state : {};
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

export const resolveSdWallpaperSettings = (
  state: SdWallpaperState,
): SdWallpaperSettings => ({
  dailyAutoUpdate: asBoolean(state.dailyAutoUpdate, true),
  dimWallpaper: asBoolean(state.dimWallpaper, false),
  blurLevel: Math.min(20, Math.max(0, asNumber(state.blurLevel, 0))),
});

export const createSdWallpaperEntryFromState = (
  state: SdWallpaperState,
): SdWallpaperEntry | null => {
  if (!state.selectedWallpaperId || !state.wallpaperUrl) return null;
  return {
    id: state.selectedWallpaperId,
    title: state.selectedWallpaperTitle || "必应每日壁纸",
    location: "",
    credit: "Bing",
    thumbnailUrl: state.wallpaperThumbnailUrl || state.wallpaperUrl,
    downloadUrl: state.wallpaperUrl,
  };
};

export const shouldApplySdWallpaperDailyAutoUpdate = (
  state: SdWallpaperState,
  settings: SdWallpaperSettings,
  latestWallpaper: SdWallpaperEntry | null | undefined,
) => {
  if (!settings.dailyAutoUpdate || !latestWallpaper) return false;
  if (!latestWallpaper.id || !latestWallpaper.downloadUrl) return false;
  if (!state.selectedWallpaperId && !state.wallpaperUrl) return false;
  return (
    state.selectedWallpaperId !== latestWallpaper.id ||
    state.wallpaperUrl !== latestWallpaper.downloadUrl
  );
};

export const patchSdWallpaperData = (
  data: unknown,
  entry: SdWallpaperEntry,
  settings: SdWallpaperSettings,
  updatedAt = new Date().toISOString(),
): Record<string, unknown> => {
  const root = isRecord(data) ? { ...data } : {};
  const sd = isRecord(root.sd) ? { ...root.sd } : {};
  const state = isRecord(sd.state) ? { ...sd.state } : {};

  return {
    ...root,
    sd: {
      ...sd,
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

export const patchSdWallpaperSettingsData = (
  data: unknown,
  settings: SdWallpaperSettings,
  updatedAt = new Date().toISOString(),
): Record<string, unknown> => {
  const root = isRecord(data) ? { ...data } : {};
  const sd = isRecord(root.sd) ? { ...root.sd } : {};
  const state = isRecord(sd.state) ? { ...sd.state } : {};

  return {
    ...root,
    sd: {
      ...sd,
      state: {
        ...state,
        dailyAutoUpdate: settings.dailyAutoUpdate,
        dimWallpaper: settings.dimWallpaper,
        blurLevel: settings.blurLevel,
        updatedAt,
      },
    },
  };
};

export const normalizeSdWallpaperWidgetData = (
  raw: unknown,
): SdWallpaperWidgetData => {
  const root = isRecord(raw) ? raw : {};
  const sd = isRecord(root.sd) ? root.sd : {};
  const state = isRecord(sd.state) ? sd.state : {};
  const sizeKey = isSdWallpaperSizeKey(root.sizeKey)
    ? root.sizeKey
    : SD_WALLPAPER_DEFAULT_SIZE;

  return {
    ...root,
    runtime: SD_WALLPAPER_RUNTIME,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    version: SD_WALLPAPER_DATA_VERSION,
    sizeKey,
    sd: {
      namespace: "sd",
      captureIndex: 16,
      catalogId: SD_WALLPAPER_WIDGET_TYPE,
      localStateKey: "sd.wallpaper.16",
      adapterKind: "wallpaper",
      state: { ...state },
    },
  };
};

export const createDefaultSdWallpaperWidget = (): WidgetConfig => {
  const size = resolveSdWidgetSize(SD_WALLPAPER_DEFAULT_SIZE);
  return {
    id: SD_WALLPAPER_CATALOG_ID,
    type: SD_WALLPAPER_WIDGET_TYPE,
    enable: true,
    colSpan: size.colSpan,
    rowSpan: size.rowSpan,
    w: size.colSpan,
    h: size.rowSpan,
    data: normalizeSdWallpaperWidgetData({}),
  };
};

export const applySdWallpaperSizeToWidget = (
  widget: WidgetConfig,
  sizeKey: SdWidgetSizeKey,
) => {
  const size = resolveSdWidgetSize(sizeKey);
  const data = normalizeSdWallpaperWidgetData(widget.data);
  widget.type = SD_WALLPAPER_WIDGET_TYPE;
  widget.data = {
    ...data,
    layoutSystem: SD_GRID_SCHEMA_VERSION,
    sizeKey,
  };
  widget.colSpan = size.colSpan;
  widget.rowSpan = size.rowSpan;
  widget.w = size.colSpan;
  widget.h = size.rowSpan;
};
