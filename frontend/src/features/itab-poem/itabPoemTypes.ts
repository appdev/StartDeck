import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export const ITAB_POEM_WIDGET_TYPE = "itab-poem-10";
export const ITAB_POEM_CATALOG_ID = "poem";
export const ITAB_POEM_RUNTIME = "itab-poem";
export const ITAB_POEM_DATA_VERSION = 1;
export const ITAB_POEM_DEFAULT_SIZE: ItabWidgetSizeKey = "2x2";

export interface ItabPoemWidgetData {
  runtime: typeof ITAB_POEM_RUNTIME;
  layoutSystem?: string;
  version: typeof ITAB_POEM_DATA_VERSION;
  sizeKey: ItabWidgetSizeKey;
  currentPoem?: ItabPoemApiData;
  paletteIndex?: number;
  paletteDate?: string;
}

export interface ItabPoemEntry {
  sentence: string;
  poemTitle: string;
  author: string;
  dynasty: string;
  fullText: string[];
  translation: string[];
  annotations: string[];
  preface: string[];
}

export interface ItabPoemApiData extends ItabPoemEntry {
  id?: string;
  popularity?: number;
  cacheAt?: string;
  sourceStatus?: "ok" | "stale" | "error" | string;
}

export interface ItabPoemPalette {
  background: string;
  waveBack: string;
  waveMiddle: string;
  waveFront: string;
}
