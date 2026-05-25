// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ITAB_IP_PROXY_PATH } from "./itabIpTypes";
import { fetchItabIpLookup } from "./itabIpApi";

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
        region: "广东",
        city: "深圳",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchItabIpLookup(true);

    expect(data.ip).toBe("163.125.214.27");
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
});
