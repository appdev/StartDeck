import { describe, expect, it } from "vitest";
import {
  STARTDECK_SITE_SHORTCUT_CATALOG,
  filterAndSortSiteShortcuts,
  isDuplicateSiteShortcut,
} from "./siteShortcutCatalog";

describe("siteShortcutCatalog", () => {
  it("sorts deterministic StartDeck-owned shortcuts by the three rank modes", () => {
    expect(STARTDECK_SITE_SHORTCUT_CATALOG.length).toBeGreaterThan(10);

    expect(
      filterAndSortSiteShortcuts(STARTDECK_SITE_SHORTCUT_CATALOG, {
        sortMode: "featured",
      }).map((item) => item.featuredRank),
    ).toEqual(
      [...STARTDECK_SITE_SHORTCUT_CATALOG]
        .map((item) => item.featuredRank)
        .sort((a, b) => a - b),
    );

    const updated = filterAndSortSiteShortcuts(
      STARTDECK_SITE_SHORTCUT_CATALOG,
      {
        sortMode: "updated",
      },
    );
    expect(new Date(updated[0]!.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(updated[1]!.updatedAt).getTime(),
    );

    const popular = filterAndSortSiteShortcuts(
      STARTDECK_SITE_SHORTCUT_CATALOG,
      {
        sortMode: "popular",
      },
    );
    expect(popular[0]!.popularity).toBeGreaterThanOrEqual(
      popular[1]!.popularity,
    );
  });

  it("filters by category and query without using captured source data", () => {
    const ai = filterAndSortSiteShortcuts(STARTDECK_SITE_SHORTCUT_CATALOG, {
      category: "ai",
    });
    expect(ai.length).toBeGreaterThan(0);
    expect(ai.every((item) => item.category === "ai")).toBe(true);

    const github = filterAndSortSiteShortcuts(STARTDECK_SITE_SHORTCUT_CATALOG, {
      query: "github",
    });
    expect(github.map((item) => item.id)).toEqual(["github"]);
  });

  it("detects duplicate shortcuts after URL normalization", () => {
    expect(isDuplicateSiteShortcut(["https://github.com"], "github.com")).toBe(
      true,
    );
    expect(
      isDuplicateSiteShortcut(["https://github.com"], "https://openai.com"),
    ).toBe(false);
  });
});
