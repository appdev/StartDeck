<script setup lang="ts">
import { computed } from "vue";
import type { WidgetSize } from "@/composables/useWidgetResize";

const props = defineProps<{
  currentSize: WidgetSize;
  targetSize: WidgetSize;
  maxSize: WidgetSize;
  limited?: boolean;
  limitLabel?: string;
}>();

const formatSize = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

const badgeLabel = computed(
  () =>
    `${formatSize(props.currentSize.colSpan)} x ${formatSize(props.currentSize.rowSpan)} -> ${formatSize(
      props.targetSize.colSpan,
    )} x ${formatSize(props.targetSize.rowSpan)}`,
);

const maxLabel = computed(
  () =>
    `最大 ${formatSize(props.maxSize.colSpan)} x ${formatSize(props.maxSize.rowSpan)}`,
);

const targetRatio = computed(() => {
  const widthRatio =
    props.currentSize.colSpan > 0
      ? props.targetSize.colSpan / props.currentSize.colSpan
      : 1;
  const heightRatio =
    props.currentSize.rowSpan > 0
      ? props.targetSize.rowSpan / props.currentSize.rowSpan
      : 1;
  return {
    width: Math.max(0, widthRatio),
    height: Math.max(0, heightRatio),
  };
});

const ghostStyle = computed(() => {
  return {
    width: `${targetRatio.value.width * 100}%`,
    height: `${targetRatio.value.height * 100}%`,
  };
});

const badgeStyle = computed(() => {
  return {
    left: `${targetRatio.value.width * 100}%`,
    top: `${targetRatio.value.height * 100}%`,
  };
});
</script>

<template>
  <div
    class="sd-home-resize-overlay"
    :class="{ 'is-limited': limited }"
    aria-live="polite"
  >
    <div class="sd-home-resize-grid" aria-hidden="true"></div>
    <div
      class="sd-home-resize-ghost"
      :style="ghostStyle"
      aria-hidden="true"
    ></div>
    <span class="sd-home-resize-badge" :style="badgeStyle">{{
      badgeLabel
    }}</span>
    <span class="sd-home-resize-max">{{
      limited ? limitLabel || maxLabel : maxLabel
    }}</span>
  </div>
</template>
