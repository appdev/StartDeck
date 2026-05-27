import {
  ITAB_WIDGET_SIZE_CANDIDATES,
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
  type ItabWidgetSizePreset,
} from "@/features/itab-widgets/itabSizePresets";
import {
  ITAB_WEATHER_DEFAULT_SIZE,
  ITAB_WEATHER_WIDGET_TYPE,
} from "@/features/itab-weather/itabWeatherTypes";
import {
  ITAB_TODO_DEFAULT_SIZE,
  ITAB_TODO_WIDGET_TYPE,
} from "@/features/itab-todo/itabTodoTypes";
import {
  ITAB_MEMO_DEFAULT_SIZE,
  ITAB_MEMO_WIDGET_TYPE,
} from "@/features/itab-memo/itabMemoTypes";
import {
  ITAB_CLOCK_DEFAULT_SIZE,
  ITAB_CLOCK_WIDGET_TYPE,
} from "@/features/itab-clock/itabClockTypes";
import {
  ITAB_DAILY_ENGLISH_DEFAULT_SIZE,
  ITAB_DAILY_ENGLISH_WIDGET_TYPE,
} from "@/features/itab-daily-english/itabDailyEnglishTypes";
import {
  ITAB_POEM_DEFAULT_SIZE,
  ITAB_POEM_WIDGET_TYPE,
} from "@/features/itab-poem/itabPoemTypes";
import {
  ITAB_POMODORO_DEFAULT_SIZE,
  ITAB_POMODORO_WIDGET_TYPE,
} from "@/features/itab-pomodoro/itabPomodoroTypes";
import {
  ITAB_ANNIVERSARY_DEFAULT_SIZE,
  ITAB_ANNIVERSARY_WIDGET_TYPE,
} from "@/features/itab-anniversary/itabAnniversaryTypes";
import {
  ITAB_WALLPAPER_DEFAULT_SIZE,
  ITAB_WALLPAPER_WIDGET_TYPE,
} from "@/features/itab-wallpaper/itabWallpaperTypes";
import {
  ITAB_MOVIE_CALENDAR_DEFAULT_SIZE,
  ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
} from "@/features/itab-movie-calendar/itabMovieCalendarTypes";
import {
  ITAB_IP_DEFAULT_SIZE,
  ITAB_IP_WIDGET_TYPE,
} from "@/features/itab-ip/itabIpTypes";
import {
  ITAB_CALENDAR_DEFAULT_SIZE,
  ITAB_CALENDAR_WIDGET_TYPE,
} from "@/features/itab-calendar/itabCalendarTypes";
import {
  ITAB_NUMBER_UPPERCASE_DEFAULT_SIZE,
  ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
} from "@/features/itab-number-uppercase/itabNumberUppercaseTypes";
import {
  ITAB_FOOD_PICKER_DEFAULT_SIZE,
  ITAB_FOOD_PICKER_WIDGET_TYPE,
} from "@/features/itab-food-picker/itabFoodPickerTypes";

export type RuntimeWidgetSizeScope = "itab";
export type RuntimeWidgetSizeKey = ItabWidgetSizeKey | "4x4";
export type RuntimeWidgetSizePreset = Omit<
  ItabWidgetSizePreset,
  "key" | "label"
> & {
  key: RuntimeWidgetSizeKey;
  label: RuntimeWidgetSizeKey;
};
export type RuntimeWidgetSizeCapability = "itab-default" | "large-board";

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
  scope: "itab",
  max: true,
};

export const RUNTIME_WIDGET_SIZE_CANDIDATES: RuntimeWidgetSizePreset[] = [
  ...ITAB_WIDGET_SIZE_CANDIDATES,
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
  "itab-default": DEFAULT_RUNTIME_WIDGET_SIZE_KEYS,
  "large-board": LARGE_BOARD_RUNTIME_WIDGET_SIZE_KEYS,
};

export const RUNTIME_WIDGET_LARGE_BOARD_TYPES = new Set<string>([
  ITAB_TODO_WIDGET_TYPE,
  ITAB_MEMO_WIDGET_TYPE,
]);

