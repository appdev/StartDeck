<script setup lang="ts">
import { useSlots } from "vue";

const props = withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    bodyClass?: string;
  }>(),
  {
    title: "",
    description: "",
    bodyClass: "",
  },
);

const slots = useSlots();
</script>

<template>
  <section class="sd-section-card">
    <div
      v-if="title || description || slots.actions"
      class="sd-section-card-header"
    >
      <div class="min-w-0">
        <div v-if="title" class="sd-section-card-title">{{ title }}</div>
        <div v-if="description" class="sd-section-card-description">
          {{ description }}
        </div>
      </div>
      <div v-if="slots.actions" class="shrink-0">
        <slot name="actions" />
      </div>
    </div>

    <div class="sd-section-card-body" :class="bodyClass">
      <slot />
    </div>

    <div v-if="slots.footer" class="sd-section-card-footer">
      <slot name="footer" />
    </div>
  </section>
</template>
