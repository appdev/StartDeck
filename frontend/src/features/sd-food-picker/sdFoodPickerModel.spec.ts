import { describe, expect, it } from "vitest";
import { SD_GRID_SCHEMA_VERSION } from "@/features/sd-widgets/sdGrid";
import {
  applySdFoodPickerSizeToWidget,
  createDefaultSdFoodPickerWidget,
  SD_FOOD_PICKER_DEFAULT_MENU_ITEMS,
  normalizeSdFoodPickerMenuItems,
  normalizeSdFoodPickerWidgetData,
} from "./sdFoodPickerModel";
import { SD_FOOD_PICKER_WIDGET_TYPE } from "./sdFoodPickerTypes";

describe("food picker model", () => {
  it("creates the canonical food picker widget without fallback menu items", () => {
    expect(createDefaultSdFoodPickerWidget()).toMatchObject({
      id: "food-picker",
      type: SD_FOOD_PICKER_WIDGET_TYPE,
      colSpan: 2,
      rowSpan: 2,
      w: 2,
      h: 2,
      data: {
        runtime: "sd-food-picker",
        layoutSystem: SD_GRID_SCHEMA_VERSION,
        version: 1,
        sizeKey: "2x2",
        menuItems: SD_FOOD_PICKER_DEFAULT_MENU_ITEMS,
        currentItem: "",
      },
    });
  });

  it("normalizes invalid menu and temporary state", () => {
    expect(
      normalizeSdFoodPickerWidgetData({
        sizeKey: "bad",
        menuItems: ["  肠粉 ", "肠粉", "", " 云吞面  "],
        currentItem: "烧烤",
        pickedAt: -1,
      }),
    ).toEqual({
      runtime: "sd-food-picker",
      layoutSystem: SD_GRID_SCHEMA_VERSION,
      version: 1,
      sizeKey: "2x2",
      menuItems: ["肠粉", "云吞面"],
      currentItem: "",
    });
  });

  it("keeps an empty menu empty", () => {
    expect(normalizeSdFoodPickerMenuItems(["", " "])).toEqual([]);
    expect(SD_FOOD_PICKER_DEFAULT_MENU_ITEMS).toEqual([]);
  });

  it("applies scoped size keys without StartDeck size inversion", () => {
    const widget = createDefaultSdFoodPickerWidget();

    applySdFoodPickerSizeToWidget(widget, "2x4");

    expect(widget).toMatchObject({
      type: SD_FOOD_PICKER_WIDGET_TYPE,
      colSpan: 4,
      rowSpan: 2,
      w: 4,
      h: 2,
      data: expect.objectContaining({ sizeKey: "2x4" }),
    });
  });
});
