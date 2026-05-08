// @vitest-environment jsdom
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractKeywordFromUrl,
  normalizeUserUrl,
  resetSmartIconMatchCacheForTests,
  useSmartIconMatch,
  validateDataUriIcon,
} from "./useSmartIconMatch";

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  width = 0;
  height = 0;

  set src(value: string) {
    queueMicrotask(() => {
      if (value.includes("missing") || value.includes("INVALID")) {
        this.onerror?.();
        return;
      }

      if (value.includes("TINY")) {
        this.naturalWidth = 1;
        this.naturalHeight = 1;
        this.width = 1;
        this.height = 1;
      } else {
        this.naturalWidth = 16;
        this.naturalHeight = 16;
        this.width = 16;
        this.height = 16;
      }
      this.onload?.();
    });
  }
}

describe("useSmartIconMatch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetSmartIconMatchCacheForTests();
    vi.stubGlobal("Image", FakeImage);
  });

  it("normalizes external and local URLs", () => {
    expect(normalizeUserUrl("example.com/app")).toBe("https://example.com/app");
    expect(normalizeUserUrl("192.168.1.15/admin")).toBe("http://192.168.1.15/admin");
  });

  it("extracts keyword from URL without scheme", () => {
    expect(extractKeywordFromUrl("news.163.com")).toBe("163");
    expect(extractKeywordFromUrl("https://www.github.com")).toBe("github");
  });

  it("rejects non-image and tiny data URIs", async () => {
    await expect(validateDataUriIcon("data:text/html;base64,VALID")).resolves.toBe(false);
    await expect(validateDataUriIcon("data:image/png;base64,TINY")).resolves.toBe(false);
    await expect(validateDataUriIcon("data:image/png;base64,VALID")).resolves.toBe(true);
  });

  it("uses StartPage-style site metadata as the smart icon source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        expect(url).toContain("/api/site/metadata?url=");
        return {
          ok: true,
          json: async () => ({
            code: 200,
            msg: "ok",
            data: {
              url: "https://example.com",
              title: "Example",
              icon: "/api/site/icon?url=https%3A%2F%2Fexample.com",
              description: "Demo",
              backgroundColor: "#111827",
              fetchedAt: "2026-05-08T00:00:00Z",
            },
          }),
        };
      }),
    );

    const notify = vi.fn();
    const onSelect = vi.fn();
    const form = ref({
      title: "Example",
      url: "example.com",
      lanUrl: "",
      icon: "",
    });

    const smartIconMatch = useSmartIconMatch({
      form,
      onSelect,
      notify,
    });

    await smartIconMatch.smartMatchIcons();

    expect(smartIconMatch.isSmartMatching.value).toBe(false);
    expect(smartIconMatch.smartMatchCandidates.value).toEqual([
      {
        url: "/api/site/icon?url=https%3A%2F%2Fexample.com",
        source: "site",
        label: "Example",
        backgroundColor: "#111827",
      },
    ]);
    expect(smartIconMatch.showSmartMatchModal.value).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("falls back to the public site icon endpoint when metadata has no icon", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          code: 200,
          msg: "ok",
          data: {
            url: "https://example.com",
            title: "Example",
            icon: null,
            backgroundColor: "#ffffff",
          },
        }),
      })),
    );

    const smartIconMatch = useSmartIconMatch({
      form: ref({ url: "example.com" }),
      onSelect: vi.fn(),
      notify: vi.fn(),
    });

    await smartIconMatch.smartMatchIcons();

    expect(smartIconMatch.smartMatchCandidates.value).toEqual([
      {
        url: "/api/site/icon?url=https%3A%2F%2Fexample.com&size=64",
        source: "site",
        label: "Example",
        backgroundColor: "#ffffff",
      },
    ]);
  });

  it("returns the selected icon result with metadata background color", async () => {
    const onSelect = vi.fn();
    const smartIconMatch = useSmartIconMatch({
      form: ref({ url: "example.com" }),
      onSelect,
      notify: vi.fn(),
    });

    smartIconMatch.selectSmartMatchCandidate({
      url: "/api/site/icon?url=https%3A%2F%2Fexample.com",
      source: "site",
      label: "Example",
      backgroundColor: "#111827",
    });

    expect(onSelect).toHaveBeenCalledWith({
      icon: "/api/site/icon?url=https%3A%2F%2Fexample.com",
      source: "site",
      label: "Example",
      backgroundColor: "#111827",
    });
  });

  it("asks for a URL before querying metadata", async () => {
    const notify = vi.fn();
    const smartIconMatch = useSmartIconMatch({
      form: ref({ title: "Only title" }),
      onSelect: vi.fn(),
      notify,
    });

    await smartIconMatch.smartMatchIcons();

    expect(notify).toHaveBeenCalledWith("请先填写链接！");
    expect(smartIconMatch.showSmartMatchModal.value).toBe(false);
  });
});
