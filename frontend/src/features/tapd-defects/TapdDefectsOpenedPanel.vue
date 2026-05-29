<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  EyeOff,
  RefreshCw,
  Settings,
} from "@lucide/vue";
import type { WidgetConfig } from "@/types";
import { useAuthStore } from "@/stores/auth";
import { useRequireLogin } from "@/composables/useRequireLogin";
import { queryTapdDefects } from "./tapdDefectApi";
import {
  buildTapdFilters,
  hasTapdDefectConnection,
  isTapdReopenedStatus,
  normalizeTapdDefectWidgetData,
  resolveTapdDisplayName,
  scopeLabel,
  tapdDefectStatusLabel,
  tapdErrorMessage,
} from "./tapdDefectModel";
import type {
  TapdConfigSaveOptions,
  TapdDefectListItem,
  TapdDefectSummary,
  TapdDefectVisibilityScope,
  TapdDefectWidgetData,
} from "./tapdDefectTypes";
import TapdDefectsConfigDialog from "./TapdDefectsConfigDialog.vue";
import TapdLogo from "./TapdLogo.vue";

const props = defineProps<{
  widget: WidgetConfig;
}>();

const emit = defineEmits<{
  close: [];
  updateData: [data: TapdDefectWidgetData];
}>();

const page = ref(1);
const busy = ref(false);
const message = ref("");
const showConfig = ref(false);
const auth = useAuthStore();
const { requireLogin } = useRequireLogin();
const requireTapdMutation = () => requireLogin("请先登录后再配置 TAPD 组件。");

const data = computed(() => normalizeTapdDefectWidgetData(props.widget.data));
const activeScope = computed<TapdDefectVisibilityScope>(
  () => data.value.visibilityScope,
);
const summary = computed(() => data.value.lastSummary);
const needsConfig = computed(() => !hasTapdDefectConnection(data.value));
const title = computed(() =>
  needsConfig.value ? "TAPD 缺陷" : resolveTapdDisplayName(data.value),
);
const currentItems = computed(() =>
  needsConfig.value ? [] : (summary.value?.items ?? []),
);
const tableTitle = computed(() =>
  needsConfig.value ? "请配置相关参数" : "当前账号待处理缺陷",
);

const visibleStatusRows = computed(() => {
  const rows = new Map<string, number>();
  for (const item of currentItems.value) {
    const label = tapdDefectStatusLabel(item.status);
    rows.set(label, (rows.get(label) || 0) + 1);
  }
  return [...rows.entries()].slice(0, 6);
});
const reopenedTotal = computed(
  () =>
    currentItems.value.filter((item) => isTapdReopenedStatus(item.status))
      .length,
);
const canGoPreviousPage = computed(() => !needsConfig.value && page.value > 1);
const canGoNextPage = computed(() => {
  if (needsConfig.value) return false;
  const visibleTotal = summary.value?.visibleTotal ?? 0;
  const limit = data.value.query.limit;
  return visibleTotal > page.value * limit;
});

const subtitle = computed(() => {
  if (needsConfig.value) return "请配置相关参数";
  const parts = [scopeLabel(activeScope.value)];
  if (data.value.query.currentUser) parts.push("当前账号");
  return parts.join(" · ");
});

const persistData = (next: TapdDefectWidgetData) => {
  if (!requireTapdMutation()) return false;
  emit("updateData", normalizeTapdDefectWidgetData(next));
  return true;
};

const applySummary = (
  next: TapdDefectSummary,
  base: TapdDefectWidgetData = data.value,
) => {
  return persistData({
    ...base,
    projectName: next.projectName || base.projectName,
    visibilityScope: base.visibilityScope,
    lastSummary: next,
  });
};

