// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { nextTick } from "vue";
import WallpaperLibrary from "./WallpaperLibrary.vue";
import { fetchSdBingWallpapers } from "@/features/sd-wallpaper/sdWallpaperApi";
import type { SdBingWallpaperResult } from "@/features/sd-wallpaper/sdWallpaperApi";
import type { SdWallpaperEntry } from "@/features/sd-wallpaper/sdWallpaperTypes";

vi.mock("@/features/sd-wallpaper/sdWallpaperApi", () => ({
  fetchSdBingWallpapers: vi.fn(),
}));

const fetchBingWallpapersMock = vi.mocked(fetchSdBingWallpapers);

const buildWallpaperEntry = (id: string): SdWallpaperEntry => ({
  id,
  title: `Bing ${id}`,
  location: `Location ${id}`,
  credit: "Bing",
  thumbnailUrl: `https://example.com/${id}-thumb.jpg`,
  downloadUrl: `https://example.com/${id}.jpg`,
});

const buildResult = (
  currentPage: number,
  totalPages: number,
  entries: SdWallpaperEntry[],
): SdBingWallpaperResult => ({
  entries,
  sourceStatus: "ok",
  totalPages,
  pageSize: 24,
  currentPage,
});

const mountLibrary = () =>
  mount(WallpaperLibrary, {
    props: {
      show: false,
      initialTab: "api",
    },
    global: {
      plugins: [
        createTestingPinia({
          createSpy: () => vi.fn(),
          initialState: {
            config: {
              appConfig: {
                background: "/default-wallpaper.svg",
                mobileBackground: "/default-wallpaper.svg",
              },
            },
            network: {
              wallpaperListPc: ["default-wallpaper.svg"],
              wallpaperListMobile: ["default-wallpaper.svg"],
            },
          },
        }),
      ],
      stubs: {
        AppModalShell: {
          props: ["show"],
          template:
            '<section v-if="show" class="sd-modal-body"><slot /></section>',
        },
        AppSectionCard: {
          props: ["title"],
          template: "<section><h2>{{ title }}</h2><slot /></section>",
        },
        AppButton: {
          template: '<button v-bind="$attrs"><slot /></button>',
        },
        AppSegmentedControl: {
          template: "<div />",
        },
        ConfirmDialog: true,
      },
    },
  });

const setScrollMetrics = (
  element: HTMLElement,
  metrics: {
    clientHeight: number;
    scrollHeight: number;
    scrollTop: number;
  },
) => {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: metrics.clientHeight },
    scrollHeight: { configurable: true, value: metrics.scrollHeight },
    scrollTop: {
      configurable: true,
      get: () => metrics.scrollTop,
      set: (value) => {
        metrics.scrollTop = Number(value) || 0;
      },
    },
  });
};

describe("WallpaperLibrary Bing API loading", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads the next API page automatically when the modal body scrolls near bottom", async () => {
    fetchBingWallpapersMock
      .mockResolvedValueOnce(buildResult(1, 2, [buildWallpaperEntry("one")]))
      .mockResolvedValueOnce(buildResult(2, 2, [buildWallpaperEntry("two")]));

    const wrapper = mountLibrary();

    await wrapper.setProps({ show: true });
    await flushPromises();
    await nextTick();

    expect(fetchBingWallpapersMock).toHaveBeenCalledWith(
      24,
      false,
      undefined,
      1,
    );
    expect(fetchBingWallpapersMock).toHaveBeenCalledTimes(1);
    expect(
      wrapper.findAll("button").some((button) => button.text() === "加载更多"),
    ).toBe(false);

    const scrollRoot = wrapper.find(".sd-modal-body").element as HTMLElement;
    setScrollMetrics(scrollRoot, {
      clientHeight: 500,
      scrollHeight: 1200,
      scrollTop: 820,
    });
    scrollRoot.dispatchEvent(new Event("scroll"));
    await flushPromises();
    await nextTick();

    expect(fetchBingWallpapersMock).toHaveBeenLastCalledWith(
      24,
      false,
      undefined,
      2,
    );
    expect(wrapper.text()).toContain("Bing two");
    expect(wrapper.text()).toContain("已全部加载");

    wrapper.unmount();
  });

  it("does not chain extra API pages without another scroll event", async () => {
    fetchBingWallpapersMock
      .mockResolvedValueOnce(buildResult(1, 3, [buildWallpaperEntry("one")]))
      .mockResolvedValueOnce(buildResult(2, 3, [buildWallpaperEntry("two")]))
      .mockResolvedValueOnce(buildResult(3, 3, [buildWallpaperEntry("three")]));

    const wrapper = mountLibrary();

    await wrapper.setProps({ show: true });
    await flushPromises();
    await nextTick();

    const scrollRoot = wrapper.find(".sd-modal-body").element as HTMLElement;
    setScrollMetrics(scrollRoot, {
      clientHeight: 500,
      scrollHeight: 1200,
      scrollTop: 820,
    });
    scrollRoot.dispatchEvent(new Event("scroll"));
    await flushPromises();
    await nextTick();
    expect(fetchBingWallpapersMock).toHaveBeenCalledTimes(2);

    await flushPromises();
    await nextTick();
    expect(fetchBingWallpapersMock).toHaveBeenCalledTimes(2);

    setScrollMetrics(scrollRoot, {
      clientHeight: 500,
      scrollHeight: 1800,
      scrollTop: 1420,
    });
    scrollRoot.dispatchEvent(new Event("scroll"));
    await flushPromises();
    await nextTick();

    expect(fetchBingWallpapersMock).toHaveBeenLastCalledWith(
      24,
      false,
      undefined,
      3,
    );
    expect(wrapper.text()).toContain("Bing three");

    wrapper.unmount();
  });
});
