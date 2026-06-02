// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "./auth";
import { useUiFeedbackStore } from "./uiFeedback";
import {
  SESSION_EXPIRED_TOAST_MESSAGE,
  SESSION_EXPIRED_TOAST_TITLE,
} from "@/utils/sessionExpiredFeedback";

describe("auth store cookie session model", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
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

  it("shows a login-expired toast when session bootstrap rejects an invalid cookie", async () => {
    vi.useFakeTimers();
    localStorage.setItem("start-deck-username", "admin");
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/logout")) {
          return Response.json({ success: true, authenticated: false });
        }
        return new Response(
          JSON.stringify({ success: false, error: "invalid_token" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const auth = useAuthStore();
    const uiFeedback = useUiFeedbackStore();
    await auth.bootstrapSession();

    expect(auth.sessionReady).toBe(true);
    expect(auth.isLogged).toBe(false);
    expect(uiFeedback.toasts).toHaveLength(1);
    expect(uiFeedback.toasts[0]).toMatchObject({
      title: SESSION_EXPIRED_TOAST_TITLE,
      message: SESSION_EXPIRED_TOAST_MESSAGE,
      tone: "warning",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
  });

  it("clears invalid cookies without showing an expired-login toast for anonymous sessions", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/logout")) {
          return Response.json({ success: true, authenticated: false });
        }
        return new Response(
          JSON.stringify({ success: false, error: "invalid_token" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const auth = useAuthStore();
    const uiFeedback = useUiFeedbackStore();
    await auth.bootstrapSession();

    expect(auth.sessionReady).toBe(true);
    expect(auth.isLogged).toBe(false);
    expect(uiFeedback.toasts).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
  });
});
