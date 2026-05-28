// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  aiUsageBrowserCredentialKey,
  clearBrowserAiUsageCredential,
  loadBrowserAiUsageCredential,
  saveBrowserAiUsageCredential,
} from "./aiUsageCredentialStorage";

describe("aiUsageCredentialStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("scopes browser credentials by user widget and provider", () => {
    saveBrowserAiUsageCredential("alice", "widget-1", "openai", {
      credentialType: "access_token",
      credential: "token",
      accountId: "account",
      savedAt: "2026-05-28T00:00:00.000Z",
    });

    expect(
      aiUsageBrowserCredentialKey("alice", "widget-1", "openai"),
    ).toContain("startdeck:ai-usage:credential");
    expect(
      loadBrowserAiUsageCredential("alice", "widget-1", "openai"),
    ).toMatchObject({
      credentialType: "access_token",
      credential: "token",
      accountId: "account",
    });
    expect(
      loadBrowserAiUsageCredential("bob", "widget-1", "openai"),
    ).toBeNull();

    clearBrowserAiUsageCredential("alice", "widget-1", "openai");
    expect(
      loadBrowserAiUsageCredential("alice", "widget-1", "openai"),
    ).toBeNull();
  });
});
