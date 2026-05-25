import { computed, type ComputedRef } from "vue";
import type { WidgetConfig } from "@/types";
import {
  ITAB_FOOD_PICKER_DEFAULT_MENU_ITEMS,
  normalizeItabFoodPickerMenuItems,
  normalizeItabFoodPickerWidgetData,
} from "./itabFoodPickerModel";
import type { ItabFoodPickerWidgetData } from "./itabFoodPickerTypes";

const toDraftText = (items: string[]) => items.join("\n");

export const parseFoodPickerDraftText = (value: string) =>
  normalizeItabFoodPickerMenuItems(
    value
      .split(/\n|,|，|、/)
      .map((item) => item.trim())
      .filter(Boolean),
  );

export const useItabFoodPickerRuntime = (
  widget: ComputedRef<WidgetConfig>,
  onUpdate?: (data: ItabFoodPickerWidgetData) => void,
) => {
  const data = computed(() =>
    normalizeItabFoodPickerWidgetData(widget.value.data),
  );
  const menuItems = computed(() => data.value.menuItems);
  const wheelItems = computed(() => menuItems.value.slice(0, 6));
  const currentItem = computed(() => data.value.currentItem);
  const draftText = computed(() => toDraftText(menuItems.value));

  const commit = (patch: Partial<ItabFoodPickerWidgetData>) => {
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
    const normalizedItems = normalizeItabFoodPickerMenuItems(items);
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
      menuItems: [...ITAB_FOOD_PICKER_DEFAULT_MENU_ITEMS],
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
