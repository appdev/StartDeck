import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export const ITAB_WALLPAPER_CATALOG_ID = "wallpaper";
export const ITAB_WALLPAPER_WIDGET_TYPE = "itab-wallpaper-16";
export const ITAB_WALLPAPER_RUNTIME = "itab-wallpaper";
export const ITAB_WALLPAPER_DATA_VERSION = 1;
export const ITAB_WALLPAPER_DEFAULT_SIZE: ItabWidgetSizeKey = "2x2";

export interface ItabWallpaperEntry {
  id: string;
  title: string;
  location: string;
  credit: string;
  thumbnailUrl: string;
  downloadUrl: string;
  sourceUrl?: string;
  bingTitle?: string;
  startDate?: string;
  endDate?: string;
  copyrightText?: string;
}

export interface ItabWallpaperSettings {
  dailyAutoUpdate: boolean;
  dimWallpaper: boolean;
  blurLevel: number;
}

export interface ItabWallpaperState {
  selectedWallpaperId?: string;
  selectedWallpaperTitle?: string;
  wallpaperUrl?: string;
  wallpaperThumbnailUrl?: string;
  dailyAutoUpdate?: boolean;
  dimWallpaper?: boolean;
  blurLevel?: number;
  updatedAt?: string;
}

export interface ItabWallpaperWidgetData extends Record<string, unknown> {
  runtime: typeof ITAB_WALLPAPER_RUNTIME;
  layoutSystem?: string;
  version: typeof ITAB_WALLPAPER_DATA_VERSION;
  sizeKey: ItabWidgetSizeKey;
  itab: {
    namespace: "itab";
    captureIndex: 16;
    catalogId: typeof ITAB_WALLPAPER_WIDGET_TYPE;
    localStateKey: "itab.wallpaper.16";
    adapterKind: "wallpaper";
    state: ItabWallpaperState & Record<string, unknown>;
  };
}

export interface ItabWallpaperApplyPayload {
  entry: ItabWallpaperEntry;
  result: "saved" | "no_change" | "conflict" | "unauthorized" | "queued";
}
