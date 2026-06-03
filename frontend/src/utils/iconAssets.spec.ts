// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryStartDeckConnector } from "@/utils/startdeckConnector";
import {
  isCanonicalIconUrl,
  materializeIconInput,
  normalizeRemoteNavigationIconUrl,
  sanitizeNavigationIcon,
  sanitizeSnapshotIcons,
} from "./iconAssets";

vi.mock("@/utils/startdeckConnector", () => ({
  queryStartDeckConnector: vi.fn(),
}));

const mockedConnector = vi.mocked(queryStartDeckConnector);

describe("iconAssets", () => {
  beforeEach(() => {
    mockedConnector.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockedConnector.mockReset();
  });

  it("accepts only navigation icon data and rewrites legacy user icons", () => {
    expect(sanitizeNavigationIcon("")).toBe("");
    expect(sanitizeNavigationIcon("/assets/seed-icons/nav/github.svg")).toBe(
      "/assets/seed-icons/nav/github.svg",
    );
    expect(sanitizeNavigationIcon("/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8")).toBe(
      "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
    );
    expect(sanitizeNavigationIcon("/api/icons/icn_user")).toBe(
      "/api/icons/icn_user",
    );
    expect(sanitizeNavigationIcon("/api/assets/icons/icn_legacy")).toBe(
      "/api/icons/icn_legacy",
    );
    expect(sanitizeNavigationIcon("/assets/ai-usage/providers/openai.svg")).toBe(
      "",
    );
    expect(sanitizeNavigationIcon("/sd-live-assets/icon.svg")).toBe("");
    expect(sanitizeNavigationIcon("/api/site/icon?url=https%3A%2F%2Fexample.com")).toBe(
      "",
    );
    expect(sanitizeNavigationIcon("/icon-cache/example.svg")).toBe("");
    expect(sanitizeNavigationIcon("https://example.com/icon.png")).toBe("");
  });

  it("normalizes user-entered remote image URLs only as materialization input", () => {
    expect(
      normalizeRemoteNavigationIconUrl(
        "https://grok.com/images/android-chrome-192x192.png#ignored",
      ),
    ).toBe("https://grok.com/images/android-chrome-192x192.png");
    expect(
      sanitizeNavigationIcon(
        "https://grok.com/images/android-chrome-192x192.png#ignored",
      ),
    ).toBe("");
    expect(normalizeRemoteNavigationIconUrl("javascript:alert(1)")).toBe("");
    expect(
      normalizeRemoteNavigationIconUrl("https://user:pass@example.com/icon.png"),
    ).toBe("");
    expect(sanitizeNavigationIcon("javascript:alert(1)")).toBe("");
  });

  it("sanitizes snapshots before cache and save paths persist them", () => {
    const snapshot = sanitizeSnapshotIcons({
      groups: [
        {
          id: "g",
          title: "G",
          items: [
            { id: "seed", icon: "/assets/seed-icons/nav/github.svg" },
            { id: "meta", icon: "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8" },
            { id: "user", icon: "/api/assets/icons/icn_legacy" },
            {
              id: "remote",
              icon: "https://grok.com/images/android-chrome-192x192.png#manual",
            },
            { id: "app", icon: "/assets/ai-usage/providers/openai.svg" },
          ],
        },
      ],
    });
    expect(snapshot.groups[0].items.map((item) => item.icon)).toEqual([
      "/assets/seed-icons/nav/github.svg",
      "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
      "/api/icons/icn_legacy",
      "",
      "",
    ]);
  });

  it("posts user provided icon bytes to the unified icon API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("/api/icons");
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            success: true,
            data: { url: "/api/icons/icn_created", id: "icn_created" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    await expect(
      materializeIconInput("data:image/svg+xml;base64,PHN2Zy8+"),
    ).resolves.toBe("/api/icons/icn_created");
  });

  it("uses managed icons for remote URLs when server materialization succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("/api/icons");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          source: {
            type: "remoteUrl",
            value: "https://example.com/icon.png",
          },
        });
        return new Response(
          JSON.stringify({
            success: true,
            data: { url: "/api/icons/icn_remote", id: "icn_remote" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    await expect(materializeIconInput("https://example.com/icon.png")).resolves.toBe(
      "/api/icons/icn_remote",
    );
    expect(mockedConnector).not.toHaveBeenCalled();
  });

  it("uploads browser-readable remote image bytes when server materialization is blocked", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/icons") {
        const body = JSON.parse(String(init?.body));
        if (body.source.type === "remoteUrl") {
          expect(body.source.value).toBe("https://example.com/icon.png");
          return new Response(JSON.stringify({ error: "fetch_failed" }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
        expect(body.source.type).toBe("dataUrl");
        expect(body.source.value).toMatch(/^data:image\/png;base64,/);
        return new Response(
          JSON.stringify({
            success: true,
            data: { url: "/api/icons/icn_uploaded", id: "icn_uploaded" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      expect(String(input)).toBe("https://example.com/icon.png");
      expect(init?.credentials).toBe("omit");
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    });
    vi.stubGlobal("fetch", fetch);

    await expect(materializeIconInput("https://example.com/icon.png")).resolves.toBe(
      "/api/icons/icn_uploaded",
    );
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(mockedConnector).not.toHaveBeenCalled();
  });

  it("uses the local connector when server and page remote image reads are blocked", async () => {
    mockedConnector.mockResolvedValue({
      url: "https://example.com/icon.png",
      contentType: "image/png",
      byteSize: 3,
      dataUrl: "data:image/png;base64,AQID",
    });
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/icons") {
        const body = JSON.parse(String(init?.body));
        if (body.source.type === "remoteUrl") {
          expect(body.source.value).toBe("https://example.com/icon.png");
          return new Response(JSON.stringify({ error: "fetch_failed" }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
        expect(body.source.type).toBe("dataUrl");
        expect(body.source.value).toBe("data:image/png;base64,AQID");
        return new Response(
          JSON.stringify({
            success: true,
            data: { url: "/api/icons/icn_connector", id: "icn_connector" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      expect(String(input)).toBe("https://example.com/icon.png");
      throw new TypeError("CORS");
    });
    vi.stubGlobal("fetch", fetch);

    await expect(materializeIconInput("https://example.com/icon.png")).resolves.toBe(
      "/api/icons/icn_connector",
    );
    expect(mockedConnector).toHaveBeenCalledWith(
      "icons.fetchRemoteImage",
      { url: "https://example.com/icon.png", maxBytes: 5 * 1024 * 1024 },
      12_000,
    );
  });

  it("fails remote icon fallback when browser and connector fetch are blocked", async () => {
    mockedConnector.mockRejectedValue(new Error("connector_unavailable"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/icons") {
          return new Response(JSON.stringify({ error: "fetch_failed" }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
        throw new TypeError("CORS");
      }),
    );

    await expect(materializeIconInput("https://example.com/icon.png")).rejects.toThrow(
      "本地扩展都无法读取",
    );
    expect(mockedConnector).toHaveBeenCalledWith(
      "icons.fetchRemoteImage",
      { url: "https://example.com/icon.png", maxBytes: 5 * 1024 * 1024 },
      12_000,
    );
  });

  it("rejects remote icon fallback when browser bytes are not an image", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/icons") {
          return new Response(JSON.stringify({ error: "fetch_failed" }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("<html></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }),
    );

    await expect(materializeIconInput("https://example.com/icon.png")).rejects.toThrow(
      "不是有效图片",
    );
    expect(mockedConnector).not.toHaveBeenCalled();
  });

  it("rejects remote icon fallback when browser bytes are too large", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/icons") {
          return new Response(JSON.stringify({ error: "fetch_failed" }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(new Uint8Array(5 * 1024 * 1024 + 1), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      }),
    );

    await expect(materializeIconInput("https://example.com/icon.png")).rejects.toThrow(
      "超过 5MB",
    );
    expect(mockedConnector).not.toHaveBeenCalled();
  });

  it("drops credential-bearing remote icon URLs without posting them", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(
      materializeIconInput("https://user:pass@example.com/icon.png"),
    ).resolves.toBe("");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not post already canonical seed, meta, or user icon URLs", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    for (const icon of [
      "/assets/seed-icons/nav/github.svg",
      "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
      "/api/icons/icn_user",
    ]) {
      expect(isCanonicalIconUrl(icon)).toBe(true);
      await expect(materializeIconInput(icon)).resolves.toBe(icon);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
