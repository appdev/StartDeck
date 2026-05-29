export type ItabReplicaWidgetSize = "1x1" | "1x2" | "2x1" | "2x2" | "2x4";

export type ItabReplicaWidgetKind =
  | "weather"
  | "calendar"
  | "memo"
  | "movie"
  | "poem"
  | "clock"
  | "today-english"
  | "eat-today"
  | "wallpaper"
  | "todo"
  | "tomato"
  | "number-uppercase";

export type ItabReplicaSizeAdaptation =
  | "source-sized-ui"
  | "icon-only"
  | "shared-layout";

export type ItabReplicaOpenSurface =
  | "dialog"
  | "external"
  | "none"
  | "optional";

export interface ItabReplicaOpenedShellMetadata {
  width: number;
  height: number;
  maxWidthInset: number;
  maxHeightInset: number;
  trafficVisible: boolean;
}

export type ItabReplicaOpenedShellOverride =
  Partial<ItabReplicaOpenedShellMetadata>;

export interface ItabReplicaWidgetDefinition {
  kind: ItabReplicaWidgetKind;
  defaultSize: ItabReplicaWidgetSize;
  supportedSizes: readonly ItabReplicaWidgetSize[];
  sizeAdaptation: ItabReplicaSizeAdaptation;
  openSurface: ItabReplicaOpenSurface;
  requiresSizeSpecificUi: boolean;
  iconOnlySizes?: readonly ItabReplicaWidgetSize[];
  openedShell?: ItabReplicaOpenedShellOverride;
}

export interface ItabReplicaWidgetSizeMenuOption {
  size: ItabReplicaWidgetSize;
  enabled: boolean;
  active: boolean;
}

export const ITAB_REPLICA_WIDGET_SIZE_OPTIONS = [
  "1x1",
  "1x2",
  "2x1",
  "2x2",
  "2x4",
] as const satisfies readonly ItabReplicaWidgetSize[];

const allSizes = ITAB_REPLICA_WIDGET_SIZE_OPTIONS;
const smallIconSizes = [
  "1x1",
  "1x2",
  "2x1",
] as const satisfies readonly ItabReplicaWidgetSize[];

export const ITAB_REPLICA_OPENED_SHELL_DEFAULTS = {
  width: 998,
  height: 600,
  maxWidthInset: 42,
  maxHeightInset: 64,
  trafficVisible: true,
} as const satisfies ItabReplicaOpenedShellMetadata;

const sourceCompactOpenedShell = {
  width: 860,
  height: 552,
  maxWidthInset: 42,
  maxHeightInset: 64,
} as const satisfies ItabReplicaOpenedShellOverride;

const sourcePanelOpenedShell = {
  width: 1000,
  height: 602,
  maxWidthInset: 32,
  maxHeightInset: 32,
} as const satisfies ItabReplicaOpenedShellOverride;

const sourceConverterOpenedShell = {
  width: 800,
  height: 538,
  maxWidthInset: 32,
  maxHeightInset: 32,
} as const satisfies ItabReplicaOpenedShellOverride;

const defineWidget = (definition: ItabReplicaWidgetDefinition) => definition;

