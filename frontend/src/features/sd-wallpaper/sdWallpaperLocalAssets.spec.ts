// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionFetch } from "@/utils/sessionFetch";
import {
  localizeSdWallpaperAsset,
  SdWallpaperLocalAssetError,
} from "./sdWallpaperLocalAssets";

vi.mock("@/utils/sessionFetch", () => ({
  sessionFetch: vi.fn(),
}));

const sessionFetchMock = vi.mocked(sessionFetch);

const imageResponse = (blob: Blob) =>
  ({
    ok: true,
    status: 200,
    blob: vi.fn().mockResolvedValue(blob),
  }) as unknown as Response;

const uploadResponse = (path = "/backgrounds/bing-one.jpg") =>
  ({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      success: true,
      files: [{ path, filename: path.slice(path.lastIndexOf("/") + 1) }],
    }),
  }) as unknown as Response;

const errorResponse = (status: number, text = "") =>
  ({
    ok: false,
    status,
    statusText: `HTTP ${status}`,
    text: vi.fn().mockResolvedValue(text),
  }) as unknown as Response;

describe("sdWallpaperLocalAssets", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("proxies and uploads a remote wallpaper to a local path", async () => {
    sessionFetchMock
      .mockResolvedValueOnce(
        imageResponse(new Blob(["image"], { type: "image/jpeg" })),
      )
      .mockResolvedValueOnce(uploadResponse());

    const result = await localizeSdWallpaperAsset({
      sourceUrl: "https://www.bing.com/wallpaper.jpg?t=123",
      filenameSeed: "bing-one",
      requestId: "request-one",
    });

    expect(result).toMatchObject({
      sourceUrl: "https://www.bing.com/wallpaper.jpg",
      localPath: "/backgrounds/bing-one.jpg",
      filename: "bing-one.jpg",
      target: "pc",
    });
    expect(sessionFetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/wallpaper/proxy?url=https%3A%2F%2Fwww.bing.com%2Fwallpaper.jpg&uuid=request-one",
    );
    expect(sessionFetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/backgrounds/upload",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
  });

  it("throws on proxy failure without direct-fetching the source URL", async () => {
    const directFetch = vi.fn();
    vi.stubGlobal("fetch", directFetch);
    sessionFetchMock.mockResolvedValueOnce(errorResponse(502));

    await expect(
      localizeSdWallpaperAsset({
        sourceUrl: "https://www.bing.com/fail.jpg",
        filenameSeed: "bing-fail",
      }),
    ).rejects.toMatchObject({ code: "proxy_failed" });

    expect(sessionFetchMock).toHaveBeenCalledTimes(1);
    expect(directFetch).not.toHaveBeenCalled();
  });

  it("rejects empty and non-image proxy blobs before upload", async () => {
    sessionFetchMock.mockResolvedValueOnce(
      imageResponse(new Blob([], { type: "image/jpeg" })),
    );

    await expect(
      localizeSdWallpaperAsset({
        sourceUrl: "https://www.bing.com/empty.jpg",
        filenameSeed: "empty",
      }),
    ).rejects.toBeInstanceOf(SdWallpaperLocalAssetError);
    expect(sessionFetchMock).toHaveBeenCalledTimes(1);

    sessionFetchMock.mockResolvedValueOnce(
      new Response(new Blob(["nope"], { type: "text/html" }), {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    await expect(
      localizeSdWallpaperAsset({
        sourceUrl: "https://www.bing.com/not-image",
        filenameSeed: "not-image",
      }),
    ).rejects.toMatchObject({ code: "invalid_blob" });
    expect(sessionFetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when upload fails or returns no local path", async () => {
    sessionFetchMock
      .mockResolvedValueOnce(
        imageResponse(new Blob(["image"], { type: "image/png" })),
      )
      .mockResolvedValueOnce(errorResponse(500, "upload bad"));

    await expect(
      localizeSdWallpaperAsset({
        sourceUrl: "https://www.bing.com/upload-fail.png",
        filenameSeed: "upload-fail",
      }),
    ).rejects.toMatchObject({ code: "upload_failed" });

    sessionFetchMock
      .mockResolvedValueOnce(
        imageResponse(new Blob(["image"], { type: "image/png" })),
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true, files: [{}] }),
      } as unknown as Response);

    await expect(
      localizeSdWallpaperAsset({
        sourceUrl: "https://www.bing.com/no-path.png",
        filenameSeed: "no-path",
      }),
    ).rejects.toMatchObject({ code: "missing_local_path" });
  });
});
