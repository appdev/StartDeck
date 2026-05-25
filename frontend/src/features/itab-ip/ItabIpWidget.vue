<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";
import { ITAB_IP_PROXY_PATH } from "./itabIpTypes";
import { useItabIpRuntime } from "./useItabIpRuntime";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: ItabWidgetSizeKey;
  refreshToken?: number;
}>();

const runtime = useItabIpRuntime();
const lastRefreshToken = ref(props.refreshToken ?? 0);
const sizeClass = computed(() => `ip-size-${props.sizeKey.replace("x", "-")}`);
const showOuterInfo = computed(
  () => props.sizeKey === "2x2" || props.sizeKey === "2x4",
);

onMounted(() => {
  void runtime.load();
});

watch(
  () => props.refreshToken,
  (value) => {
    const token = value ?? 0;
    if (token === lastRefreshToken.value) return;
    lastRefreshToken.value = token;
    void runtime.load(true);
  },
);
</script>

<template>
  <span
    class="itab-ip-widget"
    data-itab-ip-widget
    :data-itab-ip-size="sizeKey"
    :data-itab-ip-api="ITAB_IP_PROXY_PATH"
    :data-itab-ip-address="runtime.address.value"
    :data-itab-ip-location="runtime.outerLocation.value"
    :data-itab-ip-source-status="runtime.sourceStatus.value"
  >
    <span class="itab-ip-card" :class="[sizeClass, runtime.addressClass.value]">
      <span v-if="showOuterInfo" class="ip-outer-card">
        <strong class="ip-outer-title">
          {{ runtime.address.value }}
        </strong>
        <span class="ip-outer-subtitle">
          {{ runtime.outerLocation.value }}
        </span>
      </span>
      <span v-else class="ip-icon-card" aria-hidden="true">
        <img src="/itab-live-assets/ip.svg" alt="" />
      </span>
    </span>
  </span>
</template>

<style scoped>
.itab-ip-widget,
.itab-ip-card {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.itab-ip-card {
  overflow: hidden;
  box-sizing: border-box;
  background: rgb(60, 102, 255);
  color: #fff;
  font-family: HarmonyOS_Sans, Arial, "PingFang SC", sans-serif;
}

.ip-icon-card,
.ip-outer-card {
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
}

.ip-icon-card {
  padding: 10px;
}

.ip-icon-card img {
  display: block;
  width: min(66%, 54px);
  height: min(66%, 54px);
  object-fit: contain;
}

.ip-size-1-2 .ip-icon-card img {
  width: 40px;
  height: 40px;
}

.ip-size-2-1 .ip-icon-card img {
  width: 42px;
  height: 42px;
}

.ip-outer-card {
  flex-direction: column;
  padding: 16px 8px;
  text-align: center;
}

.ip-outer-title {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: #fff;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ip-outer-subtitle {
  display: block;
  max-width: 100%;
  margin-top: 8px;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.92);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 19px;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
  word-break: break-word;
}

.itab-ip-card.is-long-address .ip-outer-title {
  font-size: 15px;
  line-height: 21px;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
  word-break: break-all;
}

.ip-size-2-4 .ip-outer-card {
  padding: 20px 32px;
}

.ip-size-2-4 .ip-outer-title {
  font-size: 40px;
  line-height: 48px;
}

.ip-size-2-4 .ip-outer-subtitle {
  margin-top: 10px;
  font-size: 17px;
  line-height: 23px;
}

.ip-size-2-4.is-long-address .ip-outer-title {
  font-size: 32px;
  line-height: 40px;
}
</style>
