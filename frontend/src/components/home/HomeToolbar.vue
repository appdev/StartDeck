<script setup lang="ts">
withDefaults(
  defineProps<{
    ariaLabel: string;
    testId?: string;
  }>(),
  {
    testId: "",
  },
);
</script>

<template>
  <div
    class="sd-home-toolbar"
    :data-testid="testId || undefined"
    role="toolbar"
    :aria-label="ariaLabel"
  >
    <slot />
  </div>
</template>
