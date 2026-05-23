<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "danger" | "danger-soft" | "ghost";
    size?: "sm" | "md" | "lg";
    block?: boolean;
    busy?: boolean;
    type?: "button" | "submit" | "reset";
  }>(),
  {
    variant: "secondary",
    size: "md",
    block: false,
    busy: false,
    type: "button",
  },
);

const variantClassMap = {
  primary: "sd-btn-primary",
  secondary: "sd-btn-secondary",
  danger: "sd-btn-danger",
  "danger-soft": "sd-btn-danger-soft",
  ghost: "sd-btn-ghost",
} as const;

const sizeClassMap = {
  sm: "min-h-9 px-3 text-xs",
  md: "",
  lg: "min-h-11 px-5 text-sm",
} as const;

const buttonClass = computed(() => [
  "sd-btn",
  variantClassMap[props.variant],
  sizeClassMap[props.size],
  props.block ? "w-full" : "",
]);
</script>

<template>
  <button
    v-bind="$attrs"
    :type="type"
    :disabled="busy || Boolean($attrs.disabled)"
    :aria-busy="busy ? 'true' : undefined"
    :class="buttonClass"
  >
    <slot />
  </button>
</template>
