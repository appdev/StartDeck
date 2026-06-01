import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";

export const SD_POEM_WIDGET_TYPE = "sd-poem-10";
export const SD_POEM_CATALOG_ID = "poem";
export const SD_POEM_RUNTIME = "sd-poem";
export const SD_POEM_DATA_VERSION = 1;
export const SD_POEM_DEFAULT_SIZE: SdWidgetSizeKey = "2x2";

export interface SdPoemWidgetData {
  runtime: typeof SD_POEM_RUNTIME;
  layoutSystem?: string;
  version: typeof SD_POEM_DATA_VERSION;
  sizeKey: SdWidgetSizeKey;
  currentPoem?: SdPoemApiData;
  paletteIndex?: number;
  paletteDate?: string;
}

export interface SdPoemEntry {
  sentence: string;
  poemTitle: string;
  author: string;
  dynasty: string;
  fullText: string[];
  translation: string[];
  annotations: string[];
  preface: string[];
}

export interface SdPoemApiData extends SdPoemEntry {
  id?: string;
  popularity?: number;
  cacheAt?: string;
  sourceStatus?: "ok" | "stale" | "error" | string;
}

export interface SdPoemPalette {
  background: string;
  waveBack: string;
  waveMiddle: string;
  waveFront: string;
}