export const resolveRuntimeWidgetSizeCapability = (
  type: string,
): RuntimeWidgetSizeCapability =>
  RUNTIME_WIDGET_LARGE_BOARD_TYPES.has(type) ? "large-board" : "itab-default";

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

const createItabRuntimeSizeFamily = (
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
    scope: "itab",
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
  ["docker", createItabRuntimeSizeFamily("docker", "2x2")],
  ["system-status", createItabRuntimeSizeFamily("system-status", "1x1")],
  ["custom-css", createItabRuntimeSizeFamily("custom-css", "1x1")],
  [
    ITAB_WEATHER_WIDGET_TYPE,
    createItabRuntimeSizeFamily(
      ITAB_WEATHER_WIDGET_TYPE,
      ITAB_WEATHER_DEFAULT_SIZE,
    ),
  ],
  [
    ITAB_TODO_WIDGET_TYPE,
    createItabRuntimeSizeFamily(ITAB_TODO_WIDGET_TYPE, ITAB_TODO_DEFAULT_SIZE),
  ],
  [
    ITAB_MEMO_WIDGET_TYPE,
    createItabRuntimeSizeFamily(ITAB_MEMO_WIDGET_TYPE, ITAB_MEMO_DEFAULT_SIZE),
  ],
  [
    ITAB_CLOCK_WIDGET_TYPE,
    createItabRuntimeSizeFamily(
      ITAB_CLOCK_WIDGET_TYPE,
      ITAB_CLOCK_DEFAULT_SIZE,
    ),
  ],
  [
    ITAB_DAILY_ENGLISH_WIDGET_TYPE,
    createItabRuntimeSizeFamily(
      ITAB_DAILY_ENGLISH_WIDGET_TYPE,
      ITAB_DAILY_ENGLISH_DEFAULT_SIZE,
    ),
  ],
  [
    ITAB_POEM_WIDGET_TYPE,
    createItabRuntimeSizeFamily(ITAB_POEM_WIDGET_TYPE, ITAB_POEM_DEFAULT_SIZE),
  ],
  [
    ITAB_POMODORO_WIDGET_TYPE,
    createItabRuntimeSizeFamily(
      ITAB_POMODORO_WIDGET_TYPE,
      ITAB_POMODORO_DEFAULT_SIZE,
    ),
  ],
  [
    ITAB_ANNIVERSARY_WIDGET_TYPE,
    createItabRuntimeSizeFamily(
      ITAB_ANNIVERSARY_WIDGET_TYPE,
      ITAB_ANNIVERSARY_DEFAULT_SIZE,
    ),
  ],
  [
    ITAB_WALLPAPER_WIDGET_TYPE,
    createItabRuntimeSizeFamily(
      ITAB_WALLPAPER_WIDGET_TYPE,
      ITAB_WALLPAPER_DEFAULT_SIZE,
    ),
  ],
  [
    ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
    createItabRuntimeSizeFamily(
      ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
      ITAB_MOVIE_CALENDAR_DEFAULT_SIZE,
    ),
  ],
  [
    ITAB_IP_WIDGET_TYPE,
    createItabRuntimeSizeFamily(ITAB_IP_WIDGET_TYPE, ITAB_IP_DEFAULT_SIZE),
  ],
  [
    ITAB_CALENDAR_WIDGET_TYPE,
    createItabRuntimeSizeFamily(
      ITAB_CALENDAR_WIDGET_TYPE,
      ITAB_CALENDAR_DEFAULT_SIZE,
    ),
  ],
  [
    ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
    createItabRuntimeSizeFamily(
      ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
      ITAB_NUMBER_UPPERCASE_DEFAULT_SIZE,
    ),
  ],
  [
    ITAB_FOOD_PICKER_WIDGET_TYPE,
    createItabRuntimeSizeFamily(
      ITAB_FOOD_PICKER_WIDGET_TYPE,
      ITAB_FOOD_PICKER_DEFAULT_SIZE,
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
    )?.key || toItabWidgetSizeKey(size)
  );
};
