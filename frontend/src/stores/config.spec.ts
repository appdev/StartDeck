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
