import { describe, expect, it } from "vitest";

import {
  createSdReplicaSizeMenuOptions,
  getSdReplicaWidgetDefinition,
  resolveSdReplicaOpenedShell,
  resolveSdReplicaOpenedShellStyle,
  isSdReplicaWidgetSizeSupported,
  SD_REPLICA_OPENED_SHELL_DEFAULTS,
  SD_REPLICA_WIDGET_DEFINITIONS,
  SD_REPLICA_WIDGET_SIZE_OPTIONS,
  shouldRenderSdReplicaIconOnly,
  type SdReplicaWidgetKind,
} from "./sdWidgetContract";

const expectedKinds = [
  "weather",
  "calendar",
  "memo",
  "movie",
  "poem",
  "clock",
  "today-english",
  "eat-today",
  "wallpaper",
  "todo",
  "tomato",
  "number-uppercase",
] as const satisfies readonly SdReplicaWidgetKind[];

describe("widget contract", () => {
  it("defines a base contract for every replica widget kind", () => {
    expect(Object.keys(SD_REPLICA_WIDGET_DEFINITIONS).sort()).toEqual(
      [...expectedKinds].sort(),
    );

    for (const kind of expectedKinds) {
      const definition = getSdReplicaWidgetDefinition(kind);
      expect(definition.kind).toBe(kind);
      expect(definition.supportedSizes.length).toBeGreaterThan(0);
      expect(definition.supportedSizes).toContain(definition.defaultSize);
      expect(
        definition.supportedSizes.every((size) =>
          SD_REPLICA_WIDGET_SIZE_OPTIONS.includes(size),
        ),
      ).toBe(true);
    }
  });

  it("uses the contract to build size menu states", () => {
    const options = createSdReplicaSizeMenuOptions("todo", "2x4");

    expect(options).toHaveLength(SD_REPLICA_WIDGET_SIZE_OPTIONS.length);
    expect(options.find((option) => option.size === "2x4")).toMatchObject({
      enabled: true,
      active: true,
    });
    expect(
      options.every((option) =>
        isSdReplicaWidgetSizeSupported("todo", option.size),
      ),
    ).toBe(true);
  });

  it("keeps todo icon-only sizing limited to compact variants", () => {
    expect(shouldRenderSdReplicaIconOnly("todo", "1x1")).toBe(true);
    expect(shouldRenderSdReplicaIconOnly("todo", "2x2")).toBe(false);
  });

  it("keeps wallpaper as a source-sized Bing panel with the shared source dialog shell", () => {
    expect(getSdReplicaWidgetDefinition("wallpaper")).toMatchObject({
      defaultSize: "2x2",
      sizeAdaptation: "source-sized-ui",
      openSurface: "dialog",
      requiresSizeSpecificUi: true,
    });
    expect(resolveSdReplicaOpenedShell("wallpaper")).toMatchObject({
      width: 1000,
      height: 602,
      maxWidthInset: 32,
      maxHeightInset: 32,
      trafficVisible: true,
    });
  });

  it("resolves opened shell metadata with base, kind, instance, and caller precedence", () => {
    expect(resolveSdReplicaOpenedShell("today-english")).toMatchObject({
      width: 860,
      height: 552,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    });

    expect(
      resolveSdReplicaOpenedShell(
        "today-english",
        {
          width: 720,
          maxHeightInset: 44,
        },
        {
          height: 480,
          maxWidthInset: 80,
        },
      ),
    ).toEqual({
      width: 720,
      height: 480,
      maxWidthInset: 80,
      maxHeightInset: 44,
      trafficVisible: true,
    });

    expect(resolveSdReplicaOpenedShell("weather")).toMatchObject({
      ...SD_REPLICA_OPENED_SHELL_DEFAULTS,
      width: 1000,
      height: 602,
      maxWidthInset: 42,
      maxHeightInset: 18,
    });
    expect(resolveSdReplicaOpenedShell("clock")).toMatchObject({
      trafficVisible: false,
    });
  });

  it("formats opened shell dimensions as exact responsive CSS strings", () => {
    expect(resolveSdReplicaOpenedShellStyle("today-english")).toEqual({
      width: "min(860px, calc(100vw - 42px))",
      height: "min(552px, calc(100vh - 64px))",
    });

    expect(
      resolveSdReplicaOpenedShellStyle(
        "number-uppercase",
        {
          width: 700,
          height: 420,
        },
        {
          maxWidthInset: 24,
          maxHeightInset: 30,
        },
      ),
    ).toEqual({
      width: "min(700px, calc(100vw - 24px))",
      height: "min(420px, calc(100vh - 30px))",
    });
  });
});
