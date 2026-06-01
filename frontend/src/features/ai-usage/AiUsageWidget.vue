<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";
import { useAuthStore } from "@/stores/auth";
import AiProviderIcon from "./AiProviderIcon.vue";
import { queryAiUsage } from "./aiUsageApi";
import {
  loadBrowserAiUsageCredential,
  credentialStorageLabel,
} from "./aiUsageCredentialStorage";
import { normalizeAiUsageWidgetData } from "./aiUsageModel";
import {
  isAiUsageProviderQueryAvailable,
  getAiUsageProvider,
} from "./aiUsageProviders";
import type { AiUsageProviderSummary, AiUsageWidgetData } from "./aiUsageTypes";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: SdWidgetSizeKey;
  refreshToken?: number;
}>();

const emit = defineEmits<{
  updateData: [data: AiUsageWidgetData];
}>();

const auth = useAuthStore();
const refreshing = ref(false);
const lastRefreshToken = ref(props.refreshToken ?? 0);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const data = computed(() => normalizeAiUsageWidgetData(props.widget.data));
const provider = computed(() => getAiUsageProvider(data.value.providerId));
const summary = computed(() => data.value.lastSummary);
const primaryPercent = computed(() => summary.value?.primaryRemainingPercent);
const weeklyPercent = computed(() => summary.value?.weeklyRemainingPercent);
const status = computed(() => summary.value?.status || "needs-config");
const statusLabel = computed(() => {
  if (refreshing.value || status.value === "syncing") return "同步中";
  if (status.value === "connected") return "已同步";
  if (status.value === "error") return "需检查";
  return "待配置";
});
const accountLine = computed(
  () =>
    data.value.accountLabel ||
    provider.value.name ||
    credentialStorageLabel(data.value.credentialStorage),
);

const percentLabel = (value: number | null | undefined) =>
  typeof value === "number" ? `${Math.round(value)}%` : "--";

const barStyle = (value: number | null | undefined) => ({
  width: `${typeof value === "number" ? Math.max(0, Math.min(100, value)) : 0}%`,
});

const buildQueryCredential = () => {
  if (!isAiUsageProviderQueryAvailable(data.value.providerId)) return null;
  if (data.value.credentialStorage === "server") {
    return {
      widgetId: props.widget.id,
      providerId: data.value.providerId,
      credentialStorage: "server" as const,
    };
  }
  if (data.value.credentialStorage === "browser") {
    const stored = loadBrowserAiUsageCredential(
      auth.username || "guest",
      props.widget.id,
      data.value.providerId,
    );
    if (!stored) return null;
    return {
      widgetId: props.widget.id,
      providerId: data.value.providerId,
      credentialStorage: "browser" as const,
      credentialType: stored.credentialType,
      credential: stored.credential,
      accountId: stored.accountId,
    };
  }
  return null;
};

const applySummary = (next: AiUsageProviderSummary) => {
  emit("updateData", {
    ...data.value,
    lastSummary: next,
    hasServerCredential:
      data.value.credentialStorage === "server"
        ? data.value.hasServerCredential
        : false,
  });
};

const refreshUsage = async () => {
  const request = buildQueryCredential();
  if (!request || refreshing.value || !auth.isLogged) return;
  refreshing.value = true;
  try {
    const next = await queryAiUsage(request);
    applySummary(next);
  } catch (error) {
    applySummary({
      providerId: data.value.providerId,
      status: "error",
      primaryRemainingPercent: primaryPercent.value ?? null,
      weeklyRemainingPercent: weeklyPercent.value ?? null,
      lastSyncedAt: new Date().toISOString(),
      errorCode: error instanceof Error ? error.message : "request_failed",
    });
  } finally {
    refreshing.value = false;
  }
};

const resetTimer = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  const minutes = data.value.refreshIntervalMinutes;
  if (
    data.value.credentialStorage !== "once" &&
    isAiUsageProviderQueryAvailable(data.value.providerId)
  ) {
    refreshTimer = setInterval(refreshUsage, minutes * 60 * 1000);
  }
};

