import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export const ITAB_MEMO_WIDGET_TYPE = "itab-memo-04";
export const ITAB_MEMO_CATALOG_ID = "memo";
export const ITAB_MEMO_RUNTIME = "itab-memo";
export const ITAB_MEMO_DATA_VERSION = 1;
export type ItabMemoSizeKey = ItabWidgetSizeKey | "4x4";
export const ITAB_MEMO_DEFAULT_SIZE: ItabMemoSizeKey = "2x2";

export interface ItabMemoNote {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  listTime?: string;
}

export interface ItabMemoWidgetData {
  runtime: typeof ITAB_MEMO_RUNTIME;
  layoutSystem?: string;
  version: typeof ITAB_MEMO_DATA_VERSION;
  sizeKey: ItabMemoSizeKey;
  notes: ItabMemoNote[];
  activeNoteId?: string;
}
