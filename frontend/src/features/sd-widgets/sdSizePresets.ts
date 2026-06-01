export type SdWidgetSizeKey = "1x1" | "1x2" | "2x1" | "2x2" | "2x4";

export interface SdWidgetSizePreset {
  key: SdWidgetSizeKey;
  label: SdWidgetSizeKey;
  colSpan: number;
  rowSpan: number;
  width: number;
  height: number;
  density: "compact" | "medium" | "large" | "board";
  pattern:
    | "text"
    | "toolbar"
    | "list"
    | "grid"
    | "chart"
    | "gauge"
    | "preview"
    | "action-list";
  scope: "sd";
  default?: boolean;
  max?: boolean;
}

export const SD_WIDGET_SIZE_KEYS = [
  "1x1",
  "1x2",
  "2x1",
  "2x2",
  "2x4",
] as const satisfies readonly SdWidgetSizeKey[];

export const SD_WIDGET_SIZE_CANDIDATES: SdWidgetSizePreset[] = [
  {
    key: "1x1",
    label: "1x1",
    colSpan: 1,
    rowSpan: 1,
    width: 60,
    height: 60,
    density: "compact",
    pattern: "text",
    scope: "sd",
  },
  {
    key: "1x2",
    label: "1x2",
    colSpan: 2,
    rowSpan: 1,
    width: 150,
    height: 60,
    density: "medium",
    pattern: "toolbar",
    scope: "sd",
    default: true,
  },
  {
    key: "2x1",
    label: "2x1",
    colSpan: 1,
    rowSpan: 2,
    width: 60,
    height: 150,
    density: "medium",
    pattern: "list",
    scope: "sd",
  },
  {
    key: "2x2",
    label: "2x2",
    colSpan: 2,
    rowSpan: 2,
    width: 150,
    height: 150,
    density: "large",
    pattern: "grid",
    scope: "sd",
  },
  {
    key: "2x4",
    label: "2x4",
    colSpan: 4,
    rowSpan: 2,
    width: 330,
    height: 150,
    density: "board",
    pattern: "action-list",
    scope: "sd",
    max: true,
  },
];

export const SD_WIDGET_SIZE_BY_KEY = new Map(
  SD_WIDGET_SIZE_CANDIDATES.map((size) => [size.key, size] as const),
);

export const resolveSdWidgetSize = (sizeKey: SdWidgetSizeKey) => {
  const size = SD_WIDGET_SIZE_BY_KEY.get(sizeKey);
  if (!size) throw new Error(`Unknown widget size: ${sizeKey}`);
  return size;
};

export const toSdWidgetSizeKey = (size: {
  colSpan?: number;
  rowSpan?: number;
}): SdWidgetSizeKey | undefined => {
  return SD_WIDGET_SIZE_CANDIDATES.find(
    (candidate) =>
      candidate.colSpan === size.colSpan && candidate.rowSpan === size.rowSpan,
  )?.key;
};
