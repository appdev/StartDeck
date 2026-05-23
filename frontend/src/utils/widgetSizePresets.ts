export type WidgetSizeKey = "1x1" | "1x2" | "2x1" | "2x2" | "2x4";

export type WidgetSizeDensity = "compact" | "medium" | "large" | "board";
export type WidgetSizePattern =
  | "text"
  | "toolbar"
  | "list"
  | "grid"
  | "chart"
  | "gauge"
  | "preview"
  | "action-list";

export type StartDeckWidgetSizeKey = WidgetSizeKey;
export type CatalogWidgetSizeKey = StartDeckWidgetSizeKey;

export interface WidgetSize {
  colSpan: number;
  rowSpan: number;
}

export interface WidgetSizePreset extends WidgetSize {
  key: WidgetSizeKey;
  label: string;
  density: WidgetSizeDensity;
  pattern: WidgetSizePattern;
  scope?: "itab";
  default?: boolean;
  max?: boolean;
}

export type CatalogWidgetSizePreset = WidgetSizePreset & {
  scope?: "itab";
};

export interface DisabledWidgetSizePreset extends WidgetSizePreset {
  reason: string;
}

export interface WidgetSizeFamily {
  type: string;
  scope?: "itab";
  supported: CatalogWidgetSizePreset[];
  disabled: DisabledWidgetSizePreset[];
  defaultSize: WidgetSize;
  maxSize: WidgetSize;
  hardLimitLabel?: string;
}

export const WIDGET_SIZE_CANDIDATE_KEYS = [
  "1x1",
  "1x2",
  "2x1",
  "2x2",
  "2x4",
] as const satisfies readonly WidgetSizeKey[];

export const WIDGET_SIZE_CANDIDATES: WidgetSizePreset[] = [
  {
    key: "1x1",
    colSpan: 1,
    rowSpan: 1,
    label: "1x1",
    density: "compact",
    pattern: "text",
  },
  {
    key: "1x2",
    colSpan: 2,
    rowSpan: 1,
    label: "1x2",
    density: "medium",
    pattern: "toolbar",
  },
  {
    key: "2x1",
    colSpan: 1,
    rowSpan: 2,
    label: "2x1",
    density: "medium",
    pattern: "list",
  },
  {
    key: "2x2",
    colSpan: 2,
    rowSpan: 2,
    label: "2x2",
    density: "large",
    pattern: "grid",
  },
  {
    key: "2x4",
    colSpan: 4,
    rowSpan: 2,
    label: "2x4",
    density: "board",
    pattern: "action-list",
    max: true,
  },
];

const candidateByKey = new Map(
  WIDGET_SIZE_CANDIDATES.map((size) => [size.key, size]),
);

const defineFamily = (
  type: string,
  supportedKeys: WidgetSizeKey[],
  defaultKey: WidgetSizeKey = supportedKeys[0]!,
  hardLimitLabel?: string,
): WidgetSizeFamily => {
  const supported = supportedKeys.map((key) => {
    const candidate = candidateByKey.get(key);
    if (!candidate) throw new Error(`Unknown widget size key: ${key}`);
    return {
      ...candidate,
      scope: "itab" as const,
      default: key === defaultKey,
      max: key === supportedKeys[supportedKeys.length - 1],
    };
  });
  const supportedKeySet = new Set(supportedKeys);
  const disabled = WIDGET_SIZE_CANDIDATES.filter(
    (candidate) => !supportedKeySet.has(candidate.key),
  ).map((candidate) => ({
    ...candidate,
    scope: "itab" as const,
    reason: hardLimitLabel
      ? `${hardLimitLabel}，该尺寸不可用`
      : "该组件不支持此尺寸",
  }));
  const defaultPreset =
    supported.find((size) => size.key === defaultKey) || supported[0]!;
  const maxPreset = supported[supported.length - 1]!;

  return {
    type,
    scope: "itab",
    supported,
    disabled,
    defaultSize: {
      colSpan: defaultPreset.colSpan,
      rowSpan: defaultPreset.rowSpan,
    },
    maxSize: {
      colSpan: maxPreset.colSpan,
      rowSpan: maxPreset.rowSpan,
    },
    hardLimitLabel,
  };
};

const allItabSizes: WidgetSizeKey[] = ["1x1", "1x2", "2x1", "2x2", "2x4"];

const widgetSizeFamilyList = [
  defineFamily("search", allItabSizes, "1x2"),
  defineFamily("div-card", allItabSizes, "1x1"),
  defineFamily("bookmarks", allItabSizes, "2x2"),
  defineFamily("iframe", allItabSizes, "2x2"),
  defineFamily("custom-css", allItabSizes, "1x1"),
  defineFamily("countdown", allItabSizes, "1x1"),
  defineFamily("countup", allItabSizes, "1x1"),
  defineFamily("calculator", allItabSizes, "2x2"),
  defineFamily("file-transfer", allItabSizes, "2x2"),
  defineFamily("hot", allItabSizes, "2x2"),
  defineFamily("rss", allItabSizes, "2x2"),
  defineFamily("docker", allItabSizes, "2x2"),
  defineFamily("system-status", allItabSizes, "1x1"),
  defineFamily("ip", allItabSizes, "1x2"),
  defineFamily("status-monitor", allItabSizes, "2x2"),
] as const;