const refreshDefects = async (
  nextPage = page.value,
  options: { notifyAuth?: boolean } = {},
  sourceData?: TapdDefectWidgetData,
) => {
  const requestData = sourceData
    ? normalizeTapdDefectWidgetData(sourceData)
    : data.value;
  const requestScope = requestData.visibilityScope;
  const requestNeedsConfig = !hasTapdDefectConnection(requestData);
  if (!auth.isLogged) {
    if (options.notifyAuth !== false) requireTapdMutation();
    return;
  }
  if (busy.value || requestNeedsConfig) {
    if (requestNeedsConfig) message.value = "请先配置 TAPD 连接参数";
    return;
  }
  busy.value = true;
  message.value = "正在同步";
  try {
    const next = await queryTapdDefects({
      widgetId: props.widget.id,
      workspaceId: requestData.workspaceId,
      page: nextPage,
      limit: requestData.query.limit,
      order: requestData.query.order,
      fields: requestData.query.fields,
      visibilityScope: requestScope,
      currentUser: requestData.query.currentUser,
      filters: buildTapdFilters(requestData.query),
      blockedBugIds: requestData.blockedBugIds,
    });
    page.value = next.page;
    applySummary(next, requestData);
    message.value =
      next.status === "connected"
        ? `已同步 ${next.visibleTotal} 条待处理结果`
        : tapdErrorMessage(next.errorCode);
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "request_failed";
    message.value = tapdErrorMessage(errorCode);
    if (
      errorCode === "server_credential_missing" ||
      errorCode === "current_user_required"
    ) {
      applySummary(
        {
          status: "error",
          workspaceId: requestData.workspaceId,
          projectName: requestNeedsConfig ? undefined : requestData.projectName,
          total: 0,
          visibleTotal: 0,
          blockedTotal: requestData.blockedBugIds.length,
          verificationTotal: 0,
          critical: 0,
          assignedToCurrentUser: 0,
          visibleScope: requestScope,
          page: nextPage,
          limit: requestData.query.limit,
          lastSyncedAt: new Date().toISOString(),
          errorCode,
          items: [],
        },
        requestData,
      );
    }
  } finally {
    busy.value = false;
  }
};

const severityLabel = (item: TapdDefectListItem) =>
  item.priorityLabel || item.severity || "--";

const severityTone = (item: TapdDefectListItem) => {
  const value = severityLabel(item).trim().toLowerCase();
  if (
    value.includes("高") ||
    value.includes("严重") ||
    value === "p0" ||
    value === "p1" ||
    value === "high" ||
    value === "critical" ||
    value === "blocker"
  ) {
    return "high";
  }
  if (
    value.includes("中") ||
    value === "p2" ||
    value === "medium" ||
    value === "normal"
  ) {
    return "medium";
  }
  if (
    value.includes("低") ||
    value === "p3" ||
    value === "p4" ||
    value === "low" ||
    value === "minor"
  ) {
    return "low";
  }
  return "neutral";
};

const blockDefect = (item: TapdDefectListItem) => {
  if (!requireTapdMutation()) return;
  const ids = new Set(data.value.blockedBugIds);
  ids.add(item.id);
  const snapshots = [
    ...data.value.blockedBugSnapshots.filter((entry) => entry.id !== item.id),
    {
      id: item.id,
      title: item.title,
      blockedAt: new Date().toISOString(),
    },
  ];
  const nextItems = currentItems.value.filter((entry) => entry.id !== item.id);
  persistData({
    ...data.value,
    blockedBugIds: [...ids],
    blockedBugSnapshots: snapshots,
    lastSummary: summary.value
      ? {
          ...summary.value,
          visibleTotal: Math.max(0, summary.value.visibleTotal - 1),
          blockedTotal: ids.size,
          items: nextItems,
        }
      : summary.value,
  });
};

const openDefect = (item: TapdDefectListItem) => {
  if (!item.url) return;
  window.open(item.url, "_blank", "noopener,noreferrer");
};

const openTapdWorkspace = () => {
  if (needsConfig.value || !data.value.workspaceId) return;
  window.open(
    `${data.value.tapdBaseUrl.replace(/\/$/, "")}/${data.value.workspaceId}/bugtrace/bugs`,
    "_blank",
    "noopener,noreferrer",
  );
};

const saveConfig = (
  next: TapdDefectWidgetData,
  options?: TapdConfigSaveOptions,
) => {
  const normalizedNext = normalizeTapdDefectWidgetData(next);
  if (!persistData(normalizedNext)) return;
  if (options?.close !== false) {
    showConfig.value = false;
    if (hasTapdDefectConnection(normalizedNext)) {
      page.value = 1;
      void refreshDefects(1, { notifyAuth: false }, normalizedNext);
    }
  }
};

const openConfig = () => {
  if (!requireTapdMutation()) return;
  showConfig.value = true;
};

onMounted(() => {
  if (auth.isLogged) void refreshDefects(page.value, { notifyAuth: false });
});
</script>

