import { computed, type ComputedRef } from "vue";
import type { WidgetConfig } from "@/types";
import {
  SD_FOOD_PICKER_DEFAULT_MENU_ITEMS,
  normalizeSdFoodPickerMenuItems,
  normalizeSdFoodPickerWidgetData,
} from "./sdFoodPickerModel";
import type { SdFoodPickerWidgetData } from "./sdFoodPickerTypes";

const toDraftText = (items: string[]) => items.join("\n");

export const parseFoodPickerDraftText = (value: string) =>
  normalizeSdFoodPickerMenuItems(
    value
      .split(/\n|,|，|、/)
      .map((item) => item.trim())
      .filter(Boolean),
  );

export const useSdFoodPickerRuntime = (
  widget: ComputedRef<WidgetConfig>,
  onUpdate?: (data: SdFoodPickerWidgetData) => void,
) => {
  const data = computed(() =>
    normalizeSdFoodPickerWidgetData(widget.value.data),
  );
  const menuItems = computed(() => data.value.menuItems);
  const wheelItems = computed(() => menuItems.value.slice(0, 6));
  const currentItem = computed(() => data.value.currentItem);
  const draftText = computed(() => toDraftText(menuItems.value));

  const commit = (patch: Partial<SdFoodPickerWidgetData>) => {
    onUpdate?.({
      ...data.value,
      ...patch,
    });
  };

  const pick = () => {
    const items = menuItems.value;
    if (items.length === 0) return;
    const nextIndex = Math.floor(Math.random() * items.length);
    commit({
      currentItem: items[nextIndex] || items[0] || "",
      pickedAt: Date.now(),
    });
  };

  const updateMenuItems = (items: string[]) => {
    const normalizedItems = normalizeSdFoodPickerMenuItems(items);
    commit({
      menuItems: normalizedItems,
      currentItem: normalizedItems.includes(currentItem.value)
        ? currentItem.value
        : "",
    });
  };

  const updateMenuFromText = (text: string) => {
    updateMenuItems(parseFoodPickerDraftText(text));
  };

  const resetMenu = () => {
    commit({
      menuItems: [...SD_FOOD_PICKER_DEFAULT_MENU_ITEMS],
      currentItem: "",
      pickedAt: undefined,
    });
  };

  return {
    data,
    menuItems,
    wheelItems,
    currentItem,
    draftText,
    pick,
    updateMenuItems,
    updateMenuFromText,
    resetMenu,
  };
};
