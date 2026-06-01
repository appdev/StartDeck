// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isCanonicalIconUrl,
  materializeIconInput,
  sanitizeNavigationIcon,
  sanitizeSnapshotIcons,
} from "./iconAssets";

describe("iconAssets", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts only navigation icon data and rewrites legacy user icons", () => {
    expect(sanitizeNavigationIcon("")).toBe("");
    expect(sanitizeNavigationIcon("/assets/seed-icons/nav/github.svg")).toBe(
      "/assets/seed-icons/nav/github.svg",
    );
    expect(sanitizeNavigationIcon("/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8")).toBe(
      "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
    );
    expect(sanitizeNavigationIcon("/api/icons/icn_user")).toBe(
      "/api/icons/icn_user",
    );
    expect(sanitizeNavigationIcon("/api/assets/icons/icn_legacy")).toBe(
      "/api/icons/icn_legacy",
    );
    expect(sanitizeNavigationIcon("/assets/ai-usage/providers/openai.svg")).toBe(
      "",
    );
    expect(sanitizeNavigationIcon("/itab-live-assets/icon.svg")).toBe("");
    expect(sanitizeNavigationIcon("/api/site/icon?url=https%3A%2F%2Fexample.com")).toBe(
      "",
    );
    expect(sanitizeNavigationIcon("/icon-cache/example.svg")).toBe("");
  });

  it("sanitizes snapshots before cache and save paths persist them", () => {
    const snapshot = sanitizeSnapshotIcons({
      groups: [
        {
          id: "g",
          title: "G",
          items: [
            { id: "seed", icon: "/assets/seed-icons/nav/github.svg" },
            { id: "meta", icon: "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8" },
            { id: "user", icon: "/api/assets/icons/icn_legacy" },
            { id: "app", icon: "/assets/ai-usage/providers/openai.svg" },
          ],
        },
      ],
    });
    expect(snapshot.groups[0].items.map((item) => item.icon)).toEqual([
      "/assets/seed-icons/nav/github.svg",
      "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
      "/api/icons/icn_legacy",
      "",
    ]);
  });

  it("posts user provided icon bytes to the unified icon API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("/api/icons");
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            success: true,
            data: { url: "/api/icons/icn_created", id: "icn_created" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    await expect(
      materializeIconInput("data:image/svg+xml;base64,PHN2Zy8+"),
    ).resolves.toBe("/api/icons/icn_created");
  });

  it("does not post already canonical seed, meta, or user icon URLs", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    for (const icon of [
      "/assets/seed-icons/nav/github.svg",
      "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
      "/api/icons/icn_user",
    ]) {
      expect(isCanonicalIconUrl(icon)).toBe(true);
      await expect(materializeIconInput(icon)).resolves.toBe(icon);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
