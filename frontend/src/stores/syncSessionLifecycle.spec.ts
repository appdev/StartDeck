// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick, ref } from "vue";
import { useSyncStore } from "./sync";
import { useAuthStore } from "./auth";
import { useCacheStore } from "./cache";
import { useGroupsStore } from "./groups";
import { useWidgetsStore } from "./widgets";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import { SD_CLOCK_WIDGET_TYPE } from "@/features/sd-clock/sdClockTypes";
import { sessionFetch } from "@/utils/sessionFetch";

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

vi.mock("@/utils/offlineQueue", () => ({
  enqueue: vi.fn(async () => undefined),
  enqueueWidget: vi.fn(async () => undefined),
  size: vi.fn(async () => 0),
  clear: vi.fn(async () => undefined),
  getAll: vi.fn(async () => []),
  quarantineMismatched: vi.fn(async () => undefined),
  replay: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
}));

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

const privateWidget = {
  id: "private-todo",
  type: "todo",
  enable: true,
  isPublic: false,
  x: 0,
  y: 0,
  w: 2,
  h: 2,
  data: [{ id: "secret", text: "private task", done: false }],
};

const seedAuthenticatedState = () => {
  const auth = useAuthStore();
  const groups = useGroupsStore();
  const widgets = useWidgetsStore();

  auth.sessionReady = true;
  auth.username = "admin";
  auth.sessionGeneration = "stale-session";
  localStorage.setItem("start-deck-username", "admin");
  groups.groups = [
    {
      id: "private-main",
      title: "Private",
      items: [
        {
          id: "private-link",
          title: "Private Link",
          url: "https://private.example/",
          icon: "",
        },
      ],
    },
  ];
  widgets.widgets = [privateWidget];
  widgets.updateLastSavedLayout();
  return { auth, groups, widgets };
};

