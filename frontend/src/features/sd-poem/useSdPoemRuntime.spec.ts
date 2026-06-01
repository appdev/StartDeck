// @vitest-environment jsdom
import { nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSdPoemWidget } from "./sdPoemModel";
import {
  getSdPoemDailyPaletteIndex,
  useSdPoemRuntime,
} from "./useSdPoemRuntime";
import { fetchSdPoem } from "./sdPoemApi";
import type { SdPoemWidgetData } from "./sdPoemTypes";

vi.mock("./sdPoemApi", () => ({
  fetchSdPoem: vi.fn(async () => ({
    sentence: "江流宛转绕芳甸，月照花林皆似霰。",
    poemTitle: "春江花月夜",
    author: "张若虚",
    dynasty: "唐代",
    fullText: ["江流宛转绕芳甸，月照花林皆似霰。"],
    translation: [],
    annotations: [],
    preface: [],
    sourceStatus: "ok",
  })),
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
};

describe("poem runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T10:00:00+08:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses a stable daily palette without treating manual refresh as the daily update", async () => {
    const widget = ref(createDefaultSdPoemWidget());
    const updates: SdPoemWidgetData[] = [];
    const runtime = useSdPoemRuntime(widget, (data) => {
      updates.push(data);
      widget.value.data = data;
    });

    runtime.ensureLoaded();
    await flushPromises();

    const dailyIndex = getSdPoemDailyPaletteIndex("2026-05-23");
    expect(updates.at(-1)).toMatchObject({
      paletteDate: "2026-05-23",
      paletteIndex: dailyIndex,
    });

    vi.spyOn(Math, "random").mockReturnValue(0.99);
    await runtime.refreshPoem();

    expect(updates.at(-1)).toMatchObject({
      paletteDate: "2026-05-23",
      currentPoem: {
        sentence: "江流宛转绕芳甸，月照花林皆似霰。",
      },
    });
    expect(updates.at(-1)?.paletteIndex).not.toBe(dailyIndex);
  });

  it("does not run the daily palette update when opened panel mounts", async () => {
    const widget = ref(createDefaultSdPoemWidget());
    const updates: SdPoemWidgetData[] = [];
    const runtime = useSdPoemRuntime(
      widget,
      (data) => {
        updates.push(data);
        widget.value.data = data;
      },
      { allowDailyPaletteRefresh: false },
    );

    runtime.ensureLoaded();
    await flushPromises();

    expect(fetchSdPoem).toHaveBeenCalledWith(false, expect.any(AbortSignal));
    expect(updates.at(-1)).toMatchObject({ paletteIndex: 0 });
    expect(updates.at(-1)).not.toHaveProperty("paletteDate");
  });

  it("does not synthesize a fallback poem when the backend has no entry", async () => {
    vi.mocked(fetchSdPoem).mockRejectedValueOnce(new Error("cache_miss"));
    const widget = ref(createDefaultSdPoemWidget());
    const updates: SdPoemWidgetData[] = [];
    const runtime = useSdPoemRuntime(widget, (data) => {
      updates.push(data);
      widget.value.data = data;
    });

    runtime.ensureLoaded();
    await flushPromises();

    expect(runtime.sourceStatus.value).toBe("error");
    expect(runtime.hasContent.value).toBe(false);
    expect(runtime.activePoem.value.sentence).toBe("");
    expect(updates).toEqual([]);
  });
});
