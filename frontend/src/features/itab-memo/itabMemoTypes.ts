import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export const ITAB_MEMO_WIDGET_TYPE = "itab-memo-04";
export const ITAB_MEMO_CATALOG_ID = "memo";
export const ITAB_MEMO_RUNTIME = "itab-memo";
export const ITAB_MEMO_DATA_VERSION = 1;
export const ITAB_MEMO_DEFAULT_SIZE: ItabWidgetSizeKey = "2x2";

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
  sizeKey: ItabWidgetSizeKey;
  notes: ItabMemoNote[];
  activeNoteId?: string;
}
