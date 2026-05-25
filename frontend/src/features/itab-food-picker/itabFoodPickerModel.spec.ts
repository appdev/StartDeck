import { describe, expect, it } from "vitest";
import { ITAB_GRID_SCHEMA_VERSION } from "@/features/itab-widgets/itabGrid";
import {
  applyItabFoodPickerSizeToWidget,
  createDefaultItabFoodPickerWidget,
  ITAB_FOOD_PICKER_DEFAULT_MENU_ITEMS,
  normalizeItabFoodPickerMenuItems,
  normalizeItabFoodPickerWidgetData,
} from "./itabFoodPickerModel";
import { ITAB_FOOD_PICKER_WIDGET_TYPE } from "./itabFoodPickerTypes";

describe("itabFoodPickerModel", () => {
  it("creates the canonical iTab food picker widget with source defaults", () => {
    expect(createDefaultItabFoodPickerWidget()).toMatchObject({
      id: "food-picker",
      type: ITAB_FOOD_PICKER_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "itab-food-picker",
        layoutSystem: ITAB_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
        menuItems: ITAB_FOOD_PICKER_DEFAULT_MENU_ITEMS,
        currentItem: "",
      },
    });
  });

  it("normalizes invalid menu and temporary state", () => {
    expect(
      normalizeItabFoodPickerWidgetData({
        sizeKey: "bad",
        menuItems: ["  肠粉 ", "肠粉", "", " 云吞面  "],
        currentItem: "烧烤",
        pickedAt: -1,
      }),
    ).toEqual({
      runtime: "itab-food-picker",
      layoutSystem: ITAB_GRID_SCHEMA_VERSION,
      version: 1,
      sizeKey: "2x2",
      menuItems: ["肠粉", "云吞面"],
      currentItem: "",
    });
  });

  it("falls back to source menu items when the menu becomes empty", () => {
    expect(normalizeItabFoodPickerMenuItems(["", " "])).toEqual(
      ITAB_FOOD_PICKER_DEFAULT_MENU_ITEMS,
    );
  });

  it("applies iTab size keys without StartDeck size inversion", () => {
    const widget = createDefaultItabFoodPickerWidget();

    applyItabFoodPickerSizeToWidget(widget, "2x4");

    expect(widget).toMatchObject({
      type: ITAB_FOOD_PICKER_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({ sizeKey: "2x4" }),
    });
  });
});
