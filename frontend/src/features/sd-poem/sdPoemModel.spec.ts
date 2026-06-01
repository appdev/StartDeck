import { describe, expect, it } from "vitest";
import {
  applySdPoemSizeToWidget,
  createDefaultSdPoemWidget,
  normalizeSdPoemWidgetData,
} from "./sdPoemModel";
import { SD_POEM_RUNTIME, SD_POEM_WIDGET_TYPE } from "./sdPoemTypes";

describe("poem model", () => {
  it("creates the canonical poem widget", () => {
    expect(createDefaultSdPoemWidget()).toMatchObject({
      id: "poem",
      type: SD_POEM_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: SD_POEM_RUNTIME,
        version: 1,
        sizeKey: "2x2",
      },
    });
  });

  it("normalizes invalid widget data back to the source default size", () => {
    expect(normalizeSdPoemWidgetData({ sizeKey: "4x4" })).toMatchObject({
      runtime: SD_POEM_RUNTIME,
      version: 1,
      sizeKey: "2x2",
    });
  });

  it("keeps the current poem payload for opened-to-outer sync", () => {
    expect(
      normalizeSdPoemWidgetData({
        sizeKey: "1x1",
        currentPoem: {
          sentence: "江畔何人初见月，江月何年初照人？",
          poemTitle: "春江花月夜",
          author: "张若虚",
          dynasty: "唐代",
          fullText: [],
          translation: ["月光照人。"],
          annotations: ["江畔：江边。"],
          preface: [],
          sourceStatus: "ok",
        },
        paletteIndex: 3,
        paletteDate: "2026-05-23",
      }),
    ).toMatchObject({
      sizeKey: "1x1",
      paletteIndex: 3,
      paletteDate: "2026-05-23",
      currentPoem: {
        sentence: "江畔何人初见月，江月何年初照人？",
        poemTitle: "春江花月夜",
        author: "张若虚",
        dynasty: "唐代",
        fullText: ["江畔何人初见月，江月何年初照人？"],
        sourceStatus: "ok",
      },
    });
  });

  it("normalizes invalid palette sync data to stable defaults", () => {
    expect(
      normalizeSdPoemWidgetData({
        paletteIndex: -1,
        paletteDate: "today",
      }),
    ).toMatchObject({
      paletteIndex: 0,
    });
    expect(
      normalizeSdPoemWidgetData({
        paletteIndex: -1,
        paletteDate: "today",
      }),
    ).not.toHaveProperty("paletteDate");
  });

  it("applies scoped size keys without StartDeck dimension inversion", () => {
    const widget = createDefaultSdPoemWidget();

    applySdPoemSizeToWidget(widget, "1x2");

    expect(widget).toMatchObject({
      id: "poem",
      type: SD_POEM_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 1,
      w: 2,
      h: 1,
      data: expect.objectContaining({ sizeKey: "1x2" }),
    });
  });
});
