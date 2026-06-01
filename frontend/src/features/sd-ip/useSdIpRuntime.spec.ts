// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSdIpLookup } from "./sdIpApi";
import {
  prefetchSdIpLocation,
  resetSdIpRuntimeForTests,
  useSdIpRuntime,
} from "./useSdIpRuntime";

vi.mock("./sdIpApi", () => ({
  fetchSdIpLookup: vi.fn(async () => ({
    ip: "163.125.214.27",
    location: "中国 广东省 深圳 龙华",
    country: "中国",
    region: "广东省",
    adm2: "深圳",
    city: "龙华",
    district: "龙华",
    isp: "",
    queryIp: "163.125.214.27",
    clientIp: "",
    clientIpSource: "",
    weatherLocationId: "101280608",
    weatherLocationType: "city",
    latitude: "22.696667",
    longitude: "114.045422",
    coordinateSource: "codelife-getLocation",
    coordinateAccuracy: "ip-geolocation",
    updatedAt: "2026/05/28 15:20",
    cached: true,
    sourceStatus: "ok",
  })),
  fetchSdIpLatency: vi.fn(async () => ({
    latencyMs: 24,
    checkedAt: "2026/05/28 15:20",
    serverTs: 1780000000000,
  })),
}));

describe("IP runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSdIpRuntimeForTests();
  });

  it("reuses the boot lookup for widget loads and never forwards component refresh intent", async () => {
    const runtime = useSdIpRuntime();

    const bootLookup = prefetchSdIpLocation();
    const widgetRefresh = runtime.load();

    await expect(Promise.all([bootLookup, widgetRefresh])).resolves.toEqual([
      true,
      true,
    ]);

    expect(fetchSdIpLookup).toHaveBeenCalledTimes(1);
    expect(fetchSdIpLookup).toHaveBeenCalledWith(
      false,
      expect.any(AbortSignal),
    );
    expect(runtime.result.value.weatherLocationId).toBe("101280608");
  });
});
