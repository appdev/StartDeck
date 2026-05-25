import { describe, expect, it, vi } from "vitest";
import {
  buildSearchEngineUrl,
  createDefaultSearchEngines,
  createSearchEngineKey,
  normalizeDefaultSearchEngine,
  normalizeSearchEngines,
} from "./searchEngines";

describe("searchEngines", () => {
  it("uses the supported built-in search engines by default", () => {
    expect(createDefaultSearchEngines().map((engine) => engine.label)).toEqual([
      "百度",
      "谷歌",
      "Bing",
    ]);
  });

  it("keeps custom ordering without re-adding removed built-in engines", () => {
    const engines = normalizeSearchEngines([
      {
        id: "custom",
        key: "custom",
        label: "站内",
        urlTemplate: "https://example.com/search?q={q}",
        custom: true,
      },
      {
        id: "google",
        key: "google",
        label: "谷歌",
        urlTemplate: "https://www.google.com/search?q={q}",
      },
    ]);

    expect(engines[0]?.key).toBe("custom");
    expect(engines[1]?.key).toBe("google");
    expect(engines.map((engine) => engine.key)).toEqual(["custom", "google"]);
  });

  it("drops deprecated built-in search engines from saved config", () => {
    const engines = normalizeSearchEngines([
      {
        id: "so",
        key: "so",
        label: "综合搜索",
        urlTemplate: "https://www.so.com/s?q={q}",
      },
      {
        id: "metaso",
        key: "metaso",
        label: "秘塔AI",
        urlTemplate: "https://metaso.cn/?q={q}",
      },
      {
        id: "bing",
        key: "bing",
        label: "Bing",
        urlTemplate: "https://cn.bing.com/search?q={q}",
      },
    ]);

    expect(engines.map((engine) => engine.key)).toEqual(["bing"]);
  });

  it("renames legacy built-in labels to the current product names", () => {
    const engines = normalizeSearchEngines([
      {
        id: "google",
        key: "google",
        label: "Google",
        urlTemplate: "https://www.google.com/search?q={q}",
      },
      {
        id: "bing",
        key: "bing",
        label: "必应",
        urlTemplate: "https://cn.bing.com/search?q={q}",
      },
    ]);

    expect(engines.map((engine) => engine.label)).toEqual(["谷歌", "Bing"]);
  });

  it("normalizes invalid default engine keys", () => {
    const engines = createDefaultSearchEngines();
    expect(normalizeDefaultSearchEngine("missing", engines)).toBe("baidu");
    expect(normalizeDefaultSearchEngine("bing", engines)).toBe("bing");
  });

  it("builds search URLs from placeholder and plain URL templates", () => {
    const [engine] = createDefaultSearchEngines();
    expect(buildSearchEngineUrl(engine, "天气 深圳")).toBe(
      "https://www.baidu.com/s?wd=%E5%A4%A9%E6%B0%94%20%E6%B7%B1%E5%9C%B3",
    );
    expect(
      buildSearchEngineUrl(
        {
          id: "plain",
          key: "plain",
          label: "Plain",
          urlTemplate: "https://example.com/search",
        },
        "StartDeck",
      ),
    ).toBe("https://example.com/search?q=StartDeck");
  });

  it("creates stable custom keys from labels", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.12345);
    vi.spyOn(Date, "now").mockReturnValue(1000);

    expect(createSearchEngineKey("My Search")).toBe("my-search-4fzol");

    vi.restoreAllMocks();
  });
});
