// @vitest-environment jsdom
import { nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/auth";
import { useMainStore } from "@/stores/main";
import { fetchSdBingWallpapers } from "./sdWallpaperApi";
import { localizeSdWallpaperAsset } from "./sdWallpaperLocalAssets";
import {
  patchSdWallpaperData,
  readSdWallpaperState,
} from "./sdWallpaperModel";
import SdWallpaperOpenedPanel from "./SdWallpaperOpenedPanel.vue";
import type { SdWallpaperEntry } from "./sdWallpaperTypes";

vi.mock("./sdWallpaperApi", () => ({
  fetchSdBingWallpapers: vi.fn(),
}));

vi.mock("./sdWallpaperLocalAssets", () => ({
  localizeSdWallpaperAsset: vi.fn(),
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
  downloadUrl: "https://www.bing.com/latest-uhd.jpg?t=123",
};

const flushRuntime = async () => {
  await flushPromises();
  await nextTick();
};

const prepareStore = () => {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.sessionReady = true;
  auth.username = "ying";
  auth.sessionGeneration = "test-session";

  const store = useMainStore();
  const widget = {
    id: "wallpaper",
    type: "sd-wallpaper-16",
    enable: true,
    isPublic: true,
    data: patchSdWallpaperData(
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
  store.widgets = [widget];
  store.appConfig.background = "/backgrounds/previous-local.jpg";
  store.appConfig.solidBackgroundColor = "";
  store.appConfig.pcRotation = false;
  store.appConfig.wallpaperConfig = {
    type: "api",
    url: previousWallpaper.downloadUrl,
    enabled: false,
    lastUpdated: 1,
  };
  store.wallpaperListPc = ["default-wallpaper.svg", "previous-local.jpg"];
  store.appConfig.pcWallpaperOrder = [
    "default-wallpaper.svg",
    "previous-local.jpg",
  ];
  return { store, widget };
};

const mountPanel = (widget: ReturnType<typeof prepareStore>["widget"]) =>
  mount(SdWallpaperOpenedPanel, {
    props: { widget },
  });

describe("SdWallpaperOpenedPanel apply", () => {
  beforeEach(() => {
    vi.mocked(fetchSdBingWallpapers).mockResolvedValue({
      entries: [latestWallpaper],
      sourceStatus: "ok",
      count: 1,
      totalPages: 1,
      pageSize: 24,
      currentPage: 1,
    });
    vi.mocked(localizeSdWallpaperAsset).mockResolvedValue({
      sourceUrl: "https://www.bing.com/latest-uhd.jpg",
      localPath: "/backgrounds/latest-local.jpg",
      filename: "latest-local.jpg",
      target: "pc",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("applies a localized wallpaper and prepends it to the PC list after save", async () => {
    const { store, widget } = prepareStore();
    vi.spyOn(store, "saveData").mockResolvedValue("saved");
    const wrapper = mountPanel(widget);
    await flushRuntime();

    await wrapper.find("[data-sd-wallpaper-apply-featured]").trigger("click");
    await flushRuntime();

    expect(store.appConfig.background).toBe("/backgrounds/latest-local.jpg");
    expect(store.appConfig.wallpaperConfig).toMatchObject({
      type: "api",
      url: "https://www.bing.com/latest-uhd.jpg",
      enabled: false,
    });
    expect(store.wallpaperListPc).toEqual([
      "default-wallpaper.svg",
      "latest-local.jpg",
      "previous-local.jpg",
    ]);
    expect(store.appConfig.pcWallpaperOrder).toEqual(store.wallpaperListPc);
    expect(readSdWallpaperState(store.widgets[0]?.data)).toMatchObject({
      selectedWallpaperId: latestWallpaper.id,
      wallpaperUrl: latestWallpaper.downloadUrl,
    });
    expect(wrapper.find("[data-sd-wallpaper-apply-status]").text()).toContain(
      "已应用",
    );
  });

  it("accepts queued persistence without claiming server save completed", async () => {
    const { store, widget } = prepareStore();
    vi.spyOn(store, "saveData").mockResolvedValue("queued");
    const wrapper = mountPanel(widget);
    await flushRuntime();

    await wrapper.find("[data-sd-wallpaper-apply-featured]").trigger("click");
    await flushRuntime();

    expect(store.appConfig.background).toBe("/backgrounds/latest-local.jpg");
    expect(wrapper.find("[data-sd-wallpaper-apply-status]").text()).toContain(
      "已加入离线队列",
    );
  });

  it.each(["conflict", "unauthorized"] as const)(
    "rolls back local mutation on %s save result",
    async (result) => {
      const { store, widget } = prepareStore();
      const previousData = widget.data;
      vi.spyOn(store, "saveData").mockResolvedValue(result);
      const wrapper = mountPanel(widget);
      await flushRuntime();

      await wrapper.find("[data-sd-wallpaper-apply-featured]").trigger("click");
      await flushRuntime();

      expect(store.appConfig.background).toBe("/backgrounds/previous-local.jpg");
      expect(store.appConfig.wallpaperConfig).toMatchObject({
        url: previousWallpaper.downloadUrl,
        lastUpdated: 1,
      });
      expect(store.wallpaperListPc).toEqual([
        "default-wallpaper.svg",
        "previous-local.jpg",
      ]);
      expect(store.appConfig.pcWallpaperOrder).toEqual([
        "default-wallpaper.svg",
        "previous-local.jpg",
      ]);
      expect(store.widgets[0]?.data).toStrictEqual(previousData);
      expect(wrapper.emitted("updateData")?.at(-1)?.[0]).toStrictEqual(
        previousData,
      );
      expect(wrapper.find("[data-sd-wallpaper-apply-status]").text()).toContain(
        result === "conflict" ? "保存冲突" : "登录后保存",
      );
    },
  );

  it("rolls back local mutation when save throws", async () => {
    const { store, widget } = prepareStore();
    const previousData = widget.data;
    vi.spyOn(store, "saveData").mockRejectedValue(new Error("save exploded"));
    const wrapper = mountPanel(widget);
    await flushRuntime();

    await wrapper.find("[data-sd-wallpaper-apply-featured]").trigger("click");
    await flushRuntime();

    expect(store.appConfig.background).toBe("/backgrounds/previous-local.jpg");
    expect(store.widgets[0]?.data).toStrictEqual(previousData);
    expect(store.wallpaperListPc).toEqual([
      "default-wallpaper.svg",
      "previous-local.jpg",
    ]);
    expect(wrapper.emitted("updateData")?.at(-1)?.[0]).toStrictEqual(
      previousData,
    );
    expect(wrapper.find("[data-sd-wallpaper-apply-status]").text()).toContain(
      "save exploded",
    );
  });
});