export const ITAB_REPLICA_WIDGET_DEFINITIONS = {
  weather: defineWidget({
    kind: "weather",
    defaultSize: "2x2",
    supportedSizes: allSizes,
    sizeAdaptation: "source-sized-ui",
    openSurface: "dialog",
    requiresSizeSpecificUi: true,
    openedShell: {
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 18,
    },
  }),
  calendar: defineWidget({
    kind: "calendar",
    defaultSize: "2x2",
    supportedSizes: allSizes,
    sizeAdaptation: "source-sized-ui",
    openSurface: "dialog",
    requiresSizeSpecificUi: true,
    openedShell: sourcePanelOpenedShell,
  }),
  memo: defineWidget({
    kind: "memo",
    defaultSize: "2x2",
    supportedSizes: allSizes,
    sizeAdaptation: "source-sized-ui",
    openSurface: "dialog",
    requiresSizeSpecificUi: true,
    openedShell: sourcePanelOpenedShell,
  }),
  movie: defineWidget({
    kind: "movie",
    defaultSize: "2x2",
    supportedSizes: allSizes,
    sizeAdaptation: "source-sized-ui",
    openSurface: "dialog",
    requiresSizeSpecificUi: true,
    openedShell: sourceCompactOpenedShell,
  }),
  poem: defineWidget({
    kind: "poem",
    defaultSize: "2x2",
    supportedSizes: allSizes,
    sizeAdaptation: "source-sized-ui",
    openSurface: "dialog",
    requiresSizeSpecificUi: true,
    openedShell: sourceCompactOpenedShell,
  }),
  clock: defineWidget({
    kind: "clock",
    defaultSize: "2x2",
    supportedSizes: allSizes,
    sizeAdaptation: "source-sized-ui",
    openSurface: "dialog",
    requiresSizeSpecificUi: true,
    openedShell: {
      ...sourcePanelOpenedShell,
      trafficVisible: false,
    },
  }),
  "today-english": defineWidget({
    kind: "today-english",
    defaultSize: "2x2",
    supportedSizes: allSizes,
    sizeAdaptation: "shared-layout",
    openSurface: "dialog",
    requiresSizeSpecificUi: false,
    openedShell: sourceCompactOpenedShell,
  }),
  "eat-today": defineWidget({
    kind: "eat-today",
    defaultSize: "2x2",
    supportedSizes: allSizes,
    sizeAdaptation: "shared-layout",
    openSurface: "dialog",
    requiresSizeSpecificUi: false,
    openedShell: sourcePanelOpenedShell,
  }),
  wallpaper: defineWidget({
    kind: "wallpaper",
    defaultSize: "2x2",
    supportedSizes: allSizes,
    sizeAdaptation: "source-sized-ui",
    openSurface: "dialog",
    requiresSizeSpecificUi: true,
    openedShell: sourcePanelOpenedShell,
  }),
  todo: defineWidget({
    kind: "todo",
    defaultSize: "2x2",
    supportedSizes: allSizes,
    sizeAdaptation: "source-sized-ui",
    openSurface: "dialog",
    requiresSizeSpecificUi: true,
    iconOnlySizes: smallIconSizes,
    openedShell: sourcePanelOpenedShell,
  }),
  tomato: defineWidget({
    kind: "tomato",
    defaultSize: "2x2",
    supportedSizes: allSizes,
    sizeAdaptation: "source-sized-ui",
    openSurface: "dialog",
    requiresSizeSpecificUi: true,
    openedShell: sourcePanelOpenedShell,
  }),
  "number-uppercase": defineWidget({
    kind: "number-uppercase",
    defaultSize: "2x2",
    supportedSizes: allSizes,
    sizeAdaptation: "source-sized-ui",
    openSurface: "dialog",
    requiresSizeSpecificUi: true,
    openedShell: sourceConverterOpenedShell,
  }),
} as const satisfies Record<ItabReplicaWidgetKind, ItabReplicaWidgetDefinition>;

export const getItabReplicaWidgetDefinition = (kind: ItabReplicaWidgetKind) =>
  ITAB_REPLICA_WIDGET_DEFINITIONS[kind];

export const getItabReplicaWidgetSupportedSizes = (
  kind: ItabReplicaWidgetKind,
) => getItabReplicaWidgetDefinition(kind).supportedSizes;

export const isItabReplicaWidgetSizeSupported = (
  kind: ItabReplicaWidgetKind,
  size: ItabReplicaWidgetSize,
) => getItabReplicaWidgetSupportedSizes(kind).includes(size);

export const createItabReplicaSizeMenuOptions = (
  kind: ItabReplicaWidgetKind,
  activeSize: ItabReplicaWidgetSize,
): ItabReplicaWidgetSizeMenuOption[] =>
  ITAB_REPLICA_WIDGET_SIZE_OPTIONS.map((size) => ({
    size,
    enabled: isItabReplicaWidgetSizeSupported(kind, size),
    active: activeSize === size,
  }));

export const shouldRenderItabReplicaIconOnly = (
  kind: ItabReplicaWidgetKind,
  size: ItabReplicaWidgetSize,
) => {
  const iconSizes = getItabReplicaWidgetDefinition(kind).iconOnlySizes;
  return Boolean(iconSizes?.includes(size));
};

export const resolveItabReplicaOpenedShell = (
  kind: ItabReplicaWidgetKind,
  instanceOverride?: ItabReplicaOpenedShellOverride,
  callerOverride?: ItabReplicaOpenedShellOverride,
): ItabReplicaOpenedShellMetadata => ({
  ...ITAB_REPLICA_OPENED_SHELL_DEFAULTS,
  ...getItabReplicaWidgetDefinition(kind).openedShell,
  ...instanceOverride,
  ...callerOverride,
});

export const resolveItabReplicaOpenedShellStyle = (
  kind: ItabReplicaWidgetKind,
  instanceOverride?: ItabReplicaOpenedShellOverride,
  callerOverride?: ItabReplicaOpenedShellOverride,
): Record<"width" | "height", string> => {
  const shell = resolveItabReplicaOpenedShell(
    kind,
    instanceOverride,
    callerOverride,
  );

  return {
    width: `min(${shell.width}px, calc(100vw - ${shell.maxWidthInset}px))`,
    height: `min(${shell.height}px, calc(100vh - ${shell.maxHeightInset}px))`,
  };
};
