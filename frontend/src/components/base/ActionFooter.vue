<script setup lang="ts">
import { useSlots } from "vue";

withDefaults(
  defineProps<{
    align?: "between" | "end";
  }>(),
  {
    align: "between",
  },
);

const slots = useSlots();
</script>

<template>
  <div class="sd-action-footer" :class="{ 'justify-end': align === 'end' }">
    <div v-if="slots.leading" class="sd-action-footer-leading">
      <slot name="leading" />
    </div>
    <div class="sd-action-footer-actions">
      <slot />
    </div>
  </div>
</template>
