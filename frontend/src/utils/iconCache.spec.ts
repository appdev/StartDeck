// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cacheIconToLocal } from "./iconCache";

describe("iconCache", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends remote http icon addresses through the backend cache URL contract", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(input).toBe("/api/icon-cache");
        expect(JSON.parse(String(init?.body))).toEqual({
          url: "https://example.com/icon.svg",
        });
        return new Response(
          JSON.stringify({ success: true, url: "/icon-cache/remote.svg" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      cacheIconToLocal("https://example.com/icon.svg"),
    ).resolves.toEqual({
      path: "/icon-cache/remote.svg",
      error: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("inlines app image paths before caching so backend localhost blocking is avoided", async () => {
    class TestFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL(blob: Blob) {
        this.result = `data:${blob.type || "image/svg+xml"};base64,PHN2Zy8+`;
        this.onload?.();
      }
    }
    vi.stubGlobal("FileReader", TestFileReader);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      )
      .mockImplementationOnce(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          expect(input).toBe("/api/icon-cache");
          const body = JSON.parse(String(init?.body));
          expect(body.dataUrl).toMatch(/^data:image\/svg\+xml/);
          return new Response(
            JSON.stringify({ success: true, path: "/icon-cache/local.svg" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(cacheIconToLocal("/favicon.svg")).resolves.toEqual({
      path: "/icon-cache/local.svg",
      error: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "http://localhost:3000/favicon.svg",
    );
  });

  it("rejects non-url icon tokens before trying to cache them", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await cacheIconToLocal("hero-icon-token");

    expect(result.path).toBeNull();
    expect(result.error).toContain("图标地址格式不支持本地缓存");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
