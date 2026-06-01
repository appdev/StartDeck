// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SD_IP_LATENCY_PATH, SD_IP_PROXY_PATH } from "./sdIpTypes";
import {
  fetchSdIpHistory,
  fetchSdIpLatency,
  fetchSdIpLookup,
} from "./sdIpApi";

describe("IP API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("requests the StartDeck IP proxy and forwards refresh intent", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () =>
      Response.json({
        success: true,
        ip: "163.125.214.27",
        country: "中国",
        region: "广东省",
        adm2: "深圳",
        city: "龙华",
        latitude: "22.696667",
        longitude: "114.045422",
        coordinateSource: "codelife-getLocation",
        coordinateAccuracy: "ip-geolocation",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchSdIpLookup(true);

    expect(data.ip).toBe("163.125.214.27");
    expect(data.longitude).toBe("114.045422");
    expect(data.coordinateSource).toBe("codelife-getLocation");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`${SD_IP_PROXY_PATH}?ts=`),
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      }),
    );
    expect(fetchMock.mock.calls[0]![0]).toContain("refresh=1");
  });

  it("does not send legacy bearer tokens with IP lookup requests", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () =>
      Response.json({
        success: true,
        ip: "163.125.214.27",
        country: "中国",
        region: "广东省",
        adm2: "深圳",
        city: "龙华",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchSdIpLookup(false);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`${SD_IP_PROXY_PATH}?ts=`),
      expect.objectContaining({
        headers: {
          accept: "application/json",
        },
      }),
    );
  });

  it("loads the current user's IP history from the backend", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () =>
      Response.json({
        success: true,
        data: [
          {
            success: true,
            ip: "163.125.214.27",
            queryIp: "163.125.214.27",
            country: "中国",
            region: "广东省",
            adm2: "深圳",
            city: "龙华",
            firstSeenAt: 100,
            lastSeenAt: 200,
            seenCount: 3,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const history = await fetchSdIpHistory();

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      ip: "163.125.214.27",
      city: "龙华",
      firstSeenAt: 100,
      lastSeenAt: 200,
      seenCount: 3,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ip/history",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
        headers: expect.any(Headers),
      }),
    );
  });

  it("measures the StartDeck server roundtrip latency through /api/rtt", async () => {
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(124.2);
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () =>
      Response.json({
        success: true,
        ts: String(Date.now()),
        serverTs: 1780000000000,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchSdIpLatency();

    expect(data.latencyMs).toBeCloseTo(24.2);
    expect(data.serverTs).toBe(1780000000000);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`${SD_IP_LATENCY_PATH}?ts=`),
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
        method: "GET",
      }),
    );
  });
});
