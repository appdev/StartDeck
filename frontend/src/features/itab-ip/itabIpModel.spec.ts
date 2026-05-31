import { describe, expect, it, vi } from "vitest";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  applyItabIpSizeToWidget,
  createDefaultItabIpWidget,
  createItabIpMapEmbedUrl,
  formatItabIpArea,
  formatItabIpCoordinate,
  formatItabIpLatency,
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
    expect(widget).not.toHaveProperty("isPublic");
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
      location: "中国 浙江省 杭州 拱墅",
      country: "中国",
      region: "浙江省",
      adm2: "杭州",
      city: "拱墅",
      district: "拱墅",
      weatherLocationId: "101210112",
      weatherLocationType: "city",
      isp: "",
      latitude: "30.274084",
      longitude: "120.155070",
      coordinateSource: "codelife-getLocation",
      coordinateAccuracy: "ip-geolocation",
      cached: true,
    });

    expect(result).toMatchObject({
      ip: "163.125.214.27",
      queryIp: "163.125.214.27",
      sourceStatus: "ok",
      cached: true,
      coordinateSource: "codelife-getLocation",
      coordinateAccuracy: "ip-geolocation",
      weatherLocationId: "101210112",
    });
    expect(formatItabIpArea(result!)).toBe("浙江省杭州市拱墅");
    expect(formatItabIpOuterLocation(result!)).toBe("浙江省杭州市拱墅");
    expect(formatItabIpNetwork(result!)).toBe("未知");
    expect(formatItabIpCoordinate(result!)).toBe("120.155070,30.274084");
    expect(decodeURIComponent(createItabIpMapEmbedUrl(result!))).toContain(
      "marker=30.274084,120.155070",
    );

    vi.useRealTimers();
  });

  it("does not create a map URL when the lookup has no valid coordinate", () => {
    const result = normalizeItabIpLookupResponse({
      success: true,
      ip: "127.0.0.1",
      country: "本机",
      region: "本地网络",
      city: "本机",
      latitude: "暂无",
      longitude: "暂无",
    });

    expect(formatItabIpCoordinate(result!)).toBe("暂无");
    expect(createItabIpMapEmbedUrl(result!)).toBe("");
  });

  it("formats Chinese IP areas without country and with city suffix", () => {
    const result = normalizeItabIpLookupResponse({
      success: true,
      ip: "163.125.214.27",
      location: "中国 广东省 深圳 龙华",
      country: "中国",
      region: "广东省",
      adm2: "深圳",
      city: "龙华",
      district: "龙华",
    });

    expect(formatItabIpArea(result!)).toBe("广东省深圳市龙华");
    expect(formatItabIpOuterLocation(result!)).toBe("广东省深圳市龙华");
  });

  it("keeps non-China IP areas in segmented form", () => {
    const result = normalizeItabIpLookupResponse({
      success: true,
      ip: "46.8.226.199",
      location: "俄罗斯 莫斯科 莫斯科",
      country: "俄罗斯",
      region: "莫斯科",
      city: "莫斯科",
    });

    expect(formatItabIpArea(result!)).toBe("俄罗斯-莫斯科");
  });

  it("formats IP latency state for the opened panel", () => {
    expect(formatItabIpLatency(null, "idle")).toBe("待测试");
    expect(formatItabIpLatency(null, "loading")).toBe("测试中");
    expect(formatItabIpLatency(24.2, "success")).toBe("24 ms");
  });
});
