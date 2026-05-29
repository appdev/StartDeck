// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { useAuthStore } from "./auth";
import { useCacheStore } from "./cache";
import { useWidgetsStore } from "./widgets";
import { useGroupsStore } from "./groups";
import type { WidgetConfig } from "@/types";

const privateWidget: WidgetConfig = {
  id: "private-todo",
  type: "todo",
  enable: true,
  isPublic: false,
  x: 0,
  y: 0,
  w: 1,
  h: 1,
  data: [{ id: "1", text: "secret", done: false }],
};

describe("cache store auth scope", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not restore authenticated cache for guest sessions", () => {
    const auth = useAuthStore();
    const cache = useCacheStore();
    const widgets = useWidgetsStore();

    auth.token = "token";
    auth.username = "admin";
    cache.saveToCache({
      groups: [],
      widgets: [privateWidget],
      appConfig: {},
      systemConfig: { enableDocker: false },
      username: "admin",
      version: 1,
    });

    widgets.widgets = [];
    auth.logout();

    const loaded = cache.loadFromCache(ref(0));
    expect(loaded).toBe(false);
    expect(widgets.widgets).toEqual([]);
  });

  it("loads only the guest cache while logged out", () => {
    const cache = useCacheStore();
    const widgets = useWidgetsStore();
    const groups = useGroupsStore();

    cache.saveToCache({
      groups: [
        { id: "public-group", title: "Public", items: [], isPublic: true },
      ],
      widgets: [
        { ...privateWidget, id: "public-clock", type: "clock", isPublic: true },
      ],
      appConfig: {},
      systemConfig: { enableDocker: false },
      version: 2,
    });

    widgets.widgets = [];
    groups.groups = [];
    const version = ref(0);
    const loaded = cache.loadFromCache(version);

    expect(loaded).toBe(true);
    expect(widgets.widgets).toEqual([]);
    expect(widgets.widgets.some((widget) => widget.id === "private-todo")).toBe(
      false,
    );
    expect(version.value).toBe(2);
  });

  it("clears stale authenticated state when the server rejects the stored token", async () => {
    const auth = useAuthStore();
    const cache = useCacheStore();
    const widgets = useWidgetsStore();
    const version = ref(0);

    auth.token = "stale-token";
    auth.username = "admin";
    localStorage.setItem("start-deck-token", "stale-token");
    localStorage.setItem("start-deck-username", "admin");
    widgets.widgets = [privateWidget];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "invalid_token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      cache.loadServerSnapshot(
        () => undefined,
        () => undefined,
      ),
    ).rejects.toThrow("Init unauthorized with stored token");

    expect(auth.isLogged).toBe(false);
    expect(auth.username).toBe("");
    expect(localStorage.getItem("start-deck-token")).toBeNull();
    expect(localStorage.getItem("start-deck-username")).toBeNull();
    expect(version.value).toBe(0);
  });
});
