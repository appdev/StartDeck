export type SdReplicaWidgetSize = "1x1" | "1x2" | "2x1" | "2x2" | "2x4";

export type SdReplicaWidgetKind =
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

export type SdReplicaSizeAdaptation =
  | "source-sized-ui"
  | "icon-only"
  | "shared-layout";

export type SdReplicaOpenSurface =
  | "dialog"
  | "external"
  | "none"
  | "optional";

export interface SdReplicaOpenedShellMetadata {
  width: number;
  height: number;
  maxWidthInset: number;
  maxHeightInset: number;
  trafficVisible: boolean;
}

export type SdReplicaOpenedShellOverride =
  Partial<SdReplicaOpenedShellMetadata>;

export interface SdReplicaWidgetDefinition {
  kind: SdReplicaWidgetKind;
  defaultSize: SdReplicaWidgetSize;
  supportedSizes: readonly SdReplicaWidgetSize[];
  sizeAdaptation: SdReplicaSizeAdaptation;
  openSurface: SdReplicaOpenSurface;
  requiresSizeSpecificUi: boolean;
  iconOnlySizes?: readonly SdReplicaWidgetSize[];
  openedShell?: SdReplicaOpenedShellOverride;
}

export interface SdReplicaWidgetSizeMenuOption {
  size: SdReplicaWidgetSize;
  enabled: boolean;
  active: boolean;
}

export const SD_REPLICA_WIDGET_SIZE_OPTIONS = [
  "1x1",
  "1x2",
  "2x1",
  "2x2",
  "2x4",
] as const satisfies readonly SdReplicaWidgetSize[];

const allSizes = SD_REPLICA_WIDGET_SIZE_OPTIONS;
const smallIconSizes = [
  "1x1",
  "1x2",
  "2x1",
] as const satisfies readonly SdReplicaWidgetSize[];

export const SD_REPLICA_OPENED_SHELL_DEFAULTS = {
  width: 998,
  height: 600,
  maxWidthInset: 42,
  maxHeightInset: 64,
  trafficVisible: true,
} as const satisfies SdReplicaOpenedShellMetadata;

const sourceCompactOpenedShell = {
  width: 860,
  height: 552,
  maxWidthInset: 42,
  maxHeightInset: 64,
} as const satisfies SdReplicaOpenedShellOverride;

const sourcePanelOpenedShell = {
  width: 1000,
  height: 602,
  maxWidthInset: 32,
  maxHeightInset: 32,
} as const satisfies SdReplicaOpenedShellOverride;

const sourceConverterOpenedShell = {
  width: 800,
  height: 538,
  maxWidthInset: 32,
  maxHeightInset: 32,
} as const satisfies SdReplicaOpenedShellOverride;

const defineWidget = (definition: SdReplicaWidgetDefinition) => definition;

export const SD_REPLICA_WIDGET_DEFINITIONS = {
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
} as const satisfies Record<SdReplicaWidgetKind, SdReplicaWidgetDefinition>;

export const getSdReplicaWidgetDefinition = (kind: SdReplicaWidgetKind) =>
  SD_REPLICA_WIDGET_DEFINITIONS[kind];

export const getSdReplicaWidgetSupportedSizes = (
  kind: SdReplicaWidgetKind,
) => getSdReplicaWidgetDefinition(kind).supportedSizes;

export const isSdReplicaWidgetSizeSupported = (
  kind: SdReplicaWidgetKind,
  size: SdReplicaWidgetSize,
) => getSdReplicaWidgetSupportedSizes(kind).includes(size);

export const createSdReplicaSizeMenuOptions = (
  kind: SdReplicaWidgetKind,
  activeSize: SdReplicaWidgetSize,
): SdReplicaWidgetSizeMenuOption[] =>
  SD_REPLICA_WIDGET_SIZE_OPTIONS.map((size) => ({
    size,
    enabled: isSdReplicaWidgetSizeSupported(kind, size),
    active: activeSize === size,
  }));

export const shouldRenderSdReplicaIconOnly = (
  kind: SdReplicaWidgetKind,
  size: SdReplicaWidgetSize,
) => {
  const iconSizes = getSdReplicaWidgetDefinition(kind).iconOnlySizes;
  return Boolean(iconSizes?.includes(size));
};

export const resolveSdReplicaOpenedShell = (
  kind: SdReplicaWidgetKind,
  instanceOverride?: SdReplicaOpenedShellOverride,
  callerOverride?: SdReplicaOpenedShellOverride,
): SdReplicaOpenedShellMetadata => ({
  ...SD_REPLICA_OPENED_SHELL_DEFAULTS,
  ...getSdReplicaWidgetDefinition(kind).openedShell,
  ...instanceOverride,
  ...callerOverride,
});

export const resolveSdReplicaOpenedShellStyle = (
  kind: SdReplicaWidgetKind,
  instanceOverride?: SdReplicaOpenedShellOverride,
  callerOverride?: SdReplicaOpenedShellOverride,
): Record<"width" | "height", string> => {
  const shell = resolveSdReplicaOpenedShell(
    kind,
    instanceOverride,
    callerOverride,
  );

  return {
    width: `min(${shell.width}px, calc(100vw - ${shell.maxWidthInset}px))`,
    height: `min(${shell.height}px, calc(100vh - ${shell.maxHeightInset}px))`,
  };
};
