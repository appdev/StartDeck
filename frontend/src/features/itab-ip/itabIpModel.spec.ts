import { describe, expect, it, vi } from "vitest";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  applyItabIpSizeToWidget,
  createDefaultItabIpWidget,
  formatItabIpArea,
  formatItabIpCoordinate,
  formatItabIpNetwork,
  formatItabIpOuterLocation,
  normalizeItabIpLookupResponse,
  normalizeItabIpWidgetData,
} from "./itabIpModel";
import {
  ITAB_IP_CATALOG_ID,
  ITAB_IP_RUNTIME,
  ITAB_IP_WIDGET_TYPE,
} from "./itabIpTypes";

describe("itabIpModel", () => {
  it("creates the canonical main-project IP widget", () => {
    const widget = createDefaultItabIpWidget();

    expect(widget).toMatchObject({
      id: ITAB_IP_CATALOG_ID,
      type: ITAB_IP_WIDGET_TYPE,
      enable: true,
      isPublic: true,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: ITAB_IP_RUNTIME,
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
      },
    });
  });

  it("normalizes persisted data and applies iTab size keys to grid spans", () => {
    const widget = createDefaultItabIpWidget();
    applyItabIpSizeToWidget(widget, "2x4");

    expect(widget).toMatchObject({
      id: ITAB_IP_CATALOG_ID,
      type: ITAB_IP_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({
        runtime: ITAB_IP_RUNTIME,
        sizeKey: "2x4",
      }),
    });
    expect(normalizeItabIpWidgetData({ sizeKey: "unsupported" })).toMatchObject(
      {
        runtime: ITAB_IP_RUNTIME,
        sizeKey: "2x2",
      },
    );
  });

  it("normalizes /api/ip payload fields for widget and opened views", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-24T01:40:00+08:00"));

    const result = normalizeItabIpLookupResponse({
      success: true,
      ip: "163.125.214.27",
      location: "中国 广东 深圳 中国联通",
      country: "中国",
      region: "广东",
      city: "深圳",
      isp: "中国联通",
      latitude: "22.696667",
      longitude: "114.045422",
      cached: true,
    });

    expect(result).toMatchObject({
      ip: "163.125.214.27",
      queryIp: "163.125.214.27",
      sourceStatus: "ok",
      cached: true,
    });
    expect(formatItabIpArea(result!)).toBe("中国-广东-深圳");
    expect(formatItabIpOuterLocation(result!)).toBe("中国-广东-深圳");
    expect(formatItabIpNetwork(result!)).toBe("中国联通");
    expect(formatItabIpCoordinate(result!)).toBe("114.045422,22.696667");

    vi.useRealTimers();
  });
});