watch(
  () => props.refreshToken,
  (value) => {
    const token = value ?? 0;
    if (token === lastRefreshToken.value) return;
    lastRefreshToken.value = token;
    void refreshUsage();
  },
);

watch(
  () => [
    data.value.providerId,
    data.value.credentialStorage,
    data.value.refreshIntervalMinutes,
  ],
  resetTimer,
);

onMounted(() => {
  resetTimer();
  void refreshUsage();
});

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<template>
  <span
    class="ai-usage-widget"
    :data-ai-usage-size="sizeKey"
    :data-ai-usage-provider="data.providerId"
    :data-ai-usage-status="status"
  >
    <span class="ai-usage-header" v-if="sizeKey !== '1x1'">
      <AiProviderIcon :provider-id="data.providerId" />
      <span class="ai-usage-title">
        <strong>{{
          sizeKey === "1x2" || sizeKey === "2x1"
            ? provider.name
            : data.displayName
        }}</strong>
        <small>{{ sizeKey === "1x2" ? "共享" : accountLine }}</small>
      </span>
      <span class="ai-usage-status">{{ statusLabel }}</span>
    </span>

    <span class="ai-usage-hero">
      <span class="ai-usage-primary-label">{{
        sizeKey === "1x1" ? "5h 余额" : "5h"
      }}</span>
      <strong>{{ percentLabel(primaryPercent) }}</strong>
      <small>剩余</small>
    </span>

    <span class="ai-usage-meters">
      <span class="ai-usage-meter-row">
        <span>5h</span>
        <span class="ai-usage-meter" aria-label="5小时使用限额">
          <span :style="barStyle(primaryPercent)" />
        </span>
        <strong>{{ percentLabel(primaryPercent) }}</strong>
      </span>
      <span class="ai-usage-meter-row">
        <span>周</span>
        <span class="ai-usage-meter" aria-label="每周使用限额">
          <span :style="barStyle(weeklyPercent)" />
        </span>
        <strong>{{ percentLabel(weeklyPercent) }}</strong>
      </span>
    </span>

    <span class="ai-usage-board" v-if="sizeKey === '2x4'">
      <span class="ai-usage-board-card">
        <small>5 小时使用限额</small>
        <strong>{{ percentLabel(primaryPercent) }} 剩余</strong>
        <span class="ai-usage-meter">
          <span :style="barStyle(primaryPercent)" />
        </span>
        <em>重置时间：{{ summary?.primaryResetLabel || "--" }}</em>
      </span>
      <span class="ai-usage-board-card">
        <small>每周使用限额</small>
        <strong>{{ percentLabel(weeklyPercent) }} 剩余</strong>
        <span class="ai-usage-meter">
          <span :style="barStyle(weeklyPercent)" />
        </span>
        <em>重置：{{ summary?.weeklyResetLabel || "--" }}</em>
      </span>
    </span>
  </span>
</template>

<style scoped>
.ai-usage-widget {
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--sd-widget-border);
  border-radius: var(--sd-widget-radius);
  background: var(--sd-widget-surface-strong);
  color: var(--sd-widget-text-primary);
  box-shadow: var(--sd-widget-shadow);
  container-type: size;
}

