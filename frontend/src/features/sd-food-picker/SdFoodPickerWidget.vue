<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";
import { useSdFoodPickerRuntime } from "./useSdFoodPickerRuntime";
import type { SdFoodPickerWidgetData } from "./sdFoodPickerTypes";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: SdWidgetSizeKey;
  refreshToken?: number;
}>();

const emit = defineEmits<{
  updateData: [data: SdFoodPickerWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useSdFoodPickerRuntime(widgetRef, (data) =>
  emit("updateData", data),
);
const lastRefreshToken = ref(props.refreshToken ?? 0);

watch(
  () => props.refreshToken,
  (value) => {
    const token = value ?? 0;
    if (token === lastRefreshToken.value) return;
    lastRefreshToken.value = token;
    runtime.pick();
  },
);
</script>

<template>
  <span
    class="sd-food-picker-widget"
    data-sd-food-picker-widget
    :data-sd-food-picker-size="sizeKey"
    :data-sd-food-picker-current="runtime.currentItem.value"
  >
    <span class="food-picker-card">
      <strong>今天吃什么</strong>
      <button
        type="button"
        data-grid-drag-ignore="true"
        data-runtime-open-ignore="true"
        aria-label="开始抽取今天吃什么"
        @click.stop="runtime.pick"
      >
        开始
      </button>
    </span>
  </span>
</template>

<style scoped>
.sd-food-picker-widget,
.food-picker-card {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.food-picker-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--sd-theme-food-picker-food-picker-widget-surface-01);
  color: var(--sd-theme-food-picker-food-picker-widget-accent-text-01);
  text-align: center;
}

.food-picker-card strong {
  display: block;
  color: var(--sd-theme-food-picker-food-picker-widget-accent-text-01);
  font-size: 8px;
  font-weight: 700;
  line-height: 12px;
  white-space: nowrap;
}

.food-picker-card button {
  display: flex;
  width: 38px;
  height: 13px;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: var(
    --sd-theme-food-picker-food-picker-widget-accent-surface-01
  );
  color: var(--sd-theme-food-picker-food-picker-widget-text-01);
  box-shadow: var(--sd-theme-food-picker-food-picker-widget-shadow-01) 0
    2px 6px 0;
  font-size: 5.36px;
  line-height: 8.04px;
  cursor: pointer;
}

.sd-food-picker-widget[data-sd-food-picker-size="2x2"]
  .food-picker-card
  strong,
.sd-food-picker-widget[data-sd-food-picker-size="2x4"]
  .food-picker-card
  strong {
  font-size: 21px;
  line-height: 31.5px;
}

.sd-food-picker-widget[data-sd-food-picker-size="2x2"]
  .food-picker-card
  button,
.sd-food-picker-widget[data-sd-food-picker-size="2x4"]
  .food-picker-card
  button {
  width: 99px;
  height: 34px;
  margin-top: 18px;
  border-radius: 21px;
  font-size: 14.07px;
  line-height: 21.105px;
}
</style>
