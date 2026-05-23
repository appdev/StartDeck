export type ItabWidgetSizeKey = "1x1" | "1x2" | "2x1" | "2x2" | "2x4";

export interface ItabWidgetSizePreset {
  key: ItabWidgetSizeKey;
  label: ItabWidgetSizeKey;
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
  scope: "itab";
  default?: boolean;
  max?: boolean;
}

export const ITAB_WIDGET_SIZE_KEYS = [
  "1x1",
  "1x2",
  "2x1",
  "2x2",
  "2x4",
] as const satisfies readonly ItabWidgetSizeKey[];

export const ITAB_WIDGET_SIZE_CANDIDATES: ItabWidgetSizePreset[] = [
  {
    key: "1x1",
    label: "1x1",
    colSpan: 1,
    rowSpan: 1,
    width: 60,
    height: 60,
    density: "compact",
    pattern: "text",
    scope: "itab",
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
    scope: "itab",
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
    scope: "itab",
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
    scope: "itab",
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
    scope: "itab",
    max: true,
  },
];

export const ITAB_WIDGET_SIZE_BY_KEY = new Map(
  ITAB_WIDGET_SIZE_CANDIDATES.map((size) => [size.key, size] as const),
);

export const resolveItabWidgetSize = (sizeKey: ItabWidgetSizeKey) => {
  const size = ITAB_WIDGET_SIZE_BY_KEY.get(sizeKey);
  if (!size) throw new Error(`Unknown iTab widget size: ${sizeKey}`);
  return size;
};

export const toItabWidgetSizeKey = (size: {
  colSpan?: number;
  rowSpan?: number;
}): ItabWidgetSizeKey | undefined => {
  return ITAB_WIDGET_SIZE_CANDIDATES.find(
    (candidate) =>
      candidate.colSpan === size.colSpan && candidate.rowSpan === size.rowSpan,
  )?.key;
};
