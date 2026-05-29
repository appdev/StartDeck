import {
  ITAB_WIDGET_SIZE_KEYS,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { ITAB_GENERATED_REGISTRY } from "@/features/itab-widgets/generated/itabRegistry.generated";

export type ItabDataKind =
  | "weather"
  | "calendar"
  | "memo"
  | "movieCalendar"
  | "poem"
  | "clock"
  | "dailyEnglish"
  | "foodPicker"
  | "wallpaper"
  | "todo"
  | "pomodoro"
  | "numberUppercase";

export interface ItabWidgetRegistryEntry {
  id: string;
  type: string;
  title: string;
  description: string;
  glyph: string;
  captureIndex: number;
  mode: "multi";
  source: "itab-capture";
  dataKind: ItabDataKind;
  defaultSize: ItabWidgetSizeKey;
  supportedSizes: ItabWidgetSizeKey[];
  fixtureKey: string;
  persistedData: {
    namespace: "itab";
    captureIndex: number;
    catalogId: string;
    localStateKey: string;
    adapterKind: ItabDataKind;
  };
}

const isItabSizeList = (
  values: readonly string[],
): values is readonly ItabWidgetSizeKey[] =>
  values.length === ITAB_WIDGET_SIZE_KEYS.length &&
  ITAB_WIDGET_SIZE_KEYS.every((key) => values.includes(key));

export const ITAB_WIDGET_REGISTRY: ItabWidgetRegistryEntry[] =
  ITAB_GENERATED_REGISTRY.map((item) => {
    if (!isItabSizeList(item.supportedSizes)) {
      throw new Error(`Invalid generated iTab sizes for ${item.type}`);
    }
    return {
      ...item,
      source: "itab-capture",
      dataKind: item.dataKind as ItabDataKind,
      defaultSize: item.defaultSize as ItabWidgetSizeKey,
      supportedSizes: [...item.supportedSizes],
      persistedData: {
        ...item.persistedData,
        adapterKind: item.persistedData.adapterKind as ItabDataKind,
      },
    };
  });

export const ITAB_WIDGET_REGISTRY_BY_TYPE = new Map(
  ITAB_WIDGET_REGISTRY.map((item) => [item.type, item] as const),
);

export const ITAB_WIDGET_REGISTRY_BY_ID = new Map(
  ITAB_WIDGET_REGISTRY.map((item) => [item.id, item] as const),
);

export const isItabWidgetType = (type: string | undefined): type is string =>
  !!type && ITAB_WIDGET_REGISTRY_BY_TYPE.has(type);

export const resolveItabWidgetEntry = (type: string) =>
  ITAB_WIDGET_REGISTRY_BY_TYPE.get(type);
