<script setup lang="ts">
import type { WidgetConfig } from "@/types";
import DockerWidget from "@/components/DockerWidget.vue";

defineProps<{
  widget: WidgetConfig;
}>();
</script>

<template>
  <DockerWidget :widget="widget" variant="opened" />
</template>
