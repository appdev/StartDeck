import { describe, expect, it } from "vitest";
import {
  createSdWallpaperEntryFromState,
  patchSdWallpaperData,
  patchSdWallpaperSettingsData,
  readSdWallpaperState,
  shouldApplySdWallpaperDailyAutoUpdate,
} from "./sdWallpaperModel";
import type {
  SdWallpaperEntry,
  SdWallpaperSettings,
} from "./sdWallpaperTypes";

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

const settings: SdWallpaperSettings = {
  dailyAutoUpdate: true,
  dimWallpaper: false,
  blurLevel: 0,
};

describe("wallpaper model", () => {
  it("detects when an applied Bing wallpaper should move to the latest daily entry", () => {
    const data = patchSdWallpaperData(
      {},
      previousWallpaper,
      settings,
      "2026-05-28T09:00:00+08:00",
    );
    const state = createSdWallpaperEntryFromState({
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
      shouldApplySdWallpaperDailyAutoUpdate(
        readSdWallpaperState(data),
        settings,
        latestWallpaper,
      ),
    ).toBe(true);
  });

  it("does not auto-apply when the option is disabled or no wallpaper was applied before", () => {
    expect(
      shouldApplySdWallpaperDailyAutoUpdate(
        {
          selectedWallpaperId: previousWallpaper.id,
          wallpaperUrl: previousWallpaper.downloadUrl,
        },
        { ...settings, dailyAutoUpdate: false },
        latestWallpaper,
      ),
    ).toBe(false);

    expect(
      shouldApplySdWallpaperDailyAutoUpdate({}, settings, latestWallpaper),
    ).toBe(false);
  });

  it("patches settings without replacing the selected wallpaper metadata", () => {
    const original = patchSdWallpaperData(
      {},
      previousWallpaper,
      settings,
      "2026-05-28T09:00:00+08:00",
    );
    const patched = patchSdWallpaperSettingsData(
      original,
      {
        dailyAutoUpdate: false,
        dimWallpaper: true,
        blurLevel: 12,
      },
      "2026-05-29T09:00:00+08:00",
    );

    expect(readSdWallpaperState(patched)).toMatchObject({
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
