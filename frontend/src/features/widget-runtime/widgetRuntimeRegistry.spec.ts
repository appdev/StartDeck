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
  SD_WALLPAPER_RUNTIME,
  SD_WALLPAPER_WIDGET_TYPE,
} from "@/features/sd-wallpaper/sdWallpaperTypes";
import {
  SD_MOVIE_CALENDAR_RUNTIME,
  SD_MOVIE_CALENDAR_WIDGET_TYPE,
} from "@/features/sd-movie-calendar/sdMovieCalendarTypes";
import {
  SD_IP_RUNTIME,
  SD_IP_WIDGET_TYPE,
} from "@/features/sd-ip/sdIpTypes";
import {
  SD_CALENDAR_RUNTIME,
  SD_CALENDAR_WIDGET_TYPE,
} from "@/features/sd-calendar/sdCalendarTypes";
import {
  SD_NUMBER_UPPERCASE_RUNTIME,
  SD_NUMBER_UPPERCASE_WIDGET_TYPE,
} from "@/features/sd-number-uppercase/sdNumberUppercaseTypes";
import {
  SD_FOOD_PICKER_RUNTIME,
  SD_FOOD_PICKER_WIDGET_TYPE,
} from "@/features/sd-food-picker/sdFoodPickerTypes";
import {
  AI_USAGE_RUNTIME,
  AI_USAGE_WIDGET_TYPE,
} from "@/features/ai-usage/aiUsageTypes";
import {
  TAPD_DEFECTS_RUNTIME,
  TAPD_DEFECTS_WIDGET_TYPE,
} from "@/features/tapd-defects/tapdDefectTypes";

