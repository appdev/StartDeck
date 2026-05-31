import { describe, expect, it } from "vitest";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  applyItabNumberUppercaseSizeToWidget,
  createDefaultItabNumberUppercaseWidget,
  formatItabNumberUppercaseAmount,
  normalizeItabNumberInput,
  normalizeItabNumberUppercaseWidgetData,
} from "./itabNumberUppercaseModel";
import {
  ITAB_NUMBER_UPPERCASE_CATALOG_ID,
  ITAB_NUMBER_UPPERCASE_RUNTIME,
  ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
} from "./itabNumberUppercaseTypes";

describe("itabNumberUppercaseModel", () => {
  it("creates the canonical main-project number uppercase widget", () => {
    const widget = createDefaultItabNumberUppercaseWidget();
    expect(widget).toMatchObject({
      id: ITAB_NUMBER_UPPERCASE_CATALOG_ID,
      type: ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
      enable: true,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: ITAB_NUMBER_UPPERCASE_RUNTIME,
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
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
    expect(normalizeItabNumberInput("１２,345.67元")).toBe("12345.67");
    expect(formatItabNumberUppercaseAmount("1024")).toBe("壹仟零贰拾肆元整");
    expect(formatItabNumberUppercaseAmount("10001.05")).toBe("壹万零壹元伍分");
    expect(formatItabNumberUppercaseAmount("0")).toBe("零元整");
    expect(formatItabNumberUppercaseAmount("0.05")).toBe("零元伍分");
    expect(formatItabNumberUppercaseAmount("100000000.01")).toBe("壹亿元壹分");
  });

  it("normalizes persisted state without trusting stale results", () => {
    expect(
      normalizeItabNumberUppercaseWidgetData({
        sizeKey: "bad",
        inputNumber: "2048",
        uppercaseResult: "stale",
        formatMode: "plain",
      }),
    ).toEqual({
      runtime: ITAB_NUMBER_UPPERCASE_RUNTIME,
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: 1,
      sizeKey: "2x2",
      inputNumber: "2048",
      uppercaseResult: "贰仟零肆拾捌元整",
      formatMode: "currency",
    });
  });

  it("applies iTab size keys to grid spans", () => {
    const widget = createDefaultItabNumberUppercaseWidget();

    applyItabNumberUppercaseSizeToWidget(widget, "2x4");

    expect(widget).toMatchObject({
      type: ITAB_NUMBER_UPPERCASE_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({
        runtime: ITAB_NUMBER_UPPERCASE_RUNTIME,
        sizeKey: "2x4",
      }),
    });
  });
});