export const WIDGET_SIZE_FAMILIES: Record<string, WidgetSizeFamily> =
  Object.fromEntries(
    widgetSizeFamilyList.map((family) => [family.type, family]),
  );

export const WIDGET_SIZE_FAMILY_TYPES = widgetSizeFamilyList.map(
  (family) => family.type,
);

export const WIDGET_FUNCTIONAL_FACE_MATRIX: Record<
  string,
  Partial<Record<WidgetSizeKey, string>>
> = {
  search: {
    "1x1": "search-launcher",
    "1x2": "search-active-input",
    "2x4": "search-engine-menu-preview",
  },
  "div-card": {
    "1x1": "div-card-link-tile",
    "1x2": "div-card-edit-strip",
  },
  bookmarks: {
    "1x1": "bookmarks-recent-link",
    "1x2": "bookmarks-search-category",
    "2x2": "bookmarks-category-list",
    "2x4": "bookmarks-management-board",
  },
  iframe: {
    "2x2": "iframe-loading-frame",
    "1x2": "iframe-blocked-fit",
    "2x4": "iframe-browser-workspace",
  },
  "custom-css": {
    "1x1": "custom-mini-preview",
    "2x2": "custom-editor-preview",
    "2x1": "custom-code-split",
    "2x4": "custom-workbench",
  },
  countdown: {
    "1x1": "countdown-compact-timer",
    "2x1": "countdown-style-strip",
    "2x2": "countdown-settings-state",
  },
  countup: {
    "1x1": "countup-running-compact",
    "2x1": "countup-control-strip",
    "2x2": "countup-format-panel",
  },
  calculator: {
    "1x1": "calculator-condensed-keypad",
    "1x2": "calculator-wide-keypad",
    "2x2": "calculator-full",
    "2x4": "calculator-wide-board",
  },
  "file-transfer": {
    "1x2": "file-transfer-chat-composer",
    "2x2": "file-transfer-queue-panel",
    "2x1": "file-transfer-files-manage",
    "2x4": "file-transfer-split",
  },
  hot: {
    "1x1": "hot-top-rank",
    "1x2": "hot-tabs-strip",
    "2x2": "hot-ranked-list",
    "2x1": "hot-refresh-state",
    "2x4": "hot-board",
  },
  rss: {
    "1x2": "rss-feed-strip",
    "2x2": "rss-article-list",
    "2x1": "rss-reading-preview",
    "2x4": "rss-board",
  },
  docker: {
    "1x1": "docker-compact-containers",
    "2x2": "docker-container-list",
    "2x4": "docker-ports-stats",
  },
  "system-status": {
    "1x1": "system-status-cpu-memory",
    "2x1": "system-status-telemetry-strip",
    "2x2": "system-status-gauge-board",
  },
  ip: {
    "1x1": "ip-wan-copy-card",
    "2x1": "ip-wan-lan-strip",
    "2x2": "ip-network-detail",
  },
  "status-monitor": {
    "1x1": "status-monitor-compact-runtime",
    "2x2": "status-monitor-floating-panel",
    "2x4": "status-monitor-runtime-sparkline",
  },
};

export const resolveWidgetFunctionalFace = (
  type: string,
  sizeKey: CatalogWidgetSizeKey,
) => WIDGET_FUNCTIONAL_FACE_MATRIX[type]?.[sizeKey];

export const toWidgetSizeKey = (
  size: WidgetSize,
): WidgetSizeKey | undefined => {
  return WIDGET_SIZE_CANDIDATES.find(
    (candidate) =>
      candidate.colSpan === size.colSpan && candidate.rowSpan === size.rowSpan,
  )?.key;
};

export const toCatalogWidgetSizeKey = (
  type: string,
  size: WidgetSize,
): CatalogWidgetSizeKey | undefined => {
  return resolveWidgetSizeFamily(type).supported.find(
    (candidate) =>
      candidate.colSpan === size.colSpan && candidate.rowSpan === size.rowSpan,
  )?.key;
};

export const formatWidgetSize = (size: WidgetSize) => {
  const format = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${format(size.colSpan)}x${format(size.rowSpan)}`;
};

export const resolveWidgetSizeFamily = (type: string): WidgetSizeFamily => {
  const family = WIDGET_SIZE_FAMILIES[type];
  if (family) return family;

  return defineFamily(type, allItabSizes, "1x1");
};

export const resolveWidgetDefaultSize = (type: string): WidgetSize => {
  const { defaultSize } = resolveWidgetSizeFamily(type);
  return { ...defaultSize };
};
