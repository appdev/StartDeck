// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
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
      systemConfig: { authMode: "single" },
      username: "admin",
      version: 1,
    });

    widgets.widgets = [];
    auth.logout();

    const loaded = cache.loadFromCache(ref([]), ref([]), ref(0));
    expect(loaded).toBe(false);
    expect(widgets.widgets).toEqual([]);
  });

  it("loads only the guest cache while logged out", () => {
    const cache = useCacheStore();
    const widgets = useWidgetsStore();
    const groups = useGroupsStore();

    cache.saveToCache({
      groups: [{ id: "public-group", title: "Public", items: [], isPublic: true }],
      widgets: [{ ...privateWidget, id: "public-clock", type: "clock", isPublic: true }],
      appConfig: {},
      systemConfig: { authMode: "single" },
      version: 2,
    });

    widgets.widgets = [];
    groups.groups = [];
    const version = ref(0);
    const loaded = cache.loadFromCache(ref([]), ref([]), version);

    expect(loaded).toBe(true);
    expect(widgets.widgets.some((widget) => widget.id === "public-clock")).toBe(true);
    expect(widgets.widgets.some((widget) => widget.id === "private-todo")).toBe(false);
    expect(version.value).toBe(2);
  });
});
