import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";

export const ITAB_TODO_WIDGET_TYPE = "itab-todo-17";
export const ITAB_TODO_CATALOG_ID = "todo";
export const ITAB_TODO_RUNTIME = "itab-todo";
export const ITAB_TODO_DATA_VERSION = 1;
export type ItabTodoSizeKey = ItabWidgetSizeKey | "4x4";
export const ITAB_TODO_DEFAULT_SIZE: ItabTodoSizeKey = "2x2";

export interface ItabTodoTask {
  id: string;
  text: string;
  done: boolean;
}

export interface ItabTodoWidgetData {
  runtime: typeof ITAB_TODO_RUNTIME;
  layoutSystem?: string;
  version: typeof ITAB_TODO_DATA_VERSION;
  sizeKey: ItabTodoSizeKey;
  tasks: ItabTodoTask[];
}
