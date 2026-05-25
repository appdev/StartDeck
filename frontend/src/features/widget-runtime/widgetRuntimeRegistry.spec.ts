// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  applyRuntimeWidgetSize,
  getWidgetRuntimeDefinition,
  isRuntimeWidget,
  normalizeWidgetRuntimeData,
} from "./widgetRuntimeRegistry";
import type { WidgetConfig } from "@/types";
import {
  ITAB_WALLPAPER_RUNTIME,
  ITAB_WALLPAPER_WIDGET_TYPE,
} from "@/features/itab-wallpaper/itabWallpaperTypes";
import {
  ITAB_MOVIE_CALENDAR_RUNTIME,
  ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
} from "@/features/itab-movie-calendar/itabMovieCalendarTypes";
import {
  ITAB_IP_RUNTIME,
  ITAB_IP_WIDGET_TYPE,
} from "@/features/itab-ip/itabIpTypes";
import {
  ITAB_CALENDAR_RUNTIME,
  ITAB_CALENDAR_WIDGET_TYPE,
} from "@/features/itab-calendar/itabCalendarTypes";
import {
  ITAB_NUMBER_UPPERCASE_RUNTIME,
  ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
} from "@/features/itab-number-uppercase/itabNumberUppercaseTypes";
import {
  ITAB_FOOD_PICKER_RUNTIME,
  ITAB_FOOD_PICKER_WIDGET_TYPE,
} from "@/features/itab-food-picker/itabFoodPickerTypes";

