import { describe, expect, it } from "vitest";
import {
  createItabWallpaperEntryFromState,
  patchItabWallpaperData,
  patchItabWallpaperSettingsData,
  readItabWallpaperState,
  shouldApplyItabWallpaperDailyAutoUpdate,
} from "./itabWallpaperModel";
import type {
  ItabWallpaperEntry,
  ItabWallpaperSettings,
} from "./itabWallpaperTypes";

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

const settings: ItabWallpaperSettings = {
  dailyAutoUpdate: true,
  dimWallpaper: false,
  blurLevel: 0,
};

describe("itabWallpaperModel", () => {
  it("detects when an applied Bing wallpaper should move to the latest daily entry", () => {
    const data = patchItabWallpaperData(
      {},
      previousWallpaper,
      settings,
      "2026-05-28T09:00:00+08:00",
    );
    const state = createItabWallpaperEntryFromState({
      selectedWallpaperId: "bing-2026-05-28",
      selectedWallpaperTitle: "Previous Bing wallpaper",
      wallpaperUrl: "https://www.bing.com/previous-uhd.jpg",
      wallpaperThumbnailUrl: "https://www.bing.com/previous-thumb.jpg",
    });

    expect(state).toMatchObject({
      id: previousWallpaper.id,
      title: previousWallpaper.title,
      thumbnailUrl: previousWallpaper.thumbnailUrl,
      downloadUrl: previousWallpaper.downloadUrl,
    });
    expect(
      shouldApplyItabWallpaperDailyAutoUpdate(
        readItabWallpaperState(data),
        settings,
        latestWallpaper,
      ),
    ).toBe(true);
  });

  it("does not auto-apply when the option is disabled or no wallpaper was applied before", () => {
    expect(
      shouldApplyItabWallpaperDailyAutoUpdate(
        {
          selectedWallpaperId: previousWallpaper.id,
          wallpaperUrl: previousWallpaper.downloadUrl,
        },
        { ...settings, dailyAutoUpdate: false },
        latestWallpaper,
      ),
    ).toBe(false);

    expect(
      shouldApplyItabWallpaperDailyAutoUpdate({}, settings, latestWallpaper),
    ).toBe(false);
  });

  it("patches settings without replacing the selected wallpaper metadata", () => {
    const original = patchItabWallpaperData(
      {},
      previousWallpaper,
      settings,
      "2026-05-28T09:00:00+08:00",
    );
    const patched = patchItabWallpaperSettingsData(
      original,
      {
        dailyAutoUpdate: false,
        dimWallpaper: true,
        blurLevel: 12,
      },
      "2026-05-29T09:00:00+08:00",
    );

    expect(readItabWallpaperState(patched)).toMatchObject({
      selectedWallpaperId: previousWallpaper.id,
      selectedWallpaperTitle: previousWallpaper.title,
      wallpaperUrl: previousWallpaper.downloadUrl,
      wallpaperThumbnailUrl: previousWallpaper.thumbnailUrl,
      dailyAutoUpdate: false,
      dimWallpaper: true,
      blurLevel: 12,
      updatedAt: "2026-05-29T09:00:00+08:00",
    });
  });
});
