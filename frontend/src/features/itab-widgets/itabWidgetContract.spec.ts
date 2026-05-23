import { describe, expect, it } from "vitest";

import {
  createItabReplicaSizeMenuOptions,
  getItabReplicaWidgetDefinition,
  resolveItabReplicaOpenedShell,
  resolveItabReplicaOpenedShellStyle,
  isItabReplicaWidgetSizeSupported,
  ITAB_REPLICA_OPENED_SHELL_DEFAULTS,
  ITAB_REPLICA_WIDGET_DEFINITIONS,
  ITAB_REPLICA_WIDGET_SIZE_OPTIONS,
  shouldRenderItabReplicaIconOnly,
  type ItabReplicaWidgetKind,
} from "./itabWidgetContract";

const expectedKinds = [
  "weather",
  "calendar",
  "hotsearch",
  "anniversary",
  "memo",
  "movie",
  "countdown",
  "next-holiday",
  "anniversary-day",
  "poem",
  "wooden-fish",
  "clock",
  "speed-test",
  "today-english",
  "eat-today",
  "wallpaper",
  "todo",
  "stock",
  "exchange-rate",
  "gradient",
  "habit",
  "tomato",
  "world-clock",
  "converter",
  "tool-icon",
] as const satisfies readonly ItabReplicaWidgetKind[];

describe("itab widget contract", () => {
  it("defines a base contract for every replica widget kind", () => {
    expect(Object.keys(ITAB_REPLICA_WIDGET_DEFINITIONS).sort()).toEqual(
      [...expectedKinds].sort(),
    );

    for (const kind of expectedKinds) {
      const definition = getItabReplicaWidgetDefinition(kind);
      expect(definition.kind).toBe(kind);
      expect(definition.supportedSizes.length).toBeGreaterThan(0);
      expect(definition.supportedSizes).toContain(definition.defaultSize);
      expect(
        definition.supportedSizes.every((size) =>
          ITAB_REPLICA_WIDGET_SIZE_OPTIONS.includes(size),
        ),
      ).toBe(true);
    }
  });

  it("uses the contract to build size menu states", () => {
    const options = createItabReplicaSizeMenuOptions("todo", "2x4");

    expect(options).toHaveLength(ITAB_REPLICA_WIDGET_SIZE_OPTIONS.length);
    expect(options.find((option) => option.size === "2x4")).toMatchObject({
      enabled: true,
      active: true,
    });
    expect(
      options.every((option) =>
        isItabReplicaWidgetSizeSupported("todo", option.size),
      ),
    ).toBe(true);
  });

  it("allows icon-only widgets without forcing size-specific UI", () => {
    expect(shouldRenderItabReplicaIconOnly("todo", "1x1")).toBe(true);
    expect(shouldRenderItabReplicaIconOnly("todo", "2x2")).toBe(false);
    expect(shouldRenderItabReplicaIconOnly("tool-icon", "2x4")).toBe(true);
    expect(getItabReplicaWidgetDefinition("tool-icon")).toMatchObject({
      sizeAdaptation: "icon-only",
      requiresSizeSpecificUi: false,
    });
  });

  it("resolves opened shell metadata with base, kind, instance, and caller precedence", () => {
    expect(resolveItabReplicaOpenedShell("hotsearch")).toEqual(
      ITAB_REPLICA_OPENED_SHELL_DEFAULTS,
    );

    expect(resolveItabReplicaOpenedShell("today-english")).toMatchObject({
      width: 860,
      height: 552,
      maxWidthInset: 42,
      maxHeightInset: 64,
      trafficVisible: true,
    });

    expect(
      resolveItabReplicaOpenedShell(
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

    expect(resolveItabReplicaOpenedShell("clock")).toMatchObject({
      trafficVisible: false,
    });
  });

  it("formats opened shell dimensions as exact responsive CSS strings", () => {
    expect(resolveItabReplicaOpenedShellStyle("today-english")).toEqual({
      width: "min(860px, calc(100vw - 42px))",
      height: "min(552px, calc(100vh - 64px))",
    });

    expect(
      resolveItabReplicaOpenedShellStyle(
        "hotsearch",
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
