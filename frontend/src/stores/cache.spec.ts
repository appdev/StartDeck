// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { useAuthStore } from "./auth";
import { useCacheStore } from "./cache";
import { useWidgetsStore } from "./widgets";
import { useGroupsStore } from "./groups";
import { useUiFeedbackStore } from "./uiFeedback";
import type { WidgetConfig } from "@/types";
import {
  SESSION_EXPIRED_TOAST_MESSAGE,
  SESSION_EXPIRED_TOAST_TITLE,
} from "@/utils/sessionExpiredFeedback";

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
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not restore authenticated cache for guest sessions", () => {
    const auth = useAuthStore();
    const cache = useCacheStore();
    const widgets = useWidgetsStore();

    auth.sessionReady = true;
    auth.username = "ying";
    auth.sessionGeneration = "session";
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
    auth.clearLocalSession();

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
      isGuest: true,
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

  it("rejects legacy guest cache without an explicit guest marker", () => {
    const cache = useCacheStore();
    const widgets = useWidgetsStore();
    const groups = useGroupsStore();

    localStorage.setItem(
      "start-deck-data-cache:guest",
      JSON.stringify({
        username: "__guest__",
        groups: [{ id: "private", title: "Private", items: [] }],
        widgets: [privateWidget],
        version: 9,
      }),
    );

    const version = ref(0);
    const loaded = cache.loadFromCache(version);

    expect(loaded).toBe(false);
    expect(groups.groups).toEqual([]);
    expect(widgets.widgets).toEqual([]);
    expect(version.value).toBe(0);
  });

  it("rejects older guest cache schemas even with a guest marker", () => {
    const cache = useCacheStore();
    const widgets = useWidgetsStore();
    const groups = useGroupsStore();

    localStorage.setItem(
      "start-deck-data-cache:guest",
      JSON.stringify({
        username: "__guest__",
        isGuest: true,
        groups: [{ id: "private", title: "Private", items: [] }],
        widgets: [privateWidget],
        version: 9,
      }),
    );

    const version = ref(0);
    const loaded = cache.loadFromCache(version);

    expect(loaded).toBe(false);
    expect(groups.groups).toEqual([]);
    expect(widgets.widgets).toEqual([]);
    expect(version.value).toBe(0);
  });

  it("sanitizes navigation icon refs before writing and after reading cache", () => {
    const cache = useCacheStore();
    const groups = useGroupsStore();

    cache.saveToCache({
      groups: [
        {
          id: "icons",
          title: "Icons",
          items: [
            {
              id: "old",
              title: "Old",
              url: "https://old.example",
              icon: "/api/site/icon?url=https%3A%2F%2Fold.example",
            },
            {
              id: "managed",
              title: "Managed",
              url: "https://managed.example",
              icon: "/api/icons/icn_valid_1",
            },
          ],
        },
      ],
      widgets: [],
      appConfig: {},
      systemConfig: { enableDocker: false },
      isGuest: true,
      version: 3,
    });

    const raw = JSON.parse(
      localStorage.getItem("start-deck-data-cache:guest") || "{}",
    );
    expect(raw.groups[0].items[0].icon).toBe("");
    expect(raw.groups[0].items[1].icon).toBe("/api/icons/icn_valid_1");
    expect(raw.isGuest).toBe(true);
    expect(raw.guestCacheSchemaVersion).toBe(2);

    groups.groups = [];
    const version = ref(0);
    expect(cache.loadFromCache(version)).toBe(true);
    expect(groups.groups[0].items[0].icon).toBe("");
    expect(groups.groups[0].items[1].icon).toBe("/api/icons/icn_valid_1");
  });

  it("clears stale authenticated state when the server rejects the stored token", async () => {
    vi.useFakeTimers();
    const auth = useAuthStore();
    const cache = useCacheStore();
    const widgets = useWidgetsStore();
    const uiFeedback = useUiFeedbackStore();
    const version = ref(0);

    auth.sessionReady = true;
    auth.username = "admin";
    auth.sessionGeneration = "stale-session";
    auth.username = "admin";
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
    expect(localStorage.getItem("start-deck-username")).toBeNull();
    expect(uiFeedback.toasts).toHaveLength(1);
    expect(uiFeedback.toasts[0]).toMatchObject({
      title: SESSION_EXPIRED_TOAST_TITLE,
      message: SESSION_EXPIRED_TOAST_MESSAGE,
      tone: "warning",
    });
    expect(version.value).toBe(0);
  });
});
