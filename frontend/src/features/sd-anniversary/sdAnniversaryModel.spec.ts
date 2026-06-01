import { describe, expect, it } from "vitest";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  applySdAnniversarySizeToWidget,
  createDefaultSdAnniversaryWidget,
  SD_ANNIVERSARY_IMAGE_COUNT,
  normalizeSdAnniversaryWidgetData,
} from "./sdAnniversaryModel";
import { SD_ANNIVERSARY_WIDGET_TYPE } from "./sdAnniversaryTypes";

describe("anniversary model", () => {
  it("keeps the source background image count", () => {
    expect(SD_ANNIVERSARY_IMAGE_COUNT).toBe(25);
  });

  it("creates the canonical anniversary widget without fallback event data", () => {
    expect(createDefaultSdAnniversaryWidget()).toMatchObject({
      id: "anniversary",
      type: SD_ANNIVERSARY_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-anniversary",
        layoutSystem: SD_GRID_SCHEMA_VERSION,
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
      normalizeSdAnniversaryWidgetData({
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
        runtime: "sd-anniversary",
        layoutSystem: SD_GRID_SCHEMA_VERSION,
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

  it("applies scoped size keys without StartDeck size inversion", () => {
    const widget = createDefaultSdAnniversaryWidget();

    applySdAnniversarySizeToWidget(widget, "2x4");

    expect(widget).toMatchObject({
      id: "anniversary",
      type: SD_ANNIVERSARY_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({ sizeKey: "2x4" }),
    });
  });
});
