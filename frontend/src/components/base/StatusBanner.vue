<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    message: string;
    tone?: "info" | "success" | "warning" | "danger";
  }>(),
  {
    title: "",
    tone: "info",
  },
);
</script>

<template>
  <section
    class="sd-status-banner"
    :class="{
      'is-success': tone === 'success',
      'is-warning': tone === 'warning',
      'is-danger': tone === 'danger',
    }"
  >
    <div class="sd-status-banner-copy">
      <div v-if="title" class="sd-status-banner-title">{{ title }}</div>
      <div class="sd-status-banner-message">{{ message }}</div>
    </div>
    <div v-if="$slots.actions" class="shrink-0">
      <slot name="actions" />
    </div>
  </section>
</template>