.ai-usage-header {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.ai-usage-title {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.ai-usage-title strong,
.ai-usage-title small,
.ai-usage-status,
.ai-usage-meter-row span,
.ai-usage-board-card em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-usage-title strong {
  font-size: 14px;
  line-height: 18px;
}

.ai-usage-title small,
.ai-usage-primary-label,
.ai-usage-meter-row span,
.ai-usage-board-card small,
.ai-usage-board-card em {
  color: var(--sd-widget-text-secondary);
}

.ai-usage-status {
  margin-left: auto;
  border-radius: 999px;
  padding: 4px 8px;
  background: var(--sd-state-success-surface);
  color: var(--sd-state-success);
  font-size: 11px;
  font-weight: 700;
}

.ai-usage-hero {
  display: grid;
  justify-items: center;
  align-content: center;
  min-width: 0;
}

.ai-usage-hero strong {
  font-size: 42px;
  line-height: 42px;
  letter-spacing: 0;
}

.ai-usage-hero small {
  color: var(--sd-widget-text-secondary);
  font-size: 15px;
  font-weight: 800;
}

.ai-usage-meters {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.ai-usage-meter-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 42px;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ai-usage-meter-row strong {
  justify-self: end;
  font-size: 14px;
}

.ai-usage-meter {
  display: block;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(
    in srgb,
    var(--sd-widget-text-tertiary) 18%,
    transparent
  );
}

.ai-usage-meter span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--sd-state-success);
}

.ai-usage-board {
  display: none;
}

.ai-usage-board-card {
  display: grid;
  min-width: 0;
  gap: 10px;
  border: 1px solid var(--sd-widget-border);
  border-radius: 14px;
  background: var(--sd-widget-surface-muted);
  padding: 14px;
}

.ai-usage-board-card strong {
  font-size: 28px;
  line-height: 32px;
}

.ai-usage-widget[data-ai-usage-size="1x1"] {
  grid-template-rows: 1fr auto;
  gap: 2px;
  padding: 6px;
}

.ai-usage-widget[data-ai-usage-size="1x1"] .ai-usage-primary-label {
  display: block;
  justify-self: start;
}

.ai-usage-widget[data-ai-usage-size="1x1"] .ai-usage-hero strong {
  justify-self: start;
  font-size: 18px;
  line-height: 18px;
}

.ai-usage-widget[data-ai-usage-size="1x1"] .ai-usage-hero small,
.ai-usage-widget[data-ai-usage-size="1x1"] .ai-usage-primary-label {
  font-size: 6px;
  font-weight: 800;
  line-height: 8px;
}

.ai-usage-widget[data-ai-usage-size="1x1"] .ai-usage-hero small {
  display: none;
}

.ai-usage-widget[data-ai-usage-size="1x1"] .ai-usage-hero {
  align-content: center;
  justify-items: start;
  gap: 3px;
}

.ai-usage-widget[data-ai-usage-size="1x1"] .ai-usage-meters {
  gap: 2px;
}

.ai-usage-widget[data-ai-usage-size="1x1"] .ai-usage-meter-row {
  grid-template-columns: minmax(0, 1fr) auto;
  justify-items: stretch;
  gap: 2px;
}

.ai-usage-widget[data-ai-usage-size="1x1"]
  .ai-usage-meter-row:first-child
  > span:first-child,
.ai-usage-widget[data-ai-usage-size="1x1"]
  .ai-usage-meter-row:first-child
  > strong {
  display: none;
}

.ai-usage-widget[data-ai-usage-size="1x1"]
  .ai-usage-meter-row
  > span:first-child {
  display: inline;
}

.ai-usage-widget[data-ai-usage-size="1x1"]
  .ai-usage-meter-row:first-child
  .ai-usage-meter {
  display: block;
  grid-column: 1 / -1;
  height: 4px;
}

.ai-usage-widget[data-ai-usage-size="1x1"]
  .ai-usage-meter-row:nth-child(2)
  .ai-usage-meter {
  display: none;
}

.ai-usage-widget[data-ai-usage-size="1x1"] .ai-usage-meter-row span,
.ai-usage-widget[data-ai-usage-size="1x1"] .ai-usage-meter-row strong {
  font-size: 8px;
  line-height: 9px;
}

.ai-usage-widget[data-ai-usage-size="1x2"] {
  grid-template-columns: 38px minmax(0, 1fr);
  grid-template-rows: 1fr;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
}

.ai-usage-widget[data-ai-usage-size="1x2"] .ai-usage-status,
.ai-usage-widget[data-ai-usage-size="1x2"] .ai-usage-hero {
  display: none;
}

.ai-usage-widget[data-ai-usage-size="1x2"] .ai-usage-header {
  display: grid;
  justify-items: center;
  min-width: 0;
  gap: 3px;
}

.ai-usage-widget[data-ai-usage-size="1x2"] :deep(.ai-provider-icon) {
  width: 15px;
  height: 15px;
  border-radius: 5px;
}

.ai-usage-widget[data-ai-usage-size="1x2"] .ai-usage-title {
  justify-items: center;
  gap: 1px;
  text-align: center;
}

.ai-usage-widget[data-ai-usage-size="1x2"] .ai-usage-title strong,
.ai-usage-widget[data-ai-usage-size="1x2"] .ai-usage-title small {
  display: block;
  max-width: 34px;
  font-size: 6px;
  line-height: 7px;
}

.ai-usage-widget[data-ai-usage-size="1x2"] .ai-usage-meters {
  gap: 4px;
}

.ai-usage-widget[data-ai-usage-size="1x2"] .ai-usage-meter-row {
  grid-template-columns: 15px 22px minmax(0, 1fr);
  gap: 4px;
}

.ai-usage-widget[data-ai-usage-size="1x2"] .ai-usage-meter {
  grid-column: 3;
  grid-row: 1;
  height: 6px;
}

.ai-usage-widget[data-ai-usage-size="1x2"] .ai-usage-meter-row strong {
  grid-column: 2;
  grid-row: 1;
}

.ai-usage-widget[data-ai-usage-size="1x2"] .ai-usage-meter-row span,
.ai-usage-widget[data-ai-usage-size="1x2"] .ai-usage-meter-row strong {
  font-size: 10px;
  line-height: 11px;
}

.ai-usage-widget[data-ai-usage-size="2x1"] {
  grid-template-columns: 1fr;
  grid-template-rows: auto minmax(0, 1fr) auto;
  justify-items: center;
  gap: 6px;
  padding: 8px;
}

.ai-usage-widget[data-ai-usage-size="2x1"] .ai-usage-header {
  display: grid;
  justify-content: center;
  justify-items: center;
  gap: 3px;
}

.ai-usage-widget[data-ai-usage-size="2x1"] .ai-usage-status,
.ai-usage-widget[data-ai-usage-size="2x1"] .ai-usage-primary-label {
  display: none;
}

.ai-usage-widget[data-ai-usage-size="2x1"] :deep(.ai-provider-icon) {
  width: 21px;
  height: 21px;
  border-radius: 8px;
}

.ai-usage-widget[data-ai-usage-size="2x1"] .ai-usage-title {
  justify-items: center;
}

.ai-usage-widget[data-ai-usage-size="2x1"] .ai-usage-title strong {
  font-size: 6px;
  line-height: 8px;
}

.ai-usage-widget[data-ai-usage-size="2x1"] .ai-usage-title small {
  display: none;
}

.ai-usage-widget[data-ai-usage-size="2x1"] .ai-usage-hero {
  justify-items: center;
}

.ai-usage-widget[data-ai-usage-size="2x1"] .ai-usage-hero strong {
  font-size: 20px;
  line-height: 20px;
}

.ai-usage-widget[data-ai-usage-size="2x1"] .ai-usage-hero small {
  font-size: 7px;
  line-height: 9px;
}

.ai-usage-widget[data-ai-usage-size="2x1"] .ai-usage-meters {
  width: 100%;
  gap: 4px;
}

.ai-usage-widget[data-ai-usage-size="2x1"] .ai-usage-meter-row {
  grid-template-columns: 1fr auto;
  gap: 2px;
}

.ai-usage-widget[data-ai-usage-size="2x1"] .ai-usage-meter {
  grid-column: 1 / -1;
  grid-row: 2;
  width: 100%;
  height: 4px;
}

.ai-usage-widget[data-ai-usage-size="2x1"] .ai-usage-meter-row strong {
  font-size: 7px;
  line-height: 8px;
}

.ai-usage-widget[data-ai-usage-size="2x1"] .ai-usage-meter-row span {
  font-size: 7px;
  line-height: 8px;
}

.ai-usage-widget[data-ai-usage-size="2x2"] {
  grid-template-rows: auto 1fr auto;
  gap: 6px;
  border-radius: 18px;
  padding: 11px;
}

.ai-usage-widget[data-ai-usage-size="2x2"] .ai-usage-primary-label {
  display: none;
}

.ai-usage-widget[data-ai-usage-size="2x2"] :deep(.ai-provider-icon) {
  width: 17px;
  height: 17px;
  border-radius: 6px;
}

.ai-usage-widget[data-ai-usage-size="2x2"] .ai-usage-header {
  display: grid;
  grid-template-columns: 17px minmax(0, 1fr) max-content;
  gap: 6px;
}

.ai-usage-widget[data-ai-usage-size="2x2"] .ai-usage-title strong {
  font-size: 9px;
  line-height: 11px;
}

.ai-usage-widget[data-ai-usage-size="2x2"] .ai-usage-title small {
  display: block;
  font-size: 7px;
  line-height: 9px;
}

.ai-usage-widget[data-ai-usage-size="2x2"] .ai-usage-status {
  min-width: max-content;
  padding: 3px 5px;
  font-size: 7px;
  flex-shrink: 0;
  line-height: 9px;
}

.ai-usage-widget[data-ai-usage-size="2x2"] .ai-usage-hero strong {
  justify-self: start;
  font-size: 25px;
  line-height: 25px;
}

.ai-usage-widget[data-ai-usage-size="2x2"] .ai-usage-hero small {
  justify-self: start;
  font-size: 8px;
  line-height: 10px;
}

.ai-usage-widget[data-ai-usage-size="2x2"] .ai-usage-hero {
  justify-items: start;
}

.ai-usage-widget[data-ai-usage-size="2x2"] .ai-usage-meters {
  gap: 5px;
}

.ai-usage-widget[data-ai-usage-size="2x2"] .ai-usage-meter-row {
  grid-template-columns: 26px minmax(0, 1fr) 32px;
  gap: 5px;
}

.ai-usage-widget[data-ai-usage-size="2x2"] .ai-usage-meter {
  height: 6px;
}

.ai-usage-widget[data-ai-usage-size="2x2"] .ai-usage-meter-row span,
.ai-usage-widget[data-ai-usage-size="2x2"] .ai-usage-meter-row strong {
  font-size: 11px;
}

.ai-usage-widget[data-ai-usage-size="2x4"] {
  grid-template-rows: auto 1fr;
  gap: 8px;
  border-radius: 18px;
  padding: 13px 14px;
}

.ai-usage-widget[data-ai-usage-size="2x4"] :deep(.ai-provider-icon) {
  width: 17px;
  height: 17px;
  border-radius: 6px;
}

.ai-usage-widget[data-ai-usage-size="2x4"] .ai-usage-status {
  padding: 3px 6px;
  font-size: 7px;
  line-height: 9px;
}

.ai-usage-widget[data-ai-usage-size="2x4"] .ai-usage-title strong {
  font-size: 10px;
  line-height: 11px;
}

.ai-usage-widget[data-ai-usage-size="2x4"] .ai-usage-title small {
  font-size: 7px;
  line-height: 9px;
}

.ai-usage-widget[data-ai-usage-size="2x4"] .ai-usage-hero,
.ai-usage-widget[data-ai-usage-size="2x4"] .ai-usage-meters {
  display: none;
}

.ai-usage-widget[data-ai-usage-size="2x4"] .ai-usage-board {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.ai-usage-widget[data-ai-usage-size="2x4"] .ai-usage-board-card {
  gap: 5px;
  border-radius: 12px;
  padding: 8px;
}

.ai-usage-widget[data-ai-usage-size="2x4"] .ai-usage-board-card strong {
  font-size: 21px;
  line-height: 22px;
}

.ai-usage-widget[data-ai-usage-size="2x4"] .ai-usage-board-card small,
.ai-usage-widget[data-ai-usage-size="2x4"] .ai-usage-board-card em {
  font-size: 7px;
  line-height: 9px;
}

.ai-usage-widget[data-ai-usage-size="2x4"] .ai-usage-meter {
  height: 8px;
}
</style>