describe("widgetRuntimeRegistry", () => {
  it("registers Docker and system status as first-class runtime widgets", () => {
    expect(isRuntimeWidget({ type: "docker" })).toBe(true);
    expect(isRuntimeWidget({ type: "system-status" })).toBe(true);
    expect(isRuntimeWidget({ type: "custom-css" })).toBe(true);
    expect(isRuntimeWidget({ type: AI_USAGE_WIDGET_TYPE })).toBe(true);
    expect(isRuntimeWidget({ type: TAPD_DEFECTS_WIDGET_TYPE })).toBe(true);

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
    expect(getWidgetRuntimeDefinition(AI_USAGE_WIDGET_TYPE)).toMatchObject({
      type: AI_USAGE_WIDGET_TYPE,
      runtime: AI_USAGE_RUNTIME,
      title: "AI 使用量",
      defaultSizeKey: "2x2",
      openedShell: {
        width: 1000,
        height: 602,
        trafficVisible: true,
      },
    });
    expect(getWidgetRuntimeDefinition(TAPD_DEFECTS_WIDGET_TYPE)).toMatchObject({
      type: TAPD_DEFECTS_WIDGET_TYPE,
      runtime: TAPD_DEFECTS_RUNTIME,
      title: "TAPD 缺陷",
      defaultSizeKey: "2x2",
      openedShell: {
        width: 1100,
        height: 720,
        trafficVisible: true,
      },
    });
  });

  it("normalizes custom-css runtime data and applies scoped size updates", () => {
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
    const definition = getWidgetRuntimeDefinition(SD_WALLPAPER_WIDGET_TYPE);

    expect(isRuntimeWidget({ type: SD_WALLPAPER_WIDGET_TYPE })).toBe(true);
    expect(definition).toMatchObject({
      type: SD_WALLPAPER_WIDGET_TYPE,
      runtime: SD_WALLPAPER_RUNTIME,
      title: "壁纸",
      defaultSizeKey: "2x2",
      openedShell: {
        width: 1000,
        height: 602,
        trafficVisible: true,
      },
    });
  });

  it("normalizes wallpaper runtime data without losing legacy state", () => {
    const data = normalizeWidgetRuntimeData(SD_WALLPAPER_WIDGET_TYPE, {
      sizeKey: "1x2",
      sd: {
        state: {
          selectedWallpaperId: "sichuan-tea",
        },
      },
    });

    expect(data).toMatchObject({
      runtime: SD_WALLPAPER_RUNTIME,
      sizeKey: "1x2",
      sd: {
        adapterKind: "wallpaper",
        catalogId: SD_WALLPAPER_WIDGET_TYPE,
        captureIndex: 16,
        state: {
          selectedWallpaperId: "sichuan-tea",
        },
      },
    });
  });

  it("registers the migrated movie calendar widget for the main home runtime", () => {
    const definition = getWidgetRuntimeDefinition(
      SD_MOVIE_CALENDAR_WIDGET_TYPE,
    );

    expect(isRuntimeWidget({ type: SD_MOVIE_CALENDAR_WIDGET_TYPE })).toBe(
      true,
    );
    expect(definition).toMatchObject({
      type: SD_MOVIE_CALENDAR_WIDGET_TYPE,
      runtime: SD_MOVIE_CALENDAR_RUNTIME,
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
      normalizeWidgetRuntimeData(SD_MOVIE_CALENDAR_WIDGET_TYPE, {
        sizeKey: "2x4",
        movieTitle: "红气球之旅",
      }),
    ).toMatchObject({
      runtime: SD_MOVIE_CALENDAR_RUNTIME,
      sizeKey: "2x4",
      version: 1,
    });
  });

  it("registers the migrated IP widget for the main home runtime", () => {
    const definition = getWidgetRuntimeDefinition(SD_IP_WIDGET_TYPE);

    expect(isRuntimeWidget({ type: SD_IP_WIDGET_TYPE })).toBe(true);
    expect(definition).toMatchObject({
      type: SD_IP_WIDGET_TYPE,
      runtime: SD_IP_RUNTIME,
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
      normalizeWidgetRuntimeData(SD_IP_WIDGET_TYPE, {
        sizeKey: "2x4",
        ip: "127.0.0.1",
      }),
    ).toMatchObject({
      runtime: SD_IP_RUNTIME,
      sizeKey: "2x4",
      version: 1,
    });
  });

  it("registers the migrated calendar widget for the main home runtime", () => {
    const definition = getWidgetRuntimeDefinition(SD_CALENDAR_WIDGET_TYPE);

    expect(isRuntimeWidget({ type: SD_CALENDAR_WIDGET_TYPE })).toBe(true);
    expect(definition).toMatchObject({
      type: SD_CALENDAR_WIDGET_TYPE,
      runtime: SD_CALENDAR_RUNTIME,
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
      normalizeWidgetRuntimeData(SD_CALENDAR_WIDGET_TYPE, {
        sizeKey: "2x4",
        selectedDate: "2026-05-20",
      }),
    ).toMatchObject({
      runtime: SD_CALENDAR_RUNTIME,
      sizeKey: "2x4",
      version: 1,
    });
  });

  it("registers the migrated number uppercase widget for the main home runtime", () => {
    const definition = getWidgetRuntimeDefinition(
      SD_NUMBER_UPPERCASE_WIDGET_TYPE,
    );

    expect(isRuntimeWidget({ type: SD_NUMBER_UPPERCASE_WIDGET_TYPE })).toBe(
      true,
    );
    expect(definition).toMatchObject({
      type: SD_NUMBER_UPPERCASE_WIDGET_TYPE,
      runtime: SD_NUMBER_UPPERCASE_RUNTIME,
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
      normalizeWidgetRuntimeData(SD_NUMBER_UPPERCASE_WIDGET_TYPE, {
        sizeKey: "2x4",
        inputNumber: "1024",
        uppercaseResult: "stale",
      }),
    ).toMatchObject({
      runtime: SD_NUMBER_UPPERCASE_RUNTIME,
      sizeKey: "2x4",
      version: 1,
      inputNumber: "1024",
      uppercaseResult: "壹仟零贰拾肆元整",
      formatMode: "currency",
    });
  });

  it("registers the migrated food picker widget for the main home runtime", () => {
    const definition = getWidgetRuntimeDefinition(SD_FOOD_PICKER_WIDGET_TYPE);

    expect(isRuntimeWidget({ type: SD_FOOD_PICKER_WIDGET_TYPE })).toBe(true);
    expect(definition).toMatchObject({
      type: SD_FOOD_PICKER_WIDGET_TYPE,
      runtime: SD_FOOD_PICKER_RUNTIME,
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
      normalizeWidgetRuntimeData(SD_FOOD_PICKER_WIDGET_TYPE, {
        sizeKey: "2x4",
        menuItems: ["面", "饭", "面"],
        currentItem: "饭",
      }),
    ).toMatchObject({
      runtime: SD_FOOD_PICKER_RUNTIME,
      sizeKey: "2x4",
      version: 1,
      menuItems: ["面", "饭"],
      currentItem: "饭",
    });
  });
});
