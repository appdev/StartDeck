<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    label?: string;
    hint?: string;
    disabled?: boolean;
  }>(),
  {
    label: "",
    hint: "",
    disabled: false,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "change", value: boolean): void;
}>();

const toggle = () => {
  if (props.disabled) return;
  const nextValue = !props.modelValue;
  emit("update:modelValue", nextValue);
  emit("change", nextValue);
};
</script>

<template>
  <div class="sd-switch-row">
    <div class="sd-switch-copy">
      <slot name="prefix" />
      <div v-if="label" class="sd-switch-label">{{ label }}</div>
      <div v-if="hint" class="sd-switch-hint">{{ hint }}</div>
      <slot />
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <slot name="suffix" />
      <button
        type="button"
        class="sd-switch"
        :class="{ 'is-checked': modelValue }"
        role="switch"
        :aria-checked="modelValue ? 'true' : 'false'"
        :aria-disabled="disabled ? 'true' : undefined"
        :disabled="disabled"
        @click="toggle"
      >
        <span class="sd-switch-thumb" />
      </button>
    </div>
  </div>
</template>
