import { describe, expect, it } from "vitest";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  applySdMemoSizeToWidget,
  createDefaultSdMemoWidget,
  normalizeSdMemoWidgetData,
  syncSdMemoSizeFromWidgetSpans,
} from "./sdMemoModel";
import { SD_MEMO_WIDGET_TYPE } from "./sdMemoTypes";

describe("memo model", () => {
  it("creates the canonical Memo runtime widget", () => {
    expect(createDefaultSdMemoWidget()).toMatchObject({
      id: "memo",
      type: SD_MEMO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-memo",
        layoutSystem: SD_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
      },
    });
    expect(createDefaultSdMemoWidget().data.notes).toEqual([]);
  });

  it("normalizes canonical notes and legacy memo content", () => {
    expect(
      normalizeSdMemoWidgetData({
        sizeKey: "2x4",
        activeNoteId: "b",
        notes: [
          {
            id: "a",
            title: "评审",
            body: "补充 QA",
            pinned: true,
            createdAt: "2026-05-22T00:00:00.000Z",
            updatedAt: "2026-05-22T00:01:00.000Z",
          },
          {
            id: "b",
            body: "旧正文标题",
            updatedAt: 1779450000000,
          },
          { id: "empty", title: "   ", body: "" },
        ],
      }),
    ).toMatchObject({
      sizeKey: "2x4",
      activeNoteId: "b",
      notes: [
        { id: "a", title: "评审", body: "补充 QA", pinned: true },
        { id: "b", title: "旧正文标题", body: "旧正文标题", pinned: false },
        { id: "empty", title: "未命名备忘录", body: "", pinned: false },
      ],
    });

    const emptyData = normalizeSdMemoWidgetData({ notes: [] });
    expect(emptyData.notes).toEqual([]);
    expect(emptyData).not.toHaveProperty("activeNoteId");

    const defaultData = normalizeSdMemoWidgetData({});
    expect(defaultData.sizeKey).toBe("2x2");
    expect(defaultData.notes).toEqual([]);
  });

  it("applies scoped size keys to widget spans without inversion", () => {
    const widget = createDefaultSdMemoWidget();

    applySdMemoSizeToWidget(widget, "1x2");
    expect(widget).toMatchObject({
      type: SD_MEMO_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 1,
      w: 2,
      h: 1,
      data: expect.objectContaining({ sizeKey: "1x2" }),
    });
  });

  it("preserves and applies the runtime 4x4 size", () => {
    expect(
      normalizeSdMemoWidgetData({
        sizeKey: "4x4",
        notes: [],
      }),
    ).toMatchObject({
      sizeKey: "4x4",
      notes: [],
    });

    const widget = createDefaultSdMemoWidget();

    applySdMemoSizeToWidget(widget, "4x4");
    expect(widget).toMatchObject({
      type: SD_MEMO_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 4,
      w: 4,
      h: 4,
      data: expect.objectContaining({ sizeKey: "4x4" }),
    });

    widget.data = {
      ...(widget.data as Record<string, unknown>),
      sizeKey: "2x2",
    };
    syncSdMemoSizeFromWidgetSpans(widget);
    expect(widget.data).toEqual(expect.objectContaining({ sizeKey: "4x4" }));
  });
});
