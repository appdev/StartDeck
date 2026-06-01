import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";

export const SD_TODO_WIDGET_TYPE = "sd-todo-17";
export const SD_TODO_CATALOG_ID = "todo";
export const SD_TODO_RUNTIME = "sd-todo";
export const SD_TODO_DATA_VERSION = 1;
export type SdTodoSizeKey = SdWidgetSizeKey | "4x4";
export const SD_TODO_DEFAULT_SIZE: SdTodoSizeKey = "2x2";

export interface SdTodoTask {
  id: string;
  text: string;
  done: boolean;
}

export interface SdTodoWidgetData {
  runtime: typeof SD_TODO_RUNTIME;
  layoutSystem?: string;
  version: typeof SD_TODO_DATA_VERSION;
  sizeKey: SdTodoSizeKey;
  tasks: SdTodoTask[];
}
