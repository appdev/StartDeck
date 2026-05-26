// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ITAB_IP_LATENCY_PATH, ITAB_IP_PROXY_PATH } from "./itabIpTypes";
import { fetchItabIpLatency, fetchItabIpLookup } from "./itabIpApi";

describe("itabIpApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

    const data = await fetchItabIpLookup(true);

    expect(data.ip).toBe("163.125.214.27");
    expect(data.longitude).toBe("114.045422");
    expect(data.coordinateSource).toBe("codelife-getLocation");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`${ITAB_IP_PROXY_PATH}?ts=`),
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      }),
    );
    expect(fetchMock.mock.calls[0]![0]).toContain("refresh=1");
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

    const data = await fetchItabIpLatency();

    expect(data.latencyMs).toBeCloseTo(24.2);
    expect(data.serverTs).toBe(1780000000000);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`${ITAB_IP_LATENCY_PATH}?ts=`),
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
        method: "GET",
      }),
    );
  });
});