<template>
  <div class="tapd-opened-panel">
    <header class="tapd-opened-header">
      <TapdLogo size="large" />
      <div class="tapd-heading">
        <h2>{{ title }}</h2>
        <p>{{ subtitle }}</p>
      </div>
      <div class="tapd-header-actions">
        <button type="button" @click.stop="openConfig">
          <Settings :size="17" />
          配置参数
        </button>
        <button type="button" @click.stop="refreshDefects(page)">
          <RefreshCw :size="17" />
          刷新
        </button>
        <button
          type="button"
          :disabled="needsConfig"
          @click.stop="openTapdWorkspace"
        >
          <ExternalLink :size="17" />
          打开 TAPD
        </button>
      </div>
    </header>

    <main class="tapd-opened-body">
      <section class="tapd-defect-table">
        <div class="tapd-table-title">
          <h3>{{ tableTitle }}</h3>
          <span>{{ message }}</span>
        </div>
        <div class="tapd-table-head">
          <span>级别</span>
          <span>标题</span>
          <span>状态</span>
          <span>操作</span>
        </div>
        <div class="tapd-table-body">
          <button
            v-for="item in currentItems"
            :key="item.id"
            type="button"
            class="tapd-table-row"
            @click.stop="openDefect(item)"
          >
            <b class="tapd-severity" :class="`is-${severityTone(item)}`">
              {{ severityLabel(item) }}
            </b>
            <span>{{ item.title }}</span>
            <em>{{ tapdDefectStatusLabel(item.status) }}</em>
            <i @click.stop="blockDefect(item)">
              <EyeOff :size="15" />
              屏蔽
            </i>
          </button>
          <div v-if="currentItems.length === 0" class="tapd-table-empty">
            {{ needsConfig ? "请打开配置参数完成连接" : "当前页暂无缺陷" }}
          </div>
        </div>
        <footer class="tapd-pagination">
          <span>第 {{ page }} 页 · 每页 {{ data.query.limit }}</span>
          <button
            type="button"
            :disabled="!canGoPreviousPage || busy"
            @click.stop="refreshDefects(page - 1)"
          >
            <ChevronLeft :size="16" />
            上一页
          </button>
          <button
            type="button"
            :disabled="!canGoNextPage || busy"
            @click.stop="refreshDefects(page + 1)"
          >
            下一页
            <ChevronRight :size="16" />
          </button>
        </footer>
      </section>

      <aside class="tapd-summary-panel">
        <h3>风险摘要</h3>
        <div class="tapd-summary-card">
          <span>待处理结果</span>
          <strong>{{ needsConfig ? 0 : summary?.visibleTotal || 0 }}</strong>
        </div>
        <div class="tapd-summary-card">
          <span>已屏蔽</span>
          <strong>{{ needsConfig ? 0 : data.blockedBugIds.length }}</strong>
        </div>
        <div class="tapd-summary-card danger">
          <span>重新打开</span>
          <strong>{{ reopenedTotal }}</strong>
        </div>
        <div class="tapd-status-list">
          <h4>状态分布</h4>
          <p v-for="[status, count] in visibleStatusRows" :key="status">
            <span>{{ status }}</span>
            <strong>{{ count }}</strong>
          </p>
        </div>
      </aside>
      <div v-if="needsConfig" class="tapd-opened-mask">请配置相关参数</div>
    </main>

    <TapdDefectsConfigDialog
      v-if="showConfig"
      :data="data"
      :widget-id="widget.id"
      @close="showConfig = false"
      @save="saveConfig"
    />
  </div>
</template>

<style scoped>
.tapd-opened-panel {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--sd-component-surface);
  color: var(--sd-component-text-primary);
}

.tapd-opened-header {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  border-bottom: 1px solid var(--sd-component-border);
  padding: 18px 54px 16px 20px;
}

.tapd-heading {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.tapd-heading h2,
.tapd-heading p {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tapd-heading h2 {
  font-size: 22px;
  font-weight: 900;
  line-height: 1.1;
}

.tapd-heading p {
  color: var(--sd-component-text-secondary);
  font-size: 13px;
  font-weight: 800;
}

.tapd-header-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  margin-left: auto;
}

.tapd-header-actions button,
.tapd-pagination button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  border: 1px solid var(--sd-component-border);
  border-radius: 999px;
  background: var(--sd-component-surface-muted);
  color: var(--sd-component-text-primary);
  padding: 0 13px;
  font-size: 13px;
  font-weight: 900;
}

.tapd-header-actions button:first-child {
  border-color: var(--sd-color-border-accent);
  background: var(--sd-state-info-surface);
  color: var(--sd-state-info);
}

.tapd-header-actions button:disabled,
.tapd-pagination button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.tapd-opened-body {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 204px;
  min-height: 0;
  gap: 14px;
  padding: 16px 20px 20px;
}

