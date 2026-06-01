import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";

export const SD_WALLPAPER_CATALOG_ID = "wallpaper";
export const SD_WALLPAPER_WIDGET_TYPE = "sd-wallpaper-16";
export const SD_WALLPAPER_RUNTIME = "sd-wallpaper";
export const SD_WALLPAPER_DATA_VERSION = 1;
export const SD_WALLPAPER_DEFAULT_SIZE: SdWidgetSizeKey = "2x2";

export interface SdWallpaperEntry {
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

export interface SdWallpaperSettings {
  dailyAutoUpdate: boolean;
  dimWallpaper: boolean;
  blurLevel: number;
}

export interface SdWallpaperState {
  selectedWallpaperId?: string;
  selectedWallpaperTitle?: string;
  wallpaperUrl?: string;
  wallpaperThumbnailUrl?: string;
  dailyAutoUpdate?: boolean;
  dimWallpaper?: boolean;
  blurLevel?: number;
  updatedAt?: string;
}

export interface SdWallpaperWidgetData extends Record<string, unknown> {
  runtime: typeof SD_WALLPAPER_RUNTIME;
  layoutSystem?: string;
  version: typeof SD_WALLPAPER_DATA_VERSION;
  sizeKey: SdWidgetSizeKey;
  sd: {
    namespace: "sd";
    captureIndex: 16;
    catalogId: typeof SD_WALLPAPER_WIDGET_TYPE;
    localStateKey: "sd.wallpaper.16";
    adapterKind: "wallpaper";
    state: SdWallpaperState & Record<string, unknown>;
  };
}

export interface SdWallpaperApplyPayload {
  entry: SdWallpaperEntry;
  result: "saved" | "no_change" | "conflict" | "unauthorized" | "queued";
}
