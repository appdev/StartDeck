<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";
import ItabAnniversaryCard from "./ItabAnniversaryCard.vue";
import {
  anniversaryTemplateWithSize,
  useItabAnniversaryRuntime,
} from "./useItabAnniversaryRuntime";
import type { ItabAnniversaryWidgetData } from "./itabAnniversaryTypes";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: ItabWidgetSizeKey;
  refreshToken?: number;
}>();

const emit = defineEmits<{
  updateData: [data: ItabAnniversaryWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useItabAnniversaryRuntime(widgetRef, (data) =>
  emit("updateData", data),
);
const lastRefreshToken = ref(props.refreshToken ?? 0);
const cardTemplate = computed(() =>
  anniversaryTemplateWithSize(runtime.cardTemplate.value, props.sizeKey),
);

watch(
  () => props.refreshToken,
  (value) => {
    const token = value ?? 0;
    if (token === lastRefreshToken.value) return;
    lastRefreshToken.value = token;
  },
);
</script>

<template>
  <span
    class="itab-anniversary-widget"
    data-itab-anniversary-widget
    :data-itab-anniversary-size="sizeKey"
    :data-itab-anniversary-repeat="runtime.data.value.repeat"
    :data-itab-anniversary-date="runtime.data.value.date"
  >
    <ItabAnniversaryCard :template="cardTemplate" :size-key="sizeKey" />
  </span>
</template>

<style scoped>
.itab-anniversary-widget {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
</style>
