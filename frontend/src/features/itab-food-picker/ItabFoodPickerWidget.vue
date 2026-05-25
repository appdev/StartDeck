<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";
import { useItabFoodPickerRuntime } from "./useItabFoodPickerRuntime";
import type { ItabFoodPickerWidgetData } from "./itabFoodPickerTypes";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: ItabWidgetSizeKey;
  refreshToken?: number;
}>();

const emit = defineEmits<{
  updateData: [data: ItabFoodPickerWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useItabFoodPickerRuntime(widgetRef, (data) =>
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
    class="itab-food-picker-widget"
    data-itab-food-picker-widget
    :data-itab-food-picker-size="sizeKey"
    :data-itab-food-picker-current="runtime.currentItem.value"
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
.itab-food-picker-widget,
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
  background: #fff;
  color: #1f2937;
  text-align: center;
}

.food-picker-card strong {
  display: block;
  color: oklch(0.278 0.033 256.848);
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
  background: #f39b2d;
  color: #fff;
  box-shadow: rgb(242, 178, 65) 0 2px 6px 0;
  font-size: 5.36px;
  line-height: 8.04px;
  cursor: pointer;
}

.itab-food-picker-widget[data-itab-food-picker-size="2x2"]
  .food-picker-card
  strong,
.itab-food-picker-widget[data-itab-food-picker-size="2x4"]
  .food-picker-card
  strong {
  font-size: 21px;
  line-height: 31.5px;
}

.itab-food-picker-widget[data-itab-food-picker-size="2x2"]
  .food-picker-card
  button,
.itab-food-picker-widget[data-itab-food-picker-size="2x4"]
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