const authenticatedSnapshot = {
  appConfig: { customTitle: "Private Default" },
  groups: [
    {
      id: "private-main",
      title: "Private",
      items: [
        {
          id: "private-link",
          title: "Private Link",
          url: "https://private.example/",
          icon: "",
        },
      ],
    },
  ],
  widgets: [
    {
      id: "auth-clock",
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
  username: "admin",
  authenticated: true,
  sessionGeneration: "server-session-generation",
  version: 20,
};

const waitForAsyncGuestTransition = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
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
    expect(sync.activeSnapshotRole).toBe("guest");
    expect(sync.isClientReady).toBe(true);
  });

  it("keeps logged-out startup renderable while the guest snapshot is pending", async () => {
    const sync = useSyncStore();
    const cache = useCacheStore();
    const groups = useGroupsStore();
    const widgets = useWidgetsStore();
    let resolveData!: (response: Response) => void;
    const dataResponse = new Promise<Response>((resolve) => {
      resolveData = resolve;
    });

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
          return dataResponse;
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const initPromise = sync.init();
    await nextTick();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sync.activeSnapshotRole).toBe("guest");
    expect(sync.isClientReady).toBe(true);
    expect(sync.hasServerSnapshot).toBe(false);
    expect(cache.cacheLoadedAt).not.toBeNull();
    expect(groups.groups).toHaveLength(0);
    expect(widgets.widgets).toHaveLength(0);

    resolveData(
      new Response(JSON.stringify(guestSnapshot), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await initPromise;
    await nextTick();

    expect(sync.activeSnapshotRole).toBe("guest");
    expect(sync.isClientReady).toBe(true);
    expect(sync.hasServerSnapshot).toBe(true);
    expect(cache.cacheLoadedAt).toBeNull();
    expect(groups.groups).toHaveLength(1);
    expect(widgets.widgets).toHaveLength(1);
  });

  it("restores authenticated state from an explicit data snapshot after session bootstrap fails", async () => {
    const sync = useSyncStore();
    const auth = useAuthStore();
    const groups = useGroupsStore();
    const widgets = useWidgetsStore();

    localStorage.setItem("start-deck-username", "admin");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/session")) {
          throw new TypeError("session endpoint blocked");
        }
        if (url.includes("/api/data")) {
          return new Response(
            JSON.stringify({
              appConfig: { customTitle: "Private Default" },
              groups: [
                {
                  id: "private-main",
                  title: "Private",
                  items: [{ id: "private-link", title: "Private Link" }],
                },
              ],
              widgets: [
                {
                  id: "auth-clock",
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
              username: "admin",
              authenticated: true,
              sessionGeneration: "server-session-generation",
              version: 20,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    await sync.init();
    await nextTick();
    await Promise.resolve();

    expect(auth.isLogged).toBe(true);
    expect(auth.username).toBe("admin");
    expect(auth.sessionGeneration).toBe("server-session-generation");
    expect(localStorage.getItem("start-deck-username")).toBe("admin");
    expect(groups.groups[0]?.id).toBe("private-main");
    expect(groups.groups[0]?.items[0]?.id).toBe("private-link");
    expect(
      widgets.widgets.some((widget) => widget.type === SD_CLOCK_WIDGET_TYPE),
    ).toBe(true);
    expect(sync.activeSnapshotRole).toBe("auth");
    expect(sync.isClientReady).toBe(true);
  });

  it("preserves the authenticated snapshot while init revalidates session and data", async () => {
    const sync = useSyncStore();
    const auth = useAuthStore();
    const cache = useCacheStore();
    const groups = useGroupsStore();
    const widgets = useWidgetsStore();
    let resolveSession!: (response: Response) => void;
    let resolveData!: (response: Response) => void;
    const sessionResponse = new Promise<Response>((resolve) => {
      resolveSession = resolve;
    });
    const dataResponse = new Promise<Response>((resolve) => {
      resolveData = resolve;
    });

    auth.applyServerSession("admin", "existing-session-generation");
    groups.groups = [
      {
        id: "private-main",
        title: "Private",
        items: [
          {
            id: "private-link",
            title: "Private Link",
            url: "https://private.example/",
            icon: "",
          },
        ],
      },
    ];
    widgets.widgets = [privateWidget];
    widgets.updateLastSavedLayout();
    sync.activeSnapshotRole = "auth";
    cache.hasServerSnapshot = true;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/session")) {
          return sessionResponse;
        }
        if (url.includes("/api/data")) {
          return dataResponse;
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const initPromise = sync.init();
    await nextTick();
    await Promise.resolve();

    expect(auth.isLogged).toBe(true);
    expect(sync.activeSnapshotRole).toBe("auth");
    expect(sync.isClientReady).toBe(true);
    expect(groups.groups[0]?.id).toBe("private-main");
    expect(widgets.widgets).toHaveLength(1);

    resolveSession(
      new Response(
        JSON.stringify({
          authenticated: true,
          username: "admin",
          sessionGeneration: "server-session-generation",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    await nextTick();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(auth.isLogged).toBe(true);
    expect(sync.activeSnapshotRole).toBe("auth");
    expect(sync.isClientReady).toBe(true);
    expect(groups.groups[0]?.id).toBe("private-main");
    expect(widgets.widgets).toHaveLength(1);

    resolveData(
      new Response(JSON.stringify(authenticatedSnapshot), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await initPromise;
    await nextTick();

    expect(auth.isLogged).toBe(true);
    expect(auth.sessionGeneration).toBe("server-session-generation");
    expect(sync.activeSnapshotRole).toBe("auth");
    expect(sync.isClientReady).toBe(true);
    expect(groups.groups[0]?.id).toBe("private-main");
    expect(
      widgets.widgets.some((widget) => widget.type === SD_CLOCK_WIDGET_TYPE),
    ).toBe(true);
  });

  it("ignores contaminated legacy guest cache during logged-out startup", async () => {
    localStorage.setItem(
      "start-deck-data-cache:guest",
      JSON.stringify({
        username: "__guest__",
        isGuest: true,
        groups: [
          {
            id: "private-main",
            title: "Private",
            items: [{ id: "private-link", title: "Private Link" }],
          },
        ],
        widgets: [privateWidget],
        version: 99,
      }),
    );
    const sync = useSyncStore();
    const groups = useGroupsStore();
    const widgets = useWidgetsStore();

    await sync.init();
    await nextTick();
    await Promise.resolve();

    expect(groups.groups).toHaveLength(1);
    expect(groups.groups[0]?.id).toBe("guest-main");
    expect(groups.groups[0]?.items[0]?.id).toBe("public-link");
    expect(widgets.widgets).toHaveLength(1);
    expect(widgets.widgets[0]).toMatchObject({
      id: "clock",
      type: SD_CLOCK_WIDGET_TYPE,
    });
    expect(
      widgets.widgets.some((widget) => widget.id === "private-todo"),
    ).toBe(false);
    expect(sync.activeSnapshotRole).toBe("guest");
    expect(sync.isClientReady).toBe(true);
  });

  it("replaces authenticated content with guest data after a session invalid event", async () => {
    const sync = useSyncStore();
    const { auth, groups, widgets } = seedAuthenticatedState();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/protected")) {
          return new Response(JSON.stringify({ error: "invalid_token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
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

    await sessionFetch("/api/protected");
    await waitForAsyncGuestTransition();

    expect(auth.isLogged).toBe(false);
    expect(groups.groups).toHaveLength(1);
    expect(groups.groups[0]?.id).toBe("guest-main");
    expect(groups.groups[0]?.items[0]?.id).toBe("public-link");
    expect(widgets.widgets).toHaveLength(1);
    expect(widgets.widgets[0]).toMatchObject({
      id: "clock",
      type: SD_CLOCK_WIDGET_TYPE,
    });
    expect(sync.activeSnapshotRole).toBe("guest");
    expect(sync.isClientReady).toBe(true);
  });

  it("applies guest fallback data when a stale local auth state fetches /api/data", async () => {
    const sync = useSyncStore();
    const { auth, groups, widgets } = seedAuthenticatedState();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
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

    await sync.fetchData();
    await nextTick();

    expect(auth.isLogged).toBe(false);
    expect(groups.groups).toHaveLength(1);
    expect(groups.groups[0]?.id).toBe("guest-main");
    expect(groups.groups[0]?.items[0]?.id).toBe("public-link");
    expect(widgets.widgets).toHaveLength(1);
    expect(widgets.widgets[0]).toMatchObject({
      id: "clock",
      type: SD_CLOCK_WIDGET_TYPE,
    });
    expect(sync.activeSnapshotRole).toBe("guest");
  });

  it("uses credentialless guest fallback when logged-out startup rejects auth snapshots", async () => {
    const sync = useSyncStore();
    const { auth, groups, widgets } = seedAuthenticatedState();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/session")) {
          return new Response(JSON.stringify({ authenticated: false }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/api/data") && init?.credentials === "omit") {
          return new Response(JSON.stringify(guestSnapshot), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/api/data")) {
          return new Response(
            JSON.stringify({
              groups: [
                {
                  id: "private-main",
                  title: "Private",
                  items: [{ id: "private-link", title: "Private Link" }],
                },
              ],
              widgets: [privateWidget],
              username: "admin",
              version: 20,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    auth.clearLocalSession();
    groups.groups = [];
    widgets.widgets = [];

    await sync.init();
    await nextTick();

    expect(auth.isLogged).toBe(false);
    expect(groups.groups).toHaveLength(1);
    expect(groups.groups[0]?.id).toBe("guest-main");
    expect(groups.groups[0]?.items[0]?.id).toBe("public-link");
    expect(widgets.widgets).toHaveLength(1);
    expect(widgets.widgets[0]).toMatchObject({
      id: "clock",
      type: SD_CLOCK_WIDGET_TYPE,
    });
    expect(sync.activeSnapshotRole).toBe("guest");
    expect(sync.hasServerSnapshot).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "/api/data",
      expect.objectContaining({ credentials: "omit" }),
    );
    expect(localStorage.getItem("start-deck-data-cache:guest")).not.toBeNull();
  });
});
