import {
  ITAB_WIDGET_SIZE_CANDIDATES,
  resolveItabWidgetSize,
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
  ITAB_CALENDAR_DEFAULT_SIZE,
  ITAB_CALENDAR_WIDGET_TYPE,
} from "@/features/itab-calendar/itabCalendarTypes";

export type RuntimeWidgetSizeScope = "itab";
export type RuntimeWidgetSizeKey = ItabWidgetSizeKey;
export type RuntimeWidgetSizePreset = ItabWidgetSizePreset;

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
}

const createItabRuntimeSizeFamily = (
  type: string,
  defaultSizeKey: RuntimeWidgetSizeKey,
): RuntimeWidgetSizeFamily => ({
  type,
  scope: "itab",
  supported: ITAB_WIDGET_SIZE_CANDIDATES,
  disabled: [],
  defaultSize: {
    colSpan: resolveItabWidgetSize(defaultSizeKey).colSpan,
    rowSpan: resolveItabWidgetSize(defaultSizeKey).rowSpan,
  },
  maxSize: {
    colSpan: resolveItabWidgetSize("2x4").colSpan,
    rowSpan: resolveItabWidgetSize("2x4").rowSpan,
  },
  defaultSizeKey,
});

const runtimeWidgetSizeFamilies = new Map<string, RuntimeWidgetSizeFamily>([
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
    ITAB_CALENDAR_WIDGET_TYPE,
    createItabRuntimeSizeFamily(
      ITAB_CALENDAR_WIDGET_TYPE,
      ITAB_CALENDAR_DEFAULT_SIZE,
    ),
  ],
]);

export const isRuntimeWidgetType = (type: string) =>
  runtimeWidgetSizeFamilies.has(type);

export const resolveRuntimeWidgetSizeFamily = (type: string) =>
  runtimeWidgetSizeFamilies.get(type);

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
  return toItabWidgetSizeKey({
    colSpan: input.colSpan,
    rowSpan: input.rowSpan,
  });
};

export const toRuntimeWidgetSizeKey = (
  type: string,
  size: { colSpan?: number; rowSpan?: number },
) => {
  if (!isRuntimeWidgetType(type)) return undefined;
  return toItabWidgetSizeKey(size);
};
