import {
  SD_WIDGET_SIZE_KEYS,
  type SdWidgetSizeKey,
} from "@/features/sd-widgets/sdSizePresets";
import { SD_GENERATED_REGISTRY } from "@/features/sd-widgets/generated/sdRegistry.generated";

export type SdDataKind =
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

export interface SdWidgetRegistryEntry {
  id: string;
  type: string;
  title: string;
  description: string;
  glyph: string;
  captureIndex: number;
  mode: "multi";
  source: "sd-capture";
  dataKind: SdDataKind;
  defaultSize: SdWidgetSizeKey;
  supportedSizes: SdWidgetSizeKey[];
  fixtureKey: string;
  persistedData: {
    namespace: "sd";
    captureIndex: number;
    catalogId: string;
    localStateKey: string;
    adapterKind: SdDataKind;
  };
}

const isSdSizeList = (
  values: readonly string[],
): values is readonly SdWidgetSizeKey[] =>
  values.length === SD_WIDGET_SIZE_KEYS.length &&
  SD_WIDGET_SIZE_KEYS.every((key) => values.includes(key));

export const SD_WIDGET_REGISTRY: SdWidgetRegistryEntry[] =
  SD_GENERATED_REGISTRY.map((item) => {
    if (!isSdSizeList(item.supportedSizes)) {
      throw new Error(`Invalid generated source sizes for ${item.type}`);
    }
    return {
      ...item,
      source: "sd-capture",
      dataKind: item.dataKind as SdDataKind,
      defaultSize: item.defaultSize as SdWidgetSizeKey,
      supportedSizes: [...item.supportedSizes],
      persistedData: {
        ...item.persistedData,
        adapterKind: item.persistedData.adapterKind as SdDataKind,
      },
    };
  });

export const SD_WIDGET_REGISTRY_BY_TYPE = new Map(
  SD_WIDGET_REGISTRY.map((item) => [item.type, item] as const),
);

export const SD_WIDGET_REGISTRY_BY_ID = new Map(
  SD_WIDGET_REGISTRY.map((item) => [item.id, item] as const),
);

export const isSdWidgetType = (type: string | undefined): type is string =>
  !!type && SD_WIDGET_REGISTRY_BY_TYPE.has(type);

export const resolveSdWidgetEntry = (type: string) =>
  SD_WIDGET_REGISTRY_BY_TYPE.get(type);
