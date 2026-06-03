import { beforeEach, describe, expect, it } from "vitest";
import {
  clearBrowserTapdCredential,
  loadBrowserTapdCredential,
  saveBrowserTapdCredential,
  tapdBrowserCredentialKey,
} from "./tapdCredentialStorage";

describe("tapdCredentialStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores TAPD connector credentials under the current browser scope", () => {
    saveBrowserTapdCredential("ying", "tapd-1", {
      credentialType: "basic",
      apiUser: "tapd-user",
      apiPassword: "tapd-password",
      savedAt: "2026-06-02T15:00:00.000Z",
    });

    expect(
      localStorage.getItem(tapdBrowserCredentialKey("ying", "tapd-1")),
    ).toContain("tapd-user");
    expect(loadBrowserTapdCredential("ying", "tapd-1")).toMatchObject({
      credentialType: "basic",
      apiUser: "tapd-user",
      apiPassword: "tapd-password",
    });
  });

  it("clears invalid or removed credentials", () => {
    localStorage.setItem(
      tapdBrowserCredentialKey("ying", "tapd-1"),
      JSON.stringify({ credentialType: "basic", apiUser: "tapd-user" }),
    );

    expect(loadBrowserTapdCredential("ying", "tapd-1")).toBeNull();

    saveBrowserTapdCredential("ying", "tapd-1", {
      credentialType: "bearer",
      accessToken: "token",
      savedAt: "2026-06-02T15:00:00.000Z",
    });
    clearBrowserTapdCredential("ying", "tapd-1");

    expect(loadBrowserTapdCredential("ying", "tapd-1")).toBeNull();
  });
});
