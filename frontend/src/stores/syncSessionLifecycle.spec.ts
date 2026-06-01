// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick, ref } from "vue";
import { useSyncStore } from "./sync";
import { useGroupsStore } from "./groups";
import { useWidgetsStore } from "./widgets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import { SD_CLOCK_WIDGET_TYPE } from "@/features/sd-clock/sdClockTypes";

vi.mock("@vueuse/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    useWebSocket: () => ({
      status: ref("CLOSED"),
      data: ref(null),
      send: vi.fn(),
      open: vi.fn(),
      close: vi.fn(),
    }),
  };
});

const guestSnapshot = {
  appConfig: { customTitle: "Guest Default" },
  groups: [
    {
      id: "guest-main",
      title: "常用",
      items: [
        {
          id: "public-link",
          title: "掘金",
          url: "https://juejin.cn/",
          icon: "",
        },
      ],
    },
  ],
  widgets: [
    {
      id: "guest-clock",
      type: SD_CLOCK_WIDGET_TYPE,
      enable: true,
      x: 0,
      y: 0,
      w: 2,
      h: 2,
      colSpan: 2,
      rowSpan: 2,
      data: {
        runtime: "sd-clock",
        layoutSystem: SD_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
      },
    },
  ],
  username: "__guest__",
  isGuest: true,
  version: 0,
};

describe("sync session lifecycle", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/session")) {
          return new Response(JSON.stringify({ authenticated: false }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/api/data")) {
          return new Response(JSON.stringify(guestSnapshot), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("keeps the initial guest server snapshot after auth bootstrap settles", async () => {
    const sync = useSyncStore();
    const groups = useGroupsStore();
    const widgets = useWidgetsStore();

    await sync.init();
    await nextTick();
    await Promise.resolve();

    expect(groups.groups).toHaveLength(1);
    expect(groups.groups[0]).toMatchObject({
      id: "guest-main",
      title: "常用",
    });
    expect(groups.groups[0]?.items).toHaveLength(1);
    expect(widgets.widgets).toHaveLength(1);
    expect(widgets.widgets[0]).toMatchObject({
      id: "clock",
      type: SD_CLOCK_WIDGET_TYPE,
    });
    expect(sync.isClientReady).toBe(true);
  });
});
