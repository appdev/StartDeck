import {
  SD_WIDGET_SIZE_CANDIDATES,
  toSdWidgetSizeKey,
  type SdWidgetSizeKey,
  type SdWidgetSizePreset,
} from "@/features/sd-widgets/sdSizePresets";
import {
  SD_WEATHER_DEFAULT_SIZE,
  SD_WEATHER_WIDGET_TYPE,
} from "@/features/sd-weather/sdWeatherTypes";
import {
  SD_TODO_DEFAULT_SIZE,
  SD_TODO_WIDGET_TYPE,
} from "@/features/sd-todo/sdTodoTypes";
import {
  SD_MEMO_DEFAULT_SIZE,
  SD_MEMO_WIDGET_TYPE,
} from "@/features/sd-memo/sdMemoTypes";
import {
  SD_CLOCK_DEFAULT_SIZE,
  SD_CLOCK_WIDGET_TYPE,
} from "@/features/sd-clock/sdClockTypes";
import {
  SD_DAILY_ENGLISH_DEFAULT_SIZE,
  SD_DAILY_ENGLISH_WIDGET_TYPE,
} from "@/features/sd-daily-english/sdDailyEnglishTypes";
import {
  SD_POEM_DEFAULT_SIZE,
  SD_POEM_WIDGET_TYPE,
} from "@/features/sd-poem/sdPoemTypes";
import {
  SD_POMODORO_DEFAULT_SIZE,
  SD_POMODORO_WIDGET_TYPE,
} from "@/features/sd-pomodoro/sdPomodoroTypes";
import {
  SD_ANNIVERSARY_DEFAULT_SIZE,
  SD_ANNIVERSARY_WIDGET_TYPE,
} from "@/features/sd-anniversary/sdAnniversaryTypes";
import {
  SD_WALLPAPER_DEFAULT_SIZE,
  SD_WALLPAPER_WIDGET_TYPE,
} from "@/features/sd-wallpaper/sdWallpaperTypes";
import {
  SD_MOVIE_CALENDAR_DEFAULT_SIZE,
  SD_MOVIE_CALENDAR_WIDGET_TYPE,
} from "@/features/sd-movie-calendar/sdMovieCalendarTypes";
import {
  SD_IP_DEFAULT_SIZE,
  SD_IP_WIDGET_TYPE,
} from "@/features/sd-ip/sdIpTypes";
import {
  SD_CALENDAR_DEFAULT_SIZE,
  SD_CALENDAR_WIDGET_TYPE,
} from "@/features/sd-calendar/sdCalendarTypes";
import {
  SD_NUMBER_UPPERCASE_DEFAULT_SIZE,
  SD_NUMBER_UPPERCASE_WIDGET_TYPE,
} from "@/features/sd-number-uppercase/sdNumberUppercaseTypes";
import {
  SD_FOOD_PICKER_DEFAULT_SIZE,
  SD_FOOD_PICKER_WIDGET_TYPE,
} from "@/features/sd-food-picker/sdFoodPickerTypes";
import {
  AI_USAGE_DEFAULT_SIZE,
  AI_USAGE_WIDGET_TYPE,
} from "@/features/ai-usage/aiUsageTypes";
import {
  TAPD_DEFECTS_DEFAULT_SIZE,
  TAPD_DEFECTS_WIDGET_TYPE,
} from "@/features/tapd-defects/tapdDefectTypes";

export type RuntimeWidgetSizeScope = "sd";
export type RuntimeWidgetSizeKey = SdWidgetSizeKey | "4x4";
export type RuntimeWidgetSizePreset = Omit<
  SdWidgetSizePreset,
  "key" | "label"
> & {
  key: RuntimeWidgetSizeKey;
  label: RuntimeWidgetSizeKey;
};
export type RuntimeWidgetSizeCapability = "sd-default" | "large-board";

export interface RuntimeWidgetSizeFamily {
  type: string;
  scope: RuntimeWidgetSizeScope;
  supported: RuntimeWidgetSizePreset[];
  disabled: RuntimeWidgetSizePreset[];
  defaultSize: {
    colSpan: number;
    rowSpan: number;
  };
  maxSize: {
    colSpan: number;
    rowSpan: number;
  };
  defaultSizeKey: RuntimeWidgetSizeKey;
  capability: RuntimeWidgetSizeCapability;
}

export const RUNTIME_WIDGET_4X4_SIZE: RuntimeWidgetSizePreset = {
  key: "4x4",
  label: "4x4",
  colSpan: 4,
  rowSpan: 4,
  width: 330,
  height: 330,
  density: "board",
  pattern: "grid",
  scope: "sd",
  max: true,
};

