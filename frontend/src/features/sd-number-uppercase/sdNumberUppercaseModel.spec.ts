import { describe, expect, it } from "vitest";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  applySdNumberUppercaseSizeToWidget,
  createDefaultSdNumberUppercaseWidget,
  formatSdNumberUppercaseAmount,
  normalizeSdNumberInput,
  normalizeSdNumberUppercaseWidgetData,
} from "./sdNumberUppercaseModel";
import {
  SD_NUMBER_UPPERCASE_CATALOG_ID,
  SD_NUMBER_UPPERCASE_RUNTIME,
  SD_NUMBER_UPPERCASE_WIDGET_TYPE,
} from "./sdNumberUppercaseTypes";

describe("number uppercase model", () => {
  it("creates the canonical main-project number uppercase widget", () => {
    const widget = createDefaultSdNumberUppercaseWidget();
    expect(widget).toMatchObject({
      id: SD_NUMBER_UPPERCASE_CATALOG_ID,
      type: SD_NUMBER_UPPERCASE_WIDGET_TYPE,
      enable: true,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: SD_NUMBER_UPPERCASE_RUNTIME,
        layoutSystem: SD_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
        inputNumber: "",
        uppercaseResult: "",
        formatMode: "currency",
      },
    });
    expect(widget).not.toHaveProperty("isPublic");
  });

  it("normalizes input and computes the source currency uppercase result", () => {
    expect(normalizeSdNumberInput("１２,345.67元")).toBe("12345.67");
    expect(formatSdNumberUppercaseAmount("1024")).toBe("壹仟零贰拾肆元整");
    expect(formatSdNumberUppercaseAmount("10001.05")).toBe("壹万零壹元伍分");
    expect(formatSdNumberUppercaseAmount("0")).toBe("零元整");
    expect(formatSdNumberUppercaseAmount("0.05")).toBe("零元伍分");
    expect(formatSdNumberUppercaseAmount("100000000.01")).toBe("壹亿元壹分");
  });

  it("normalizes persisted state without trusting stale results", () => {
    expect(
      normalizeSdNumberUppercaseWidgetData({
        sizeKey: "bad",
        inputNumber: "2048",
        uppercaseResult: "stale",
        formatMode: "plain",
      }),
    ).toEqual({
      runtime: SD_NUMBER_UPPERCASE_RUNTIME,
      layoutSystem: SD_GRID_SCHEMA_VERSION,
      version: 1,
      sizeKey: "2x2",
      inputNumber: "2048",
      uppercaseResult: "贰仟零肆拾捌元整",
      formatMode: "currency",
    });
  });

  it("applies scoped size keys to grid spans", () => {
    const widget = createDefaultSdNumberUppercaseWidget();

    applySdNumberUppercaseSizeToWidget(widget, "2x4");

    expect(widget).toMatchObject({
      type: SD_NUMBER_UPPERCASE_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({
        runtime: SD_NUMBER_UPPERCASE_RUNTIME,
        sizeKey: "2x4",
      }),
    });
  });
});
