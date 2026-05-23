<script setup lang="ts">
import type {
  WidgetSize,
  WidgetSizeOption,
} from "@/composables/useWidgetResize";

defineProps<{
  options: WidgetSizeOption[];
  currentSize: WidgetSize;
  targetSize?: WidgetSize | null;
  maxSize: WidgetSize;
  runtimeCols: number;
}>();

defineEmits<{
  select: [size: WidgetSize];
}>();

const formatSize = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);
</script>

<template>
  <section class="sd-home-size-strip widget-size-strip" aria-label="组件尺寸">
    <div class="sd-home-size-strip-summary">
      <span>
        当前 {{ formatSize(currentSize.colSpan) }} x
        {{ formatSize(currentSize.rowSpan) }}
        <template v-if="targetSize">
          -> 目标 {{ formatSize(targetSize.colSpan) }} x
          {{ formatSize(targetSize.rowSpan) }}
        </template>
      </span>
      <span
        >最大 {{ formatSize(maxSize.colSpan) }} x
        {{ formatSize(maxSize.rowSpan) }}</span
      >
    </div>
    <div class="sd-home-size-options">
      <button
        v-for="option in options"
        :key="option.key || `${option.colSpan}x${option.rowSpan}`"
        type="button"
        class="sd-home-size-option"
        :data-size-key="option.key"
        :class="{
          'is-current': option.current,
          'is-target': option.target,
          'is-disabled': option.disabled,
        }"
        :disabled="option.disabled"
        :aria-disabled="option.disabled ? 'true' : 'false'"
        :aria-current="option.current ? 'true' : undefined"
        :aria-label="
          option.disabled
            ? `${option.label} 不可用，${option.reasonLabel}`
            : option.current
              ? `${option.label} 当前尺寸`
              : option.target
                ? `${option.label} 目标尺寸`
                : `${option.label} 可选尺寸`
        "
        :title="option.disabled ? option.reasonLabel : option.label"
        @click="
          $emit('select', { colSpan: option.colSpan, rowSpan: option.rowSpan })
        "
      >
        {{ option.label }}
        <span v-if="option.disabled" class="sd-home-size-option-reason"
          >不可用</span
        >
      </button>
    </div>
    <div class="sd-home-size-strip-foot">
      <span>当前移动端列数 {{ runtimeCols }}</span>
      <span>禁用尺寸可见但不可提交</span>
    </div>
  </section>
</template>
