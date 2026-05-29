<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
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

const loadForCurrentSize = async (refresh = false) => {
  if (refresh) {
    await runtime.load();
  } else {
    await runtime.ensureLoaded();
  }
  if (showOuterInfo.value) {
    await runtime.refreshLatencyIfNeeded();
  }
};

onMounted(() => {
  void loadForCurrentSize();
  if (showOuterInfo.value) {
    runtime.startLatencyAutoRefresh();
  }
});

onBeforeUnmount(() => {
  if (showOuterInfo.value) {
    runtime.stopLatencyAutoRefresh();
  }
});

watch(
  () => props.refreshToken,
  (value) => {
    const token = value ?? 0;
    if (token === lastRefreshToken.value) return;
    lastRefreshToken.value = token;
    void loadForCurrentSize(true);
  },
);

watch(showOuterInfo, (visible, previousVisible) => {
  if (visible) {
    void loadForCurrentSize();
    if (!previousVisible) runtime.startLatencyAutoRefresh();
  } else if (previousVisible) {
    runtime.stopLatencyAutoRefresh();
  }
});
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
        <span
          class="ip-outer-latency"
          :class="{ 'is-testing': runtime.latencyLoading.value }"
        >
          延迟 {{ runtime.latencyLabel.value }}
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
  background: var(--sd-theme-itab-ip-ip-widget-accent-surface-01);
  color: var(--sd-theme-itab-ip-ip-widget-text-01);
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
  gap: 6px;
  padding: 12px 10px;
  text-align: center;
}

.ip-outer-title {
  display: block;
  max-width: 100%;
  overflow: visible;
  color: var(--sd-theme-itab-ip-ip-widget-text-01);
  font-size: 17px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 22px;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
  word-break: break-all;
}

.ip-outer-subtitle {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: var(--sd-theme-itab-ip-ip-widget-text-02);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 18px;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
  word-break: break-word;
}

.ip-outer-latency {
  display: inline-flex;
  min-height: 22px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border: 1px solid
    color-mix(
      in srgb,
      var(--sd-theme-itab-ip-ip-widget-text-01) 28%,
      transparent
    );
  border-radius: 999px;
  background: color-mix(
    in srgb,
    var(--sd-theme-itab-ip-ip-widget-text-01) 15%,
    transparent
  );
  color: var(--sd-theme-itab-ip-ip-widget-text-02);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
}

.ip-outer-latency.is-testing {
  color: color-mix(
    in srgb,
    var(--sd-theme-itab-ip-ip-widget-text-02) 70%,
    transparent
  );
}

.itab-ip-card.is-long-address .ip-outer-title {
  font-size: 14px;
  line-height: 18px;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
  word-break: break-all;
}

.ip-size-2-4 .ip-outer-card {
  gap: 7px;
  padding: 16px 28px;
}

.ip-size-2-4 .ip-outer-title {
  font-size: 32px;
  line-height: 38px;
}

.ip-size-2-4 .ip-outer-subtitle {
  font-size: 16px;
  line-height: 21px;
}

.ip-size-2-4 .ip-outer-latency {
  min-height: 24px;
  padding-inline: 10px;
  font-size: 13px;
  line-height: 18px;
}

.ip-size-2-4.is-long-address .ip-outer-title {
  font-size: 24px;
  line-height: 30px;
}
</style>