describe("widgetRuntimeRegistry", () => {
  it("registers Docker and system status as first-class runtime widgets", () => {
    expect(isRuntimeWidget({ type: "docker" })).toBe(true);
    expect(isRuntimeWidget({ type: "system-status" })).toBe(true);
    expect(isRuntimeWidget({ type: "custom-css" })).toBe(true);

    expect(getWidgetRuntimeDefinition("docker")).toMatchObject({
      type: "docker",
      runtime: "docker",
      title: "Docker",
      defaultSizeKey: "2x2",
      openedShell: {
        width: 1000,
        height: 602,
        trafficVisible: true,
      },
    });
    expect(getWidgetRuntimeDefinition("system-status")).toMatchObject({
      type: "system-status",
      runtime: "system-status",
      title: "系统状态",
      defaultSizeKey: "1x1",
      openedShell: {
        width: 1000,
        height: 602,
        trafficVisible: true,
      },
    });
    expect(getWidgetRuntimeDefinition("custom-css")).toMatchObject({
      type: "custom-css",
      runtime: "custom-css",
      title: "自定义组件",
      defaultSizeKey: "1x1",
      openedShell: {
        width: 1000,
        height: 602,
        trafficVisible: true,
      },
    });
  });

  it("normalizes custom-css runtime data and applies iTab size updates", () => {
    const widget: WidgetConfig = {
      id: "custom-css-1",
      type: "custom-css",
      enable: true,
      isPublic: true,
      w: 1,
      h: 1,
      colSpan: 1,
      rowSpan: 1,
      data: {
        title: "Demo",
        html: "<strong>Hello</strong>",
        css: "strong { color: red; }",
        js: "ctx.el.dataset.ready = 'true'",
        sizeKey: "1x1",
        sentinel: "keep",
      },
    };

    expect(normalizeWidgetRuntimeData("custom-css", widget.data)).toMatchObject(
      {
        runtime: "custom-css",
        version: 1,
        sizeKey: "1x1",
        title: "Demo",
        html: "<strong>Hello</strong>",
        css: "strong { color: red; }",
        js: "ctx.el.dataset.ready = 'true'",
        sentinel: "keep",
      },
    );

    applyRuntimeWidgetSize(widget, "2x4");

    expect(widget).toMatchObject({
      w: 4,
      h: 2,
      colSpan: 4,
      rowSpan: 2,
      data: {
        runtime: "custom-css",
        sizeKey: "2x4",
        title: "Demo",
        sentinel: "keep",
      },
    });
  });

  it("preserves Docker known and unknown data through normalization and size updates", () => {
    const widget: WidgetConfig = {
      id: "docker",
      type: "docker",
      enable: false,
      isPublic: false,
      hideOnMobile: true,
      w: 1,
      h: 1,
      colSpan: 1,
      rowSpan: 1,
      data: {
        autoUpdate: true,
        autoUpdateKeepImages: 4,
        autoUpdateMinFreeGB: 6,
        lanHost: "nas.local",
        publicHost: "public.example.com",
        publicHosts: { container: "app.example.com" },
        disabledContainers: ["container"],
        sizeKey: "1x1",
        sentinel: { keep: true },
      },
    };

    expect(normalizeWidgetRuntimeData("docker", widget.data)).toMatchObject({
      runtime: "docker",
      version: 1,
      sizeKey: "1x1",
      autoUpdate: true,
      autoUpdateKeepImages: 4,
      autoUpdateMinFreeGB: 6,
      lanHost: "nas.local",
      publicHost: "public.example.com",
      publicHosts: { container: "app.example.com" },
      disabledContainers: ["container"],
      sentinel: { keep: true },
    });

    applyRuntimeWidgetSize(widget, "2x4");

    expect(widget).toMatchObject({
      enable: false,
      isPublic: false,
      hideOnMobile: true,
      w: 4,
      h: 2,
      colSpan: 4,
      rowSpan: 2,
      data: {
        runtime: "docker",
        sizeKey: "2x4",
        autoUpdate: true,
        publicHosts: { container: "app.example.com" },
        disabledContainers: ["container"],
        sentinel: { keep: true },
      },
    });
  });

  it("preserves SystemStatus top-level display fields and data keys", () => {
    const widget: WidgetConfig = {
      id: "system-status",
      type: "system-status",
      enable: false,
      isPublic: false,
      hideOnMobile: true,
      w: 2,
      h: 1,
      colSpan: 2,
      rowSpan: 1,
      data: {
        sizeKey: "1x2",
        unknownTelemetry: "keep",
      },
    };

    expect(
      normalizeWidgetRuntimeData("system-status", widget.data),
    ).toMatchObject({
      runtime: "system-status",
      version: 1,
      sizeKey: "1x2",
      unknownTelemetry: "keep",
    });

    applyRuntimeWidgetSize(widget, "2x1");

    expect(widget).toMatchObject({
      enable: false,
      isPublic: false,
      hideOnMobile: true,
      w: 1,
      h: 2,
      colSpan: 1,
      rowSpan: 2,
      data: {
        runtime: "system-status",
        sizeKey: "2x1",
        unknownTelemetry: "keep",
      },
    });
  });

  it("registers the migrated wallpaper widget for the main home runtime", () => {
    const definition = getWidgetRuntimeDefinition(ITAB_WALLPAPER_WIDGET_TYPE);

    expect(isRuntimeWidget({ type: ITAB_WALLPAPER_WIDGET_TYPE })).toBe(true);
    expect(definition).toMatchObject({
      type: ITAB_WALLPAPER_WIDGET_TYPE,
      runtime: ITAB_WALLPAPER_RUNTIME,
      title: "壁纸",
      defaultSizeKey: "2x2",
      openedShell: {
        width: 1000,
        height: 602,
        trafficVisible: true,
      },
    });
  });

  it("normalizes wallpaper runtime data without losing iTab state", () => {
    const data = normalizeWidgetRuntimeData(ITAB_WALLPAPER_WIDGET_TYPE, {
      sizeKey: "1x2",
      itab: {
        state: {
          selectedWallpaperId: "sichuan-tea",
        },
      },
    });

    expect(data).toMatchObject({
      runtime: ITAB_WALLPAPER_RUNTIME,
      sizeKey: "1x2",
      itab: {
        adapterKind: "wallpaper",
        catalogId: ITAB_WALLPAPER_WIDGET_TYPE,
        captureIndex: 16,
        state: {
          selectedWallpaperId: "sichuan-tea",
        },
      },
    });
  });

  it("registers the migrated movie calendar widget for the main home runtime", () => {
    const definition = getWidgetRuntimeDefinition(
      ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
    );

    expect(isRuntimeWidget({ type: ITAB_MOVIE_CALENDAR_WIDGET_TYPE })).toBe(
      true,
    );
    expect(definition).toMatchObject({
      type: ITAB_MOVIE_CALENDAR_WIDGET_TYPE,
      runtime: ITAB_MOVIE_CALENDAR_RUNTIME,
      title: "电影日历",
      defaultSizeKey: "2x2",
      openedShell: {
        width: 860,
        height: 552,
        trafficVisible: true,
      },
    });
  });

  it("normalizes movie calendar runtime data to canonical persisted state", () => {
    expect(
      normalizeWidgetRuntimeData(ITAB_MOVIE_CALENDAR_WIDGET_TYPE, {
        sizeKey: "2x4",
        movieTitle: "红气球之旅",
      }),
    ).toMatchObject({
      runtime: ITAB_MOVIE_CALENDAR_RUNTIME,
      sizeKey: "2x4",
      version: 1,
    });
  });

  it("registers the migrated IP widget for the main home runtime", () => {
    const definition = getWidgetRuntimeDefinition(ITAB_IP_WIDGET_TYPE);

    expect(isRuntimeWidget({ type: ITAB_IP_WIDGET_TYPE })).toBe(true);
    expect(definition).toMatchObject({
      type: ITAB_IP_WIDGET_TYPE,
      runtime: ITAB_IP_RUNTIME,
      title: "本机IP",
      defaultSizeKey: "2x2",
      openedShell: {
        width: 1000,
        height: 602,
        trafficVisible: true,
      },
    });
  });

  it("normalizes IP runtime data to canonical persisted state", () => {
    expect(
      normalizeWidgetRuntimeData(ITAB_IP_WIDGET_TYPE, {
        sizeKey: "2x4",
        ip: "127.0.0.1",
      }),
    ).toMatchObject({
      runtime: ITAB_IP_RUNTIME,
      sizeKey: "2x4",
      version: 1,
    });
  });

  it("registers the migrated calendar widget for the main home runtime", () => {
    const definition = getWidgetRuntimeDefinition(ITAB_CALENDAR_WIDGET_TYPE);

    expect(isRuntimeWidget({ type: ITAB_CALENDAR_WIDGET_TYPE })).toBe(true);
    expect(definition).toMatchObject({
      type: ITAB_CALENDAR_WIDGET_TYPE,
      runtime: ITAB_CALENDAR_RUNTIME,
      title: "日历",
      defaultSizeKey: "2x2",
      openedShell: {
        width: 1000,
        height: 602,
        trafficVisible: true,
      },
    });
  });

  it("normalizes calendar runtime data to canonical persisted state", () => {
    expect(
      normalizeWidgetRuntimeData(ITAB_CALENDAR_WIDGET_TYPE, {
        sizeKey: "2x4",
        selectedDate: "2026-05-20",
      }),
    ).toMatchObject({
      runtime: ITAB_CALENDAR_RUNTIME,
      sizeKey: "2x4",
      version: 1,
    });
  });

  it("registers the migrated number uppercase widget for the main home runtime", () => {
    const definition = getWidgetRuntimeDefinition(
      ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
    );

    expect(isRuntimeWidget({ type: ITAB_NUMBER_UPPERCASE_WIDGET_TYPE })).toBe(
      true,
    );
    expect(definition).toMatchObject({
      type: ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
      runtime: ITAB_NUMBER_UPPERCASE_RUNTIME,
      title: "金额换算",
      defaultSizeKey: "2x2",
      openedShell: {
        width: 900,
        height: 554,
        trafficVisible: true,
      },
    });
  });

  it("normalizes number uppercase runtime data to computed persisted state", () => {
    expect(
      normalizeWidgetRuntimeData(ITAB_NUMBER_UPPERCASE_WIDGET_TYPE, {
        sizeKey: "2x4",
        inputNumber: "1024",
        uppercaseResult: "stale",
      }),
    ).toMatchObject({
      runtime: ITAB_NUMBER_UPPERCASE_RUNTIME,
      sizeKey: "2x4",
      version: 1,
      inputNumber: "1024",
      uppercaseResult: "壹仟零贰拾肆元整",
      formatMode: "currency",
    });
  });

  it("registers the migrated food picker widget for the main home runtime", () => {
    const definition = getWidgetRuntimeDefinition(ITAB_FOOD_PICKER_WIDGET_TYPE);

    expect(isRuntimeWidget({ type: ITAB_FOOD_PICKER_WIDGET_TYPE })).toBe(true);
    expect(definition).toMatchObject({
      type: ITAB_FOOD_PICKER_WIDGET_TYPE,
      runtime: ITAB_FOOD_PICKER_RUNTIME,
      title: "今天吃什么",
      defaultSizeKey: "2x2",
      openedShell: {
        width: 998,
        height: 600,
        trafficVisible: true,
      },
    });
  });

  it("normalizes food picker runtime data to canonical persisted state", () => {
    expect(
      normalizeWidgetRuntimeData(ITAB_FOOD_PICKER_WIDGET_TYPE, {
        sizeKey: "2x4",
        menuItems: ["面", "饭", "面"],
        currentItem: "饭",
      }),
    ).toMatchObject({
      runtime: ITAB_FOOD_PICKER_RUNTIME,
      sizeKey: "2x4",
      version: 1,
      menuItems: ["面", "饭"],
      currentItem: "饭",
    });
  });
});
