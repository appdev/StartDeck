<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";
import { useAuthStore } from "@/stores/auth";
import { queryTapdDefects } from "./tapdDefectApi";
import {
  buildTapdFilters,
  hasTapdDefectConnection,
  isTapdReopenedStatus,
  normalizeTapdDefectWidgetData,
  resolveTapdDisplayName,
  scopeLabel,
  tapdDefectStatusLabel,
} from "./tapdDefectModel";
import type {
  TapdDefectSummary,
  TapdDefectWidgetData,
} from "./tapdDefectTypes";
import TapdLogo from "./TapdLogo.vue";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: SdWidgetSizeKey;
  refreshToken?: number;
}>();

const emit = defineEmits<{
  updateData: [data: TapdDefectWidgetData];
}>();

const auth = useAuthStore();
const refreshing = ref(false);
const lastRefreshToken = ref(props.refreshToken ?? 0);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const data = computed(() => normalizeTapdDefectWidgetData(props.widget.data));
const summary = computed(() => data.value.lastSummary);
const isCatalogPreview = computed(() => data.value.catalogPreview === true);
const needsConfig = computed(
  () =>
    !isCatalogPreview.value &&
    (!auth.isLogged || !hasTapdDefectConnection(data.value)),
);
const title = computed(() =>
  needsConfig.value ? "TAPD 缺陷" : resolveTapdDisplayName(data.value),
);
const statusLabel = computed(() => {
  if (refreshing.value || summary.value?.status === "syncing") return "同步中";
  if (needsConfig.value) return "待配置";
  if (summary.value?.status === "error") return "需检查";
  if (summary.value?.status === "connected") return "已同步";
  return "待同步";
});
const visibleTotal = computed(() =>
  needsConfig.value ? 0 : (summary.value?.visibleTotal ?? 0),
);
const reopenedTotal = computed(() =>
  needsConfig.value
    ? 0
    : (summary.value?.items.filter((item) => isTapdReopenedStatus(item.status))
        .length ?? 0),
);
const criticalTotal = computed(() =>
  needsConfig.value ? 0 : (summary.value?.critical ?? 0),
);
const effectiveScope = computed(() => data.value.visibilityScope);
const topItemLimit = computed(() => {
  if (props.sizeKey === "2x4") return 3;
  if (props.sizeKey === "2x2") return 2;
  return 0;
});
const topItems = computed(() =>
  needsConfig.value
    ? []
    : (summary.value?.items.slice(0, topItemLimit.value) ?? []),
);
const scopeText = computed(() => scopeLabel(effectiveScope.value));
const metaLine = computed(() => {
  if (needsConfig.value) return "请配置相关参数";
  const parts = [scopeText.value];
  if (data.value.query.currentUser) parts.push("当前账号");
  if (data.value.blockedBugIds.length > 0)
    parts.push(`隐藏 ${data.value.blockedBugIds.length}`);
  if (summary.value?.lastSyncedAt) parts.push("已同步");
  return parts.join(" · ");
});

const applySummary = (next: TapdDefectSummary) => {
  emit("updateData", {
    ...data.value,
    projectName: next.projectName || data.value.projectName,
    visibilityScope: effectiveScope.value,
    lastSummary: next,
  });
};

