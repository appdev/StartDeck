// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSiteMetadata } from "./siteMetadata";

describe("siteMetadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("preserves backend fetch status fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        clone() {
          return this;
        },
        json: async () => ({
          success: true,
          data: {
            inputUrl: "https://example.com/protected",
            normalizedUrl: "https://example.com/protected",
            url: "https://example.com/protected",
            title: "Example",
            selectedIcon: null,
            iconCandidates: [],
            description: "",
            backgroundColor: "",
            fetchStatus: "blocked",
            failureKind: "site_blocked",
            retryAfter: "2026-06-01T10:00:00Z",
          },
        }),
      })),
    );

    const metadata = await fetchSiteMetadata("example.com/protected");

    expect(metadata?.fetchStatus).toBe("blocked");
    expect(metadata?.failureKind).toBe("site_blocked");
    expect(metadata?.retryAfter).toBe("2026-06-01T10:00:00Z");
  });
});