.tapd-opened-mask {
  position: absolute;
  inset: 16px 20px 20px;
  z-index: 2;
  display: grid;
  place-items: center;
  border: 1px solid var(--sd-component-border);
  border-radius: 16px;
  background: color-mix(
    in srgb,
    var(--sd-component-surface-muted) 82%,
    transparent
  );
  color: var(--sd-component-text-primary);
  font-size: 16px;
  font-weight: 900;
  pointer-events: none;
}

.tapd-summary-panel,
.tapd-defect-table {
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--sd-component-border);
  border-radius: 16px;
  background: color-mix(
    in srgb,
    var(--sd-component-surface-muted) 54%,
    transparent
  );
}

.tapd-summary-panel {
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 14px;
}

.tapd-summary-panel h3,
.tapd-table-title h3 {
  margin: 0;
  color: var(--sd-component-text-secondary);
  font-size: 14px;
  font-weight: 900;
}

.tapd-defect-table {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  overflow: hidden;
  padding: 14px;
}

.tapd-table-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.tapd-table-title span {
  overflow: hidden;
  color: var(--sd-component-text-secondary);
  font-size: 12px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tapd-table-head,
.tapd-table-row {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 92px 72px;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.tapd-table-head {
  color: var(--sd-component-text-secondary);
  font-size: 12px;
  font-weight: 900;
  padding: 0 12px 8px;
}

.tapd-table-body {
  display: grid;
  align-content: start;
  min-height: 0;
  gap: 8px;
  overflow: auto;
}

.tapd-table-row {
  width: 100%;
  min-height: 56px;
  border: 0;
  border-radius: 13px;
  background: var(--sd-component-surface);
  color: var(--sd-component-text-primary);
  padding: 11px 12px;
  text-align: left;
}

.tapd-severity,
.tapd-table-row span,
.tapd-table-row em,
.tapd-table-row i {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tapd-table-row span {
  font-size: 13px;
  font-weight: 900;
}

.tapd-table-row b {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  min-width: 28px;
  height: 24px;
  border-radius: 8px;
  padding: 0 7px;
  font-size: 13px;
  font-weight: 900;
}

.tapd-severity.is-high {
  background: var(--sd-state-danger-surface);
  color: var(--sd-state-danger);
}

.tapd-severity.is-medium {
  background: var(--sd-state-warning-surface);
  color: var(--sd-state-warning);
}

.tapd-severity.is-low {
  background: var(--sd-state-success-surface);
  color: var(--sd-state-success);
}

.tapd-severity.is-neutral {
  background: var(--sd-component-surface-muted);
  color: var(--sd-component-text-secondary);
}

.tapd-table-row span {
  display: -webkit-box;
  line-height: 1.35;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tapd-table-row em {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  min-width: 50px;
  height: 24px;
  border-radius: 8px;
  background: var(--sd-component-surface-muted);
  color: var(--sd-component-text-secondary);
  padding: 0 7px;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.tapd-table-row i {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--sd-state-danger);
  font-size: 12px;
  font-style: normal;
  font-weight: 900;
}

.tapd-table-empty {
  display: grid;
  min-height: 180px;
  place-items: center;
  color: var(--sd-component-text-secondary);
  font-size: 13px;
  font-weight: 800;
}

.tapd-pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--sd-component-border);
  padding-top: 12px;
}

.tapd-pagination span {
  margin-right: auto;
  color: var(--sd-component-text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.tapd-summary-card {
  display: grid;
  gap: 8px;
  border-radius: 14px;
  background: var(--sd-component-surface);
  padding: 14px;
}

.tapd-summary-card span,
.tapd-status-list h4,
.tapd-status-list p span {
  color: var(--sd-component-text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.tapd-summary-card strong {
  font-size: 30px;
  font-weight: 900;
  line-height: 1;
}

.tapd-summary-card.danger strong {
  color: var(--sd-state-danger);
}

.tapd-status-list {
  display: grid;
  gap: 8px;
  border-radius: 14px;
  background: var(--sd-component-surface);
  padding: 14px;
}

.tapd-status-list h4,
.tapd-status-list p {
  margin: 0;
}

.tapd-status-list p {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

@media (max-width: 980px) {
  .tapd-opened-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .tapd-summary-panel {
    display: none;
  }

  .tapd-table-head,
  .tapd-table-row {
    grid-template-columns: 42px minmax(0, 1fr) 82px;
  }

  .tapd-table-head span:last-child,
  .tapd-table-row i {
    display: none;
  }
}
</style>
