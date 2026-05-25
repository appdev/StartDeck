<script setup lang="ts">
import type { WidgetConfig } from "@/types";
import SystemStatusWidget from "@/components/SystemStatusWidget.vue";

defineProps<{
  widget: WidgetConfig;
}>();
</script>

<template>
  <SystemStatusWidget :widget="widget" variant="opened" />
</template>
