import { computed, ref, watch, type ComputedRef } from "vue";
import type { WidgetConfig } from "@/types";
import {
  normalizeSdNumberInput,
  normalizeSdNumberUppercaseWidgetData,
} from "./sdNumberUppercaseModel";
import type { SdNumberUppercaseWidgetData } from "./sdNumberUppercaseTypes";

export const useSdNumberUppercaseRuntime = (
  widget: ComputedRef<WidgetConfig>,
  persist?: (data: SdNumberUppercaseWidgetData) => void,
) => {
  const state = ref(normalizeSdNumberUppercaseWidgetData(widget.value.data));

  watch(
    () => widget.value.data,
    (data) => {
      state.value = normalizeSdNumberUppercaseWidgetData(data);
    },
    { deep: true },
  );

  const commit = (data: SdNumberUppercaseWidgetData) => {
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
      normalizeSdNumberUppercaseWidgetData({
        ...state.value,
        inputNumber: normalizeSdNumberInput(value),
      }),
    );
  };

  const reset = () => {
    commit(
      normalizeSdNumberUppercaseWidgetData({
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
