<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    hint?: string;
    align?: "start" | "center";
  }>(),
  {
    hint: "",
    align: "start",
  },
);
</script>

<template>
  <div class="sd-field-row" :class="{ 'is-center': align === 'center' }">
    <div class="sd-field-copy">
      <div class="sd-field-label">{{ label }}</div>
      <div v-if="hint" class="sd-field-hint">{{ hint }}</div>
      <slot />
    </div>

    <div class="sd-field-control">
      <slot name="control" />
    </div>
  </div>
</template>
