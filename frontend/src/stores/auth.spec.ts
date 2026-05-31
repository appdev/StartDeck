// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "./auth";

describe("auth store cookie session model", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("bootstraps authenticated cookie sessions without reading bearer tokens", async () => {
    localStorage.setItem("start-deck-token", "legacy-token");
    const fetchMock = vi.fn(async () =>
      Response.json({
        success: true,
        authenticated: true,
        username: "admin",
        sessionGeneration: "sid-1",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const auth = useAuthStore();
    await auth.bootstrapSession();

    expect(auth.sessionReady).toBe(true);
    expect(auth.isLogged).toBe(true);
    expect(auth.username).toBe("admin");
    expect(auth.sessionGeneration).toBe("sid-1");
    expect(localStorage.getItem("start-deck-token")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
  });

  it("logs in through cookies and never stores a token", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        success: true,
        username: "admin",
        sessionGeneration: "sid-2",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const auth = useAuthStore();
    await expect(auth.login("admin", "secret")).resolves.toBe(true);

    expect(auth.isLogged).toBe(true);
    expect(auth.username).toBe("admin");
    expect(auth.sessionGeneration).toBe("sid-2");
    expect(localStorage.getItem("start-deck-token")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/login",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
      }),
    );
  });
});
