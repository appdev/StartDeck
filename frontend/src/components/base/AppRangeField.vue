<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    valueText?: string;
    disabled?: boolean;
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
    valueText: "",
    disabled: false,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: number): void;
  (e: "change", value: number): void;
}>();

const onInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  emit("update:modelValue", value);
  emit("change", value);
};
</script>

<template>
  <div class="sd-range-field">
    <div class="sd-range-field-head">
      <div class="sd-range-field-title">{{ label }}</div>
      <div class="sd-range-field-value">
        <slot name="value">{{ valueText || modelValue }}</slot>
      </div>
    </div>
    <slot>
      <input
        class="sd-range"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        :disabled="disabled"
        @input="onInput"
      />
    </slot>
  </div>
</template>