const refreshDefects = async () => {
  if (isCatalogPreview.value) return;
  if (refreshing.value || needsConfig.value) return;
  refreshing.value = true;
  try {
    const next = await queryTapdDefects({
      widgetId: props.widget.id,
      workspaceId: data.value.workspaceId,
      page: summary.value?.page || 1,
      limit: data.value.query.limit,
      order: data.value.query.order,
      fields: data.value.query.fields,
      visibilityScope: effectiveScope.value,
      currentUser: data.value.query.currentUser,
      filters: buildTapdFilters(data.value.query),
      blockedBugIds: data.value.blockedBugIds,
    });
    applySummary(next);
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "request_failed";
    const keepCached =
      errorCode !== "server_credential_missing" &&
      errorCode !== "current_user_required";
    applySummary({
      status: "error",
      workspaceId: data.value.workspaceId,
      projectName: data.value.projectName,
      total: keepCached ? (summary.value?.total ?? 0) : 0,
      visibleTotal: keepCached ? (summary.value?.visibleTotal ?? 0) : 0,
      blockedTotal: data.value.blockedBugIds.length,
      verificationTotal: keepCached
        ? (summary.value?.verificationTotal ?? 0)
        : 0,
      critical: keepCached ? (summary.value?.critical ?? 0) : 0,
      assignedToCurrentUser: keepCached
        ? (summary.value?.assignedToCurrentUser ?? 0)
        : 0,
      visibleScope: effectiveScope.value,
      page: summary.value?.page ?? 1,
      limit: data.value.query.limit,
      lastSyncedAt: new Date().toISOString(),
      errorCode,
      items: keepCached ? (summary.value?.items ?? []) : [],
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
  if (!needsConfig.value && !isCatalogPreview.value) {
    refreshTimer = setInterval(
      refreshDefects,
      data.value.refreshIntervalMinutes * 60 * 1000,
    );
  }
};

watch(
  () => props.refreshToken,
  (value) => {
    const token = value ?? 0;
    if (token === lastRefreshToken.value) return;
    lastRefreshToken.value = token;
    void refreshDefects();
  },
);

watch(
  () => [
    data.value.workspaceId,
    data.value.hasServerCredential,
    data.value.refreshIntervalMinutes,
    data.value.visibilityScope,
  ],
  resetTimer,
);

onMounted(() => {
  resetTimer();
  void refreshDefects();
});

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<template>
  <span
    class="tapd-defects-widget"
    :class="{ 'is-needs-config': needsConfig }"
    :data-tapd-size="sizeKey"
    :data-tapd-status="
      needsConfig ? 'needs-config' : summary?.status || 'needs-config'
    "
  >
    <span class="tapd-defects-top" v-if="sizeKey !== '1x1'">
      <TapdLogo size="small" />
      <span class="tapd-title">
        <strong>{{ title }}</strong>
        <small>{{ metaLine }}</small>
      </span>
      <span class="tapd-status">{{ statusLabel }}</span>
    </span>

    <span class="tapd-hero">
      <TapdLogo v-if="sizeKey === '1x1' || sizeKey === '2x1'" size="small" />
      <small>待处理</small>
      <strong>{{ visibleTotal }}</strong>
      <span>{{ needsConfig ? "待配置" : scopeText }}</span>
    </span>

    <span class="tapd-metrics" v-if="sizeKey !== '1x1'">
      <span class="tapd-metric tapd-metric--danger">
        <small>重新打开</small>
        <strong>{{ reopenedTotal }}</strong>
      </span>
      <span class="tapd-metric">
        <small>P0/P1</small>
        <strong>{{ criticalTotal }}</strong>
      </span>
    </span>

    <span class="tapd-list" v-if="sizeKey === '2x2' || sizeKey === '2x4'">
      <span v-if="topItems.length === 0" class="tapd-empty">
        {{ needsConfig ? "请配置相关参数" : "当前筛选暂无缺陷" }}
      </span>
      <span v-for="item in topItems" :key="item.id" class="tapd-row">
        <b>{{ item.priorityLabel || item.severity || "--" }}</b>
        <span>{{ item.title }}</span>
        <em>{{ tapdDefectStatusLabel(item.status) }}</em>
      </span>
    </span>
    <span v-if="needsConfig" class="tapd-config-mask"> 请配置相关参数 </span>
  </span>
</template>

<style scoped>
.tapd-defects-widget {
  position: relative;
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

.tapd-config-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  border-radius: inherit;
  background: color-mix(
    in srgb,
    var(--sd-widget-surface-strong) 86%,
    transparent
  );
  color: var(--sd-widget-text-primary);
  padding: 12px;
  text-align: center;
  font-size: 14px;
  font-weight: 900;
  pointer-events: none;
}

.tapd-defects-top {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.tapd-title {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.tapd-title strong,
.tapd-title small,
.tapd-status,
.tapd-row span,
.tapd-row em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tapd-title strong {
  font-size: 14px;
  line-height: 18px;
}

.tapd-title small,
.tapd-hero small,
.tapd-hero span,
.tapd-metric small,
.tapd-row em,
.tapd-empty {
  color: var(--sd-widget-text-secondary);
}

.tapd-status {
  flex: 0 0 auto;
  margin-left: auto;
  border-radius: 999px;
  padding: 4px 8px;
  background: var(--sd-state-success-surface);
  color: var(--sd-state-success);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  min-width: 48px;
  text-align: center;
}

.tapd-defects-widget[data-tapd-status="error"] .tapd-status {
  background: var(--sd-state-danger-surface);
  color: var(--sd-state-danger);
}

.tapd-hero {
  display: grid;
  min-width: 0;
  align-content: center;
  gap: 2px;
}

.tapd-hero strong {
  color: var(--sd-widget-text-primary);
  font-size: 42px;
  font-weight: 900;
  line-height: 0.92;
}

.tapd-hero small,
.tapd-hero span {
  font-size: 12px;
  font-weight: 800;
}

.tapd-metrics {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.tapd-metric {
  display: grid;
  min-width: 0;
  align-content: center;
  gap: 2px;
  border-radius: 12px;
  background: var(--sd-widget-surface-muted);
  padding: 9px 10px;
}

.tapd-metric strong {
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
}

.tapd-metric--danger {
  background: var(--sd-state-danger-surface);
  color: var(--sd-state-danger);
}

.tapd-metric--danger small {
  color: var(--sd-state-danger);
}

.tapd-list {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.tapd-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  min-width: 0;
  gap: 8px;
  border-radius: 12px;
  background: var(--sd-widget-surface-muted);
  padding: 8px 10px;
}

.tapd-row b {
  color: var(--sd-state-danger);
  font-size: 12px;
  font-weight: 900;
}

.tapd-row span {
  font-size: 13px;
  font-weight: 800;
}

.tapd-row em {
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.tapd-empty {
  display: grid;
  place-items: center;
  min-height: 42px;
  border-radius: 12px;
  background: var(--sd-widget-surface-muted);
  font-size: 12px;
  font-weight: 800;
}

.tapd-defects-widget[data-tapd-size="1x1"] {
  place-items: center;
  padding: 6px;
  text-align: center;
}

.tapd-defects-widget[data-tapd-size="1x1"] .tapd-hero {
  justify-items: center;
  align-content: center;
  gap: 0;
}

.tapd-defects-widget[data-tapd-size="1x1"] .tapd-hero span {
  display: none;
}

.tapd-defects-widget[data-tapd-size="1x1"] .tapd-logo {
  width: 28px;
  height: 16px;
  border-radius: 6px;
}

.tapd-defects-widget[data-tapd-size="1x1"] .tapd-hero strong {
  font-size: 23px;
}

.tapd-defects-widget[data-tapd-size="1x1"] .tapd-hero small {
  font-size: 10px;
}

.tapd-defects-widget[data-tapd-size="1x2"] {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  padding: 6px;
}

.tapd-defects-widget[data-tapd-size="1x2"] .tapd-defects-top,
.tapd-defects-widget[data-tapd-size="1x2"] .tapd-list {
  display: none;
}

.tapd-defects-widget[data-tapd-size="1x2"] .tapd-hero span {
  display: none;
}

.tapd-defects-widget[data-tapd-size="1x2"] .tapd-hero,
.tapd-defects-widget[data-tapd-size="1x2"] .tapd-metric {
  border-radius: 12px;
  background: var(--sd-widget-surface-muted);
  padding: 4px;
}

.tapd-defects-widget[data-tapd-size="1x2"] .tapd-metrics {
  display: contents;
}

.tapd-defects-widget[data-tapd-size="1x2"] .tapd-hero strong,
.tapd-defects-widget[data-tapd-size="1x2"] .tapd-metric strong {
  font-size: 21px;
}

.tapd-defects-widget[data-tapd-size="1x2"] .tapd-hero small,
.tapd-defects-widget[data-tapd-size="1x2"] .tapd-metric small {
  font-size: 10px;
}

.tapd-defects-widget[data-tapd-size="2x1"] {
  grid-template-columns: 1fr;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 6px;
  padding: 7px;
}

.tapd-defects-widget[data-tapd-size="2x1"] .tapd-defects-top,
.tapd-defects-widget[data-tapd-size="2x1"] .tapd-list {
  display: none;
}

.tapd-defects-widget[data-tapd-size="2x1"] .tapd-hero {
  justify-items: center;
  text-align: center;
}

.tapd-defects-widget[data-tapd-size="2x1"] .tapd-hero span {
  display: none;
}

.tapd-defects-widget[data-tapd-size="2x1"] .tapd-logo {
  width: 34px;
  height: 20px;
  border-radius: 7px;
}

.tapd-defects-widget[data-tapd-size="2x1"] .tapd-hero strong {
  font-size: 32px;
}

.tapd-defects-widget[data-tapd-size="2x1"] .tapd-hero small {
  font-size: 11px;
}

.tapd-defects-widget[data-tapd-size="2x1"] .tapd-metrics {
  grid-template-columns: 1fr;
  gap: 4px;
}

.tapd-defects-widget[data-tapd-size="2x1"] .tapd-metric {
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: 4px 6px;
  border-radius: 9px;
}

.tapd-defects-widget[data-tapd-size="2x1"] .tapd-metric strong {
  font-size: 13px;
}

.tapd-defects-widget[data-tapd-size="2x1"] .tapd-metric small {
  font-size: 10px;
}

.tapd-defects-widget[data-tapd-size="2x2"] {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto 42px minmax(0, 1fr);
  gap: 6px 8px;
  padding: 8px;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-defects-top {
  grid-column: 1 / -1;
  gap: 6px;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-logo {
  width: 28px;
  height: 20px;
  border-radius: 7px;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-title strong {
  font-size: 13px;
  line-height: 15px;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-title small {
  font-size: 10px;
  line-height: 12px;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-status {
  display: none;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-hero {
  grid-column: 1;
  grid-row: 2;
  border-radius: 14px;
  background: var(--sd-state-danger-surface);
  padding: 4px 7px;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-hero span {
  display: none;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-hero strong {
  font-size: 22px;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-hero strong {
  color: var(--sd-state-danger);
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-metrics {
  grid-column: 2;
  grid-row: 2;
  grid-template-columns: 1fr;
  gap: 3px;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-metric {
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: 2px 6px;
  border-radius: 10px;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-metric strong {
  font-size: 13px;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-metric small {
  font-size: 10px;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-list {
  grid-column: 1 / -1;
  grid-row: 3;
  gap: 4px;
  overflow: hidden;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-row {
  grid-template-columns: 30px minmax(0, 1fr) auto;
  gap: 5px;
  min-height: 20px;
  padding: 2px 6px;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-row b {
  font-size: 11px;
}

.tapd-defects-widget[data-tapd-size="2x2"] .tapd-row span,
.tapd-defects-widget[data-tapd-size="2x2"] .tapd-row em {
  font-size: 10px;
}

.tapd-defects-widget[data-tapd-size="2x4"] {
  grid-template-columns: 0.72fr 1.88fr;
  grid-template-rows: auto 34px minmax(0, 1fr);
  gap: 5px 12px;
  padding: 10px;
}

.tapd-defects-widget[data-tapd-size="2x4"] .tapd-defects-top {
  grid-column: 1 / -1;
}

.tapd-defects-widget[data-tapd-size="2x4"] .tapd-hero {
  grid-column: 1;
  grid-row: 2;
  align-self: stretch;
  border-radius: 12px;
  background: var(--sd-widget-surface-muted);
  padding: 4px 8px;
}

.tapd-defects-widget[data-tapd-size="2x4"] .tapd-hero span {
  display: none;
}

.tapd-defects-widget[data-tapd-size="2x4"] .tapd-hero strong {
  font-size: 22px;
}

.tapd-defects-widget[data-tapd-size="2x4"] .tapd-hero,
.tapd-defects-widget[data-tapd-size="2x4"] .tapd-metrics {
  min-width: 0;
}

.tapd-defects-widget[data-tapd-size="2x4"] .tapd-metrics {
  grid-column: 1;
  grid-row: 3;
  grid-template-columns: 1fr;
  align-self: stretch;
  gap: 4px;
}

.tapd-defects-widget[data-tapd-size="2x4"] .tapd-metric {
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: 3px 8px;
  border-radius: 10px;
}

.tapd-defects-widget[data-tapd-size="2x4"] .tapd-metric strong {
  font-size: 14px;
}

.tapd-defects-widget[data-tapd-size="2x4"] .tapd-metric small {
  font-size: 10px;
}

.tapd-defects-widget[data-tapd-size="2x4"] .tapd-list {
  grid-column: 2;
  grid-row: 2 / 4;
  align-content: start;
  gap: 4px;
  overflow: hidden;
}

.tapd-defects-widget[data-tapd-size="2x4"] .tapd-row {
  grid-template-columns: 38px minmax(0, 1fr) auto;
  gap: 5px;
  min-height: 24px;
  padding: 4px 8px;
}

.tapd-defects-widget[data-tapd-size="2x4"] .tapd-row span,
.tapd-defects-widget[data-tapd-size="2x4"] .tapd-row em {
  font-size: 11px;
}
</style>
