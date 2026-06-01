<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";
import SdAnniversaryCard from "./SdAnniversaryCard.vue";
import {
  anniversaryTemplateWithSize,
  useSdAnniversaryRuntime,
} from "./useSdAnniversaryRuntime";
import type { SdAnniversaryWidgetData } from "./sdAnniversaryTypes";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: SdWidgetSizeKey;
  refreshToken?: number;
}>();

const emit = defineEmits<{
  updateData: [data: SdAnniversaryWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useSdAnniversaryRuntime(widgetRef, (data) =>
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
    class="sd-anniversary-widget"
    data-sd-anniversary-widget
    :data-sd-anniversary-size="sizeKey"
    :data-sd-anniversary-repeat="runtime.data.value.repeat"
    :data-sd-anniversary-date="runtime.data.value.date"
  >
    <SdAnniversaryCard :template="cardTemplate" :size-key="sizeKey" />
  </span>
</template>

<style scoped>
.sd-anniversary-widget {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
</style>
