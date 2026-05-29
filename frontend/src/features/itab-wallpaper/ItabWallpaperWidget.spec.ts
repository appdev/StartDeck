// @vitest-environment jsdom
import { nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMainStore } from "@/stores/main";
import { fetchItabBingWallpapers } from "./itabWallpaperApi";
import {
  patchItabWallpaperData,
  readItabWallpaperState,
} from "./itabWallpaperModel";
import ItabWallpaperWidget from "./ItabWallpaperWidget.vue";
import type { ItabWallpaperEntry } from "./itabWallpaperTypes";

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

const flushRuntime = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
};

describe("ItabWallpaperWidget", () => {
  beforeEach(() => {
    localStorage.setItem("start-deck-token", "token-for-test");
    setActivePinia(createPinia());
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
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("applies the latest daily wallpaper to the home background when auto update is enabled", async () => {
    const widget = {
      id: "wallpaper",
      type: "itab-wallpaper-16",
      enable: true,
      isPublic: true,
      data: patchItabWallpaperData(
        {},
        previousWallpaper,
        {
          dailyAutoUpdate: true,
          dimWallpaper: false,
          blurLevel: 0,
        },
        "2026-05-28T09:00:00+08:00",
      ),
    };
    const store = useMainStore();

    const wrapper = mount(ItabWallpaperWidget, {
      props: {
        widget,
        sizeKey: "2x2",
      },
    });
    await flushRuntime();

    expect(store.appConfig.background).toBe(latestWallpaper.downloadUrl);
    expect(store.appConfig.wallpaperConfig).toMatchObject({
      type: "api",
      url: latestWallpaper.downloadUrl,
      enabled: false,
    });
    const emittedData = wrapper.emitted("updateData")?.[0]?.[0];
    expect(readItabWallpaperState(emittedData)).toMatchObject({
      selectedWallpaperId: latestWallpaper.id,
      wallpaperUrl: latestWallpaper.downloadUrl,
      dailyAutoUpdate: true,
    });
  });
});
