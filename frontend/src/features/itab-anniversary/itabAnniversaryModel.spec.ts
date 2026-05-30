import { describe, expect, it } from "vitest";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  applyItabAnniversarySizeToWidget,
  createDefaultItabAnniversaryWidget,
  ITAB_ANNIVERSARY_IMAGE_COUNT,
  normalizeItabAnniversaryWidgetData,
} from "./itabAnniversaryModel";
import { ITAB_ANNIVERSARY_WIDGET_TYPE } from "./itabAnniversaryTypes";

describe("itabAnniversaryModel", () => {
  it("keeps the source background image count", () => {
    expect(ITAB_ANNIVERSARY_IMAGE_COUNT).toBe(25);
  });

  it("creates the canonical iTab anniversary widget without fallback event data", () => {
    expect(createDefaultItabAnniversaryWidget()).toMatchObject({
      id: "anniversary",
      type: ITAB_ANNIVERSARY_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-anniversary",
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
        title: "",
        label: "",
        eventName: "",
        date: "",
        mode: "elapsed",
        repeat: "不重复",
        textColor: "#ffffff",
        backgroundMode: "image",
        mask: 0,
      },
    });
  });

  it("normalizes invalid anniversary data without leaking temporary state", () => {
    expect(
      normalizeItabAnniversaryWidgetData({
        sizeKey: "bad",
        title: "",
        eventName: "发工资还有",
        mode: "future",
        repeat: "每天",
        backgroundMode: "gif",
        mask: 999,
      }),
    ).toEqual(
      expect.objectContaining({
        runtime: "itab-anniversary",
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
        title: "",
        label: "发工资还有",
        eventName: "发工资还有",
        mode: "elapsed",
        repeat: "不重复",
        backgroundMode: "image",
        mask: 100,
      }),
    );
  });

  it("applies iTab size keys without StartDeck size inversion", () => {
    const widget = createDefaultItabAnniversaryWidget();

    applyItabAnniversarySizeToWidget(widget, "2x4");

    expect(widget).toMatchObject({
      id: "anniversary",
      type: ITAB_ANNIVERSARY_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({ sizeKey: "2x4" }),
    });
  });
});