export const RUNTIME_WIDGET_SIZE_CANDIDATES: RuntimeWidgetSizePreset[] = [
  ...SD_WIDGET_SIZE_CANDIDATES,
  RUNTIME_WIDGET_4X4_SIZE,
];

const runtimeSizeByKey = new Map<RuntimeWidgetSizeKey, RuntimeWidgetSizePreset>(
  RUNTIME_WIDGET_SIZE_CANDIDATES.map((size) => [size.key, size]),
);

const DEFAULT_RUNTIME_WIDGET_SIZE_KEYS: RuntimeWidgetSizeKey[] = [
  "1x1",
  "1x2",
  "2x1",
  "2x2",
  "2x4",
];

const LARGE_BOARD_RUNTIME_WIDGET_SIZE_KEYS: RuntimeWidgetSizeKey[] = [
  ...DEFAULT_RUNTIME_WIDGET_SIZE_KEYS,
  "4x4",
];

const RUNTIME_WIDGET_SIZE_KEYS_BY_CAPABILITY: Record<
  RuntimeWidgetSizeCapability,
  RuntimeWidgetSizeKey[]
> = {
  "sd-default": DEFAULT_RUNTIME_WIDGET_SIZE_KEYS,
  "large-board": LARGE_BOARD_RUNTIME_WIDGET_SIZE_KEYS,
};

export const RUNTIME_WIDGET_LARGE_BOARD_TYPES = new Set<string>([
  SD_TODO_WIDGET_TYPE,
  SD_MEMO_WIDGET_TYPE,
]);

export const resolveRuntimeWidgetSizeCapability = (
  type: string,
): RuntimeWidgetSizeCapability =>
  RUNTIME_WIDGET_LARGE_BOARD_TYPES.has(type) ? "large-board" : "sd-default";

export const resolveRuntimeWidgetSize = (sizeKey: RuntimeWidgetSizeKey) => {
  const size = runtimeSizeByKey.get(sizeKey);
  if (!size) throw new Error(`Unknown runtime widget size: ${sizeKey}`);
  return size;
};

export const isRuntimeWidgetSizeSpan = (size: {
  colSpan?: number;
  rowSpan?: number;
}) =>
  RUNTIME_WIDGET_SIZE_CANDIDATES.some(
    (candidate) =>
      candidate.colSpan === size.colSpan && candidate.rowSpan === size.rowSpan,
  );

const resolveRuntimeSizeList = (keys: RuntimeWidgetSizeKey[]) =>
  keys.map(resolveRuntimeWidgetSize);

const createSdRuntimeSizeFamily = (
  type: string,
  defaultSizeKey: RuntimeWidgetSizeKey,
  capability: RuntimeWidgetSizeCapability = resolveRuntimeWidgetSizeCapability(
    type,
  ),
): RuntimeWidgetSizeFamily => {
  const supportedKeys = RUNTIME_WIDGET_SIZE_KEYS_BY_CAPABILITY[capability];
  const supported = resolveRuntimeSizeList(supportedKeys);
  const defaultSize = resolveRuntimeWidgetSize(defaultSizeKey);
  const maxSize = supported.reduce(
    (max, size) => ({
      colSpan: Math.max(max.colSpan, size.colSpan),
      rowSpan: Math.max(max.rowSpan, size.rowSpan),
    }),
    { colSpan: 1, rowSpan: 1 },
  );
  return {
    type,
    scope: "sd",
    supported,
    disabled: [],
    defaultSize: {
      colSpan: defaultSize.colSpan,
      rowSpan: defaultSize.rowSpan,
    },
    maxSize,
    defaultSizeKey,
    capability,
  };
};

