import { computed, ref, watch, type ComputedRef } from "vue";
import type { WidgetConfig } from "@/types";
import {
  normalizeItabNumberInput,
  normalizeItabNumberUppercaseWidgetData,
} from "./itabNumberUppercaseModel";
import type { ItabNumberUppercaseWidgetData } from "./itabNumberUppercaseTypes";

export const useItabNumberUppercaseRuntime = (
  widget: ComputedRef<WidgetConfig>,
  persist?: (data: ItabNumberUppercaseWidgetData) => void,
) => {
  const state = ref(normalizeItabNumberUppercaseWidgetData(widget.value.data));

  watch(
    () => widget.value.data,
    (data) => {
      state.value = normalizeItabNumberUppercaseWidgetData(data);
    },
    { deep: true },
  );

  const commit = (data: ItabNumberUppercaseWidgetData) => {
    state.value = data;
    persist?.(data);
  };

  const inputNumber = computed(() => state.value.inputNumber);
  const uppercaseResult = computed(() => state.value.uppercaseResult);
  const resultDisplay = computed(
    () => uppercaseResult.value || "转换结果将显示在这里",
  );

  const updateInput = (value: unknown) => {
    commit(
      normalizeItabNumberUppercaseWidgetData({
        ...state.value,
        inputNumber: normalizeItabNumberInput(value),
      }),
    );
  };

  const reset = () => {
    commit(
      normalizeItabNumberUppercaseWidgetData({
        ...state.value,
        inputNumber: "",
      }),
    );
  };

  return {
    inputNumber,
    resultDisplay,
    state,
    uppercaseResult,
    reset,
    updateInput,
  };
};
