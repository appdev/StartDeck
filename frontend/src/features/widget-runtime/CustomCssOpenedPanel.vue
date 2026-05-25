<script setup lang="ts">
import type { WidgetConfig } from "@/types";
import CustomCssWidget from "@/components/CustomCssWidget.vue";
import type { CustomCssWidgetRuntimeData } from "./customCssRuntimeModel";

defineProps<{
  widget: WidgetConfig;
}>();

const emit = defineEmits<{
  updateData: [data: CustomCssWidgetRuntimeData];
  "update-data": [data: CustomCssWidgetRuntimeData];
}>();
</script>

<template>
  <CustomCssWidget
    :widget="widget"
    variant="opened"
    @update-data="
      (data) => {
        emit('updateData', data);
        emit('update-data', data);
      }
    "
  />
</template>
