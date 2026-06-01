// @vitest-environment jsdom
import { nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSdBingWallpapers } from "./sdWallpaperApi";
import {
  patchSdWallpaperData,
  readSdWallpaperState,
} from "./sdWallpaperModel";
import { useSdWallpaperRuntime } from "./useSdWallpaperRuntime";
import type {
  SdWallpaperEntry,
  SdWallpaperSettings,
} from "./sdWallpaperTypes";

vi.mock("./sdWallpaperApi", () => ({
  fetchSdBingWallpapers: vi.fn(),
}));

const previousWallpaper: SdWallpaperEntry = {
  id: "bing-2026-05-28",
  title: "Previous Bing wallpaper",
  location: "Sichuan",
  credit: "Bing",
  thumbnailUrl: "https://www.bing.com/previous-thumb.jpg",
  downloadUrl: "https://www.bing.com/previous-uhd.jpg",
};

const latestWallpaper: SdWallpaperEntry = {
  id: "bing-2026-05-29",
  title: "Latest Bing wallpaper",
  location: "Worcester",
  credit: "Bing",
  thumbnailUrl: "https://www.bing.com/latest-thumb.jpg",
  downloadUrl: "https://www.bing.com/latest-uhd.jpg",
};

const defaultSettings: SdWallpaperSettings = {
  dailyAutoUpdate: true,
  dimWallpaper: false,
  blurLevel: 0,
};

const flushRuntime = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
};

describe("wallpaper runtime", () => {
  beforeEach(() => {
    vi.mocked(fetchSdBingWallpapers).mockResolvedValue({
      entries: [latestWallpaper],
      sourceStatus: "ok",
      count: 1,
      totalPages: 1,
      pageSize: 24,
      currentPage: 1,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("auto-applies the latest daily wallpaper after a previous Bing wallpaper was applied", async () => {
    const widget = ref({
      data: patchSdWallpaperData(
        {},
        previousWallpaper,
        defaultSettings,
        "2026-05-28T09:00:00+08:00",
      ),
    });
    const updates: SdWallpaperEntry[] = [];

    const runtime = useSdWallpaperRuntime(widget, {
      onDailyAutoUpdate: (entry, settings) => {
        updates.push(entry);
        widget.value.data = patchSdWallpaperData(
          widget.value.data,
          entry,
          settings,
          "2026-05-29T09:00:00+08:00",
        );
      },
    });

    await flushRuntime();

    expect(fetchSdBingWallpapers).toHaveBeenCalledWith(
      24,
      false,
      undefined,
      1,
    );
    expect(updates).toEqual([latestWallpaper]);
    expect(runtime.activeWallpaperId.value).toBe(latestWallpaper.id);
    expect(readSdWallpaperState(widget.value.data)).toMatchObject({
      selectedWallpaperId: latestWallpaper.id,
      wallpaperUrl: latestWallpaper.downloadUrl,
      updatedAt: "2026-05-29T09:00:00+08:00",
    });
  });

  it("does not mutate empty default state even though daily auto update defaults to on", async () => {
    const widget = ref({ data: {} });
    const onDailyAutoUpdate = vi.fn();
    const runtime = useSdWallpaperRuntime(widget, { onDailyAutoUpdate });

    await flushRuntime();

    expect(onDailyAutoUpdate).not.toHaveBeenCalled();
    expect(runtime.activeWallpaper.value?.id).toBe(latestWallpaper.id);
    expect(widget.value.data).toEqual({});
  });

  it("does not auto-apply when the persisted setting is disabled", async () => {
    const widget = ref({
      data: patchSdWallpaperData(
        {},
        previousWallpaper,
        { ...defaultSettings, dailyAutoUpdate: false },
        "2026-05-28T09:00:00+08:00",
      ),
    });
    const onDailyAutoUpdate = vi.fn();

    useSdWallpaperRuntime(widget, { onDailyAutoUpdate });
    await flushRuntime();

    expect(onDailyAutoUpdate).not.toHaveBeenCalled();
    expect(readSdWallpaperState(widget.value.data)).toMatchObject({
      selectedWallpaperId: previousWallpaper.id,
      wallpaperUrl: previousWallpaper.downloadUrl,
      dailyAutoUpdate: false,
    });
  });
});
