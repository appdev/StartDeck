<script setup lang="ts">
import { useSlots } from "vue";

withDefaults(
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
  <section class="sd-inspector-panel">
    <header
      v-if="title || description || slots.headerActions"
      class="sd-inspector-panel-header"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div v-if="title" class="sd-inspector-panel-title">{{ title }}</div>
          <div v-if="description" class="sd-inspector-panel-description">
            {{ description }}
          </div>
        </div>
        <div v-if="slots.headerActions" class="shrink-0">
          <slot name="headerActions" />
        </div>
      </div>
    </header>

    <div class="sd-inspector-panel-body" :class="bodyClass">
      <slot />
    </div>

    <footer v-if="slots.footer" class="sd-inspector-panel-footer">
      <slot name="footer" />
    </footer>
  </section>
</template>
