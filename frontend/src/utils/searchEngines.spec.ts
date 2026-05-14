import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchEngine } from "@/types";
import {
  buildSearchEngineUrl,
  getSearchEngineIcon,
  getSearchEngineSourceUrl,
  hydrateSearchEngineIcon,
  resetSearchEngineMetadataCacheForTests,
} from "./searchEngines";

describe("searchEngines", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetSearchEngineMetadataCacheForTests();
  });

  it("derives the icon source from the search URL template", () => {
    const engine: SearchEngine = {
      id: "custom",
      key: "custom",
      label: "Custom",
      urlTemplate: "example.com/search?q={q}",
    };

    expect(getSearchEngineSourceUrl(engine)).toBe("https://example.com");
    expect(getSearchEngineIcon(engine)).toBe("/api/site/icon?url=https%3A%2F%2Fexample.com&size=64");
  });

  it("builds a search URL from a configured template", () => {
    const engine: SearchEngine = {
      id: "custom",
      key: "custom",
      label: "Custom",
      urlTemplate: "https://example.com/search?q={q}",
    };

    expect(buildSearchEngineUrl(engine, "hello world")).toBe(
      "https://example.com/search?q=hello%20world",
    );
  });

  it("persists metadata icon fields onto the search engine", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        expect(String(input)).toContain("/api/site/metadata?url=");
        return {
          ok: true,
          json: async () => ({
            code: 200,
            data: {
              url: "https://example.com",
              title: "Example",
              icon: "/api/site/icon?url=https%3A%2F%2Fexample.com",
              backgroundColor: "#ABC",
              fetchedAt: "2026-05-14T00:00:00Z",
            },
          }),
        };
      }),
    );

    const engine: SearchEngine = {
      id: "custom",
      key: "custom",
      label: "Custom",
      urlTemplate: "https://example.com/search?q={q}",
    };

    await expect(hydrateSearchEngineIcon(engine)).resolves.toBe(true);
    expect(engine.icon).toBe("/api/site/icon?url=https%3A%2F%2Fexample.com");
    expect(engine.iconSourceUrl).toBe("https://example.com");
    expect(engine.iconFetchedAt).toBe("2026-05-14T00:00:00Z");
    expect(engine.iconBackgroundMode).toBe("auto");
    expect(engine.iconAutoBackgroundColor).toBe("#aabbcc");
  });
});
