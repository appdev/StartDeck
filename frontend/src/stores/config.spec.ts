// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useConfigStore } from "./config";
import { useUiFeedbackStore } from "./uiFeedback";

const readServerCargoVersion = () => {
  const source = readFileSync(
    "../rust/crates/startdeck-server/Cargo.toml",
    "utf8",
  );
  const packageBlock = source.match(/\[package\]([\s\S]*?)(?=\n\[|$)/)?.[1];
  const version = packageBlock?.match(/^\s*version\s*=\s*"([^"]+)"\s*$/m)?.[1];
  if (!version) throw new Error("missing startdeck-server package version");
  return version;
};

describe("config store release checks", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses the startdeck-server Cargo version as the frontend app version", () => {
    expect(useConfigStore().currentVersion).toBe(readServerCargoVersion());
  });

  it("does not cache-bust immutable app assets or managed icons", () => {
    const store = useConfigStore();
    store.resourceVersion = 123456;

    expect(store.getAssetUrl("/assets/seed-icons/nav/github.svg")).toBe(
      "/assets/seed-icons/nav/github.svg",
    );
    expect(store.getAssetUrl("/assets/ai-usage/providers/openai.svg")).toBe(
      "/assets/ai-usage/providers/openai.svg",
    );
    expect(store.getAssetUrl("/itab-live-assets/anniversary/yiyan-2.webp")).toBe(
      "/itab-live-assets/anniversary/yiyan-2.webp",
    );
    expect(store.getAssetUrl("/itab/weather/icon/104-fill.svg")).toBe(
      "/itab/weather/icon/104-fill.svg",
    );
    expect(store.getAssetUrl("/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8")).toBe(
      "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
    );
    expect(store.getAssetUrl("/api/icons/icn_user")).toBe("/api/icons/icn_user");
    expect(store.getAssetUrl("/default-wallpaper.svg")).toBe(
      "/default-wallpaper.svg",
    );
  });

  it("cache-busts mutable uploaded background resources only", () => {
    const store = useConfigStore();
    store.resourceVersion = 123456;

    expect(store.getAssetUrl("/backgrounds/desk.jpg")).toBe(
      "/backgrounds/desk.jpg?t=123456",
    );
    expect(store.getAssetUrl("/mobile_backgrounds/phone.jpg?size=large")).toBe(
      "/mobile_backgrounds/phone.jpg?size=large&t=123456",
    );
    expect(store.getAssetUrl("https://cdn.example.com/image.jpg")).toBe(
      "https://cdn.example.com/image.jpg",
    );
  });

  it("loads app update status from the backend and notifies once", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            latestVersion: "1.2.4",
            hasUpdate: true,
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const store = useConfigStore();
    const uiFeedback = useUiFeedbackStore();
    await store.checkUpdate({ force: true, notify: true });
    await store.checkUpdate({ force: true, notify: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/app-version/check");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/app-version/check");
    expect(uiFeedback.toasts).toHaveLength(1);
    expect(uiFeedback.toasts[0]?.title).toBe("发现新版本");
    expect(uiFeedback.toasts[0]?.message).toContain("1.2.4");
  });
});
