<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "secondary" | "primary" | "danger";
    busy?: boolean;
    type?: "button" | "submit" | "reset";
  }>(),
  {
    variant: "secondary",
    busy: false,
    type: "button",
  },
);

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<template>
  <button
    :type="type"
    :disabled="busy || Boolean($attrs.disabled)"
    :aria-busy="busy ? 'true' : undefined"
    :class="['sd-home-toolbar-button', `is-${variant}`]"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>
