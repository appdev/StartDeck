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
  const managedIcon = {
    id: "mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
    assetId: "mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
    url: "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
    source: "metadata",
    label: "Example",
    backgroundColor: "#111827",
    contentType: "image/svg+xml",
    width: 64,
    height: 64,
    reused: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    resetSmartIconMatchCacheForTests();
    vi.stubGlobal("Image", FakeImage);
  });

  it("normalizes external and local URLs", () => {
    expect(normalizeUserUrl("example.com/app")).toBe("https://example.com/app");
    expect(normalizeUserUrl("192.168.1.15/admin")).toBe(
      "http://192.168.1.15/admin",
    );
  });

  it("extracts keyword from URL without scheme", () => {
    expect(extractKeywordFromUrl("news.163.com")).toBe("163");
    expect(extractKeywordFromUrl("https://www.github.com")).toBe("github");
  });

  it("rejects non-image and tiny data URIs", async () => {
    await expect(
      validateDataUriIcon("data:text/html;base64,VALID"),
    ).resolves.toBe(false);
    await expect(
      validateDataUriIcon("data:image/png;base64,TINY"),
    ).resolves.toBe(false);
    await expect(
      validateDataUriIcon("data:image/png;base64,VALID"),
    ).resolves.toBe(true);
  });

  it("uses site metadata for candidates without replacing existing title or icon", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        expect(url).toContain("/api/site/resolve?url=");
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              inputUrl: "https://example.com",
              normalizedUrl: "https://example.com",
              url: "https://example.com",
              title: "Example",
              selectedIcon: managedIcon,
              iconCandidates: [managedIcon],
              description: "Demo",
              backgroundColor: "#111827",
            },
          }),
        };
      }),
    );

    const notify = vi.fn();
    const onSelect = vi.fn();
    const form = ref({
      title: "Old title",
      url: "example.com",
      lanUrl: "",
      icon: "icons/current.svg",
    });

    const smartIconMatch = useSmartIconMatch({
      form,
      onSelect,
      notify,
    });

    await smartIconMatch.smartMatchIcons();

    expect(form.value.title).toBe("Old title");
    expect(form.value.icon).toBe("icons/current.svg");
    expect("description1" in form.value).toBe(false);
    expect(smartIconMatch.lastSiteMetadata.value?.description).toBe("Demo");
    expect(smartIconMatch.isSmartMatching.value).toBe(false);
    expect(smartIconMatch.smartMatchCandidates.value).toEqual([
      {
        id: "mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
        assetId: "mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
        url: "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
        source: "site",
        label: "Example",
        backgroundColor: "#111827",
      },
    ]);
    expect(smartIconMatch.selectedSmartMatchCandidateUrl.value).toBe("");
    expect(smartIconMatch.showSmartMatchModal.value).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("does not synthesize legacy icon URLs when metadata has no candidates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            inputUrl: "https://example.com",
            normalizedUrl: "https://example.com",
            url: "https://example.com",
            title: "Example",
            selectedIcon: null,
            iconCandidates: [],
            backgroundColor: "#ffffff",
          },
        }),
      })),
    );

    const form = ref({ title: "", url: "example.com" });
    const smartIconMatch = useSmartIconMatch({
      form,
      onSelect: vi.fn(),
      notify: vi.fn(),
    });

    await smartIconMatch.smartMatchIcons();

    expect(form.value.title).toBe("Example");
    expect(smartIconMatch.selectedSmartMatchCandidateUrl.value).toBe("");
    expect(smartIconMatch.smartMatchCandidates.value).toEqual([]);
    expect(smartIconMatch.showSmartMatchModal.value).toBe(false);
  });

  it("applies the first candidate when automatic selection is requested", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            inputUrl: "https://example.com",
            normalizedUrl: "https://example.com",
            url: "https://example.com",
            title: "Example",
            selectedIcon: managedIcon,
            iconCandidates: [managedIcon],
            backgroundColor: "#111827",
          },
        }),
      })),
    );

    const onSelect = vi.fn();
    const form = ref({
      title: "Old title",
      url: "example.com",
      icon: "icons/current.svg",
    });
    const smartIconMatch = useSmartIconMatch({
      form,
      onSelect,
      notify: vi.fn(),
    });

    await smartIconMatch.smartMatchIcons({ applyFirstCandidate: true });

    expect(form.value.title).toBe("Old title");
    expect(smartIconMatch.selectedSmartMatchCandidateUrl.value).toBe(
      "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
    );
    expect(onSelect).toHaveBeenCalledWith({
      icon: "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
      source: "site",
      label: "Example",
      backgroundColor: "#111827",
    });
  });

  it("returns the selected icon result with metadata background color", async () => {
    const onSelect = vi.fn();
    const smartIconMatch = useSmartIconMatch({
      form: ref({ url: "example.com" }),
      onSelect,
      notify: vi.fn(),
    });

    smartIconMatch.selectSmartMatchCandidate({
      id: "mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
      assetId: "mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
      url: "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
      source: "site",
      label: "Example",
      backgroundColor: "#111827",
    });
    expect(smartIconMatch.selectedSmartMatchCandidateUrl.value).toBe(
      "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
    );
    expect(smartIconMatch.showSmartMatchModal.value).toBe(true);

    expect(onSelect).toHaveBeenCalledWith({
      icon: "/api/icons/mta_aHR0cHM6Ly9leGFtcGxlLmNvbS8",
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
