// @vitest-environment jsdom
import { nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchItabBingWallpapers } from "./itabWallpaperApi";
import {
  patchItabWallpaperData,
  readItabWallpaperState,
} from "./itabWallpaperModel";
import { useItabWallpaperRuntime } from "./useItabWallpaperRuntime";
import type {
  ItabWallpaperEntry,
  ItabWallpaperSettings,
} from "./itabWallpaperTypes";

vi.mock("./itabWallpaperApi", () => ({
  fetchItabBingWallpapers: vi.fn(),
}));

const previousWallpaper: ItabWallpaperEntry = {
  id: "bing-2026-05-28",
  title: "Previous Bing wallpaper",
  location: "Sichuan",
  credit: "Bing",
  thumbnailUrl: "https://www.bing.com/previous-thumb.jpg",
  downloadUrl: "https://www.bing.com/previous-uhd.jpg",
};

const latestWallpaper: ItabWallpaperEntry = {
  id: "bing-2026-05-29",
  title: "Latest Bing wallpaper",
  location: "Worcester",
  credit: "Bing",
  thumbnailUrl: "https://www.bing.com/latest-thumb.jpg",
  downloadUrl: "https://www.bing.com/latest-uhd.jpg",
};

const defaultSettings: ItabWallpaperSettings = {
  dailyAutoUpdate: true,
  dimWallpaper: false,
  blurLevel: 0,
};

const flushRuntime = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
};

describe("useItabWallpaperRuntime", () => {
  beforeEach(() => {
    vi.mocked(fetchItabBingWallpapers).mockResolvedValue({
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
      data: patchItabWallpaperData(
        {},
        previousWallpaper,
        defaultSettings,
        "2026-05-28T09:00:00+08:00",
      ),
    });
    const updates: ItabWallpaperEntry[] = [];

    const runtime = useItabWallpaperRuntime(widget, {
      onDailyAutoUpdate: (entry, settings) => {
        updates.push(entry);
        widget.value.data = patchItabWallpaperData(
          widget.value.data,
          entry,
          settings,
          "2026-05-29T09:00:00+08:00",
        );
      },
    });

    await flushRuntime();

    expect(fetchItabBingWallpapers).toHaveBeenCalledWith(
      24,
      false,
      undefined,
      1,
    );
    expect(updates).toEqual([latestWallpaper]);
    expect(runtime.activeWallpaperId.value).toBe(latestWallpaper.id);
    expect(readItabWallpaperState(widget.value.data)).toMatchObject({
      selectedWallpaperId: latestWallpaper.id,
      wallpaperUrl: latestWallpaper.downloadUrl,
      updatedAt: "2026-05-29T09:00:00+08:00",
    });
  });

  it("does not mutate empty default state even though daily auto update defaults to on", async () => {
    const widget = ref({ data: {} });
    const onDailyAutoUpdate = vi.fn();
    const runtime = useItabWallpaperRuntime(widget, { onDailyAutoUpdate });

    await flushRuntime();

    expect(onDailyAutoUpdate).not.toHaveBeenCalled();
    expect(runtime.activeWallpaper.value?.id).toBe(latestWallpaper.id);
    expect(widget.value.data).toEqual({});
  });

  it("does not auto-apply when the persisted setting is disabled", async () => {
    const widget = ref({
      data: patchItabWallpaperData(
        {},
        previousWallpaper,
        { ...defaultSettings, dailyAutoUpdate: false },
        "2026-05-28T09:00:00+08:00",
      ),
    });
    const onDailyAutoUpdate = vi.fn();

    useItabWallpaperRuntime(widget, { onDailyAutoUpdate });
    await flushRuntime();

    expect(onDailyAutoUpdate).not.toHaveBeenCalled();
    expect(readItabWallpaperState(widget.value.data)).toMatchObject({
      selectedWallpaperId: previousWallpaper.id,
      wallpaperUrl: previousWallpaper.downloadUrl,
      dailyAutoUpdate: false,
    });
  });
});
