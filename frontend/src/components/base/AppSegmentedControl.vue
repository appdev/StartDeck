<script setup lang="ts">
export interface AppSegmentedOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

defineProps<{
  modelValue: string | number;
  options: ReadonlyArray<AppSegmentedOption>;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string | number): void;
  (e: "change", value: string | number): void;
}>();

const select = (value: string | number, disabled?: boolean) => {
  if (disabled) return;
  emit("update:modelValue", value);
  emit("change", value);
};
</script>

<template>
  <div class="sd-segmented sd-segmented-control">
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      class="sd-segment-button"
      :class="{ 'is-active': modelValue === option.value }"
      :disabled="option.disabled"
      @click="select(option.value, option.disabled)"
    >
      <slot
        name="option"
        :option="option"
        :active="modelValue === option.value"
      >
        {{ option.label }}
      </slot>
    </button>
  </div>
</template>