const runtimeWidgetSizeFamilies = new Map<string, RuntimeWidgetSizeFamily>([
  ["docker", createSdRuntimeSizeFamily("docker", "2x2")],
  ["system-status", createSdRuntimeSizeFamily("system-status", "1x1")],
  ["custom-css", createSdRuntimeSizeFamily("custom-css", "1x1")],
  [
    SD_WEATHER_WIDGET_TYPE,
    createSdRuntimeSizeFamily(
      SD_WEATHER_WIDGET_TYPE,
      SD_WEATHER_DEFAULT_SIZE,
    ),
  ],
  [
    SD_TODO_WIDGET_TYPE,
    createSdRuntimeSizeFamily(SD_TODO_WIDGET_TYPE, SD_TODO_DEFAULT_SIZE),
  ],
  [
    SD_MEMO_WIDGET_TYPE,
    createSdRuntimeSizeFamily(SD_MEMO_WIDGET_TYPE, SD_MEMO_DEFAULT_SIZE),
  ],
  [
    SD_CLOCK_WIDGET_TYPE,
    createSdRuntimeSizeFamily(
      SD_CLOCK_WIDGET_TYPE,
      SD_CLOCK_DEFAULT_SIZE,
    ),
  ],
  [
    SD_DAILY_ENGLISH_WIDGET_TYPE,
    createSdRuntimeSizeFamily(
      SD_DAILY_ENGLISH_WIDGET_TYPE,
      SD_DAILY_ENGLISH_DEFAULT_SIZE,
    ),
  ],
  [
    SD_POEM_WIDGET_TYPE,
    createSdRuntimeSizeFamily(SD_POEM_WIDGET_TYPE, SD_POEM_DEFAULT_SIZE),
  ],
  [
    SD_POMODORO_WIDGET_TYPE,
    createSdRuntimeSizeFamily(
      SD_POMODORO_WIDGET_TYPE,
      SD_POMODORO_DEFAULT_SIZE,
    ),
  ],
  [
    SD_ANNIVERSARY_WIDGET_TYPE,
    createSdRuntimeSizeFamily(
      SD_ANNIVERSARY_WIDGET_TYPE,
      SD_ANNIVERSARY_DEFAULT_SIZE,
    ),
  ],
  [
    SD_WALLPAPER_WIDGET_TYPE,
    createSdRuntimeSizeFamily(
      SD_WALLPAPER_WIDGET_TYPE,
      SD_WALLPAPER_DEFAULT_SIZE,
    ),
  ],
  [
    SD_MOVIE_CALENDAR_WIDGET_TYPE,
    createSdRuntimeSizeFamily(
      SD_MOVIE_CALENDAR_WIDGET_TYPE,
      SD_MOVIE_CALENDAR_DEFAULT_SIZE,
    ),
  ],
  [
    SD_IP_WIDGET_TYPE,
    createSdRuntimeSizeFamily(SD_IP_WIDGET_TYPE, SD_IP_DEFAULT_SIZE),
  ],
  [
    SD_CALENDAR_WIDGET_TYPE,
    createSdRuntimeSizeFamily(
      SD_CALENDAR_WIDGET_TYPE,
      SD_CALENDAR_DEFAULT_SIZE,
    ),
  ],
  [
    SD_NUMBER_UPPERCASE_WIDGET_TYPE,
    createSdRuntimeSizeFamily(
      SD_NUMBER_UPPERCASE_WIDGET_TYPE,
      SD_NUMBER_UPPERCASE_DEFAULT_SIZE,
    ),
  ],
  [
    SD_FOOD_PICKER_WIDGET_TYPE,
    createSdRuntimeSizeFamily(
      SD_FOOD_PICKER_WIDGET_TYPE,
      SD_FOOD_PICKER_DEFAULT_SIZE,
    ),
  ],
  [
    AI_USAGE_WIDGET_TYPE,
    createSdRuntimeSizeFamily(AI_USAGE_WIDGET_TYPE, AI_USAGE_DEFAULT_SIZE),
  ],
  [
    TAPD_DEFECTS_WIDGET_TYPE,
    createSdRuntimeSizeFamily(
      TAPD_DEFECTS_WIDGET_TYPE,
      TAPD_DEFECTS_DEFAULT_SIZE,
    ),
  ],
]);

export const isRuntimeWidgetType = (type: string) =>
  runtimeWidgetSizeFamilies.has(type);

export const resolveRuntimeWidgetSizeFamily = (type: string) =>
  runtimeWidgetSizeFamilies.get(type);

export const supportsRuntimeWidgetSize = (
  type: string,
  sizeKey: RuntimeWidgetSizeKey,
) =>
  Boolean(
    resolveRuntimeWidgetSizeFamily(type)?.supported.some(
      (size) => size.key === sizeKey,
    ),
  );

export const resolveRuntimeWidgetSizeKey = (
  type: string,
  input: {
    sizeKey?: unknown;
    colSpan?: number;
    rowSpan?: number;
  },
): RuntimeWidgetSizeKey | undefined => {
  const family = resolveRuntimeWidgetSizeFamily(type);
  if (!family) return undefined;
  if (
    typeof input.sizeKey === "string" &&
    family.supported.some((size) => size.key === input.sizeKey)
  ) {
    return input.sizeKey as RuntimeWidgetSizeKey;
  }
  return family.supported.find(
    (candidate) =>
      candidate.colSpan === input.colSpan &&
      candidate.rowSpan === input.rowSpan,
  )?.key;
};

export const toRuntimeWidgetSizeKey = (
  type: string,
  size: { colSpan?: number; rowSpan?: number },
) => {
  const family = resolveRuntimeWidgetSizeFamily(type);
  if (!family) return undefined;
  return (
    family.supported.find(
      (candidate) =>
        candidate.colSpan === size.colSpan &&
        candidate.rowSpan === size.rowSpan,
    )?.key || toSdWidgetSizeKey(size)
  );
};
