import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";

export const SD_MEMO_WIDGET_TYPE = "sd-memo-04";
export const SD_MEMO_CATALOG_ID = "memo";
export const SD_MEMO_RUNTIME = "sd-memo";
export const SD_MEMO_DATA_VERSION = 1;
export type SdMemoSizeKey = SdWidgetSizeKey | "4x4";
export const SD_MEMO_DEFAULT_SIZE: SdMemoSizeKey = "2x2";

export interface SdMemoNote {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  listTime?: string;
}

export interface SdMemoWidgetData {
  runtime: typeof SD_MEMO_RUNTIME;
  layoutSystem?: string;
  version: typeof SD_MEMO_DATA_VERSION;
  sizeKey: SdMemoSizeKey;
  notes: SdMemoNote[];
  activeNoteId?: string;
}
