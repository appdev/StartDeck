<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from "@lucide/vue";
import { useRequireLogin } from "@/composables/useRequireLogin";
import {
  deleteTapdServerCredential,
  getTapdCredentialStatus,
  resolveTapdWorkspace,
  saveTapdServerCredential,
} from "./tapdDefectApi";
import {
  normalizeTapdDefectWidgetData,
  resolveTapdDisplayName,
  scopeLabel,
} from "./tapdDefectModel";
import {
  TAPD_ACTIONABLE_DEFECT_STATUS,
  TAPD_ACTIONABLE_DEFECT_STATUS_LABEL,
} from "./tapdDefectTypes";
import type {
  TapdBlockedBugSnapshot,
  TapdConfigSaveOptions,
  TapdCredentialType,
  TapdDefectWidgetData,
} from "./tapdDefectTypes";
import TapdLogo from "./TapdLogo.vue";

const props = defineProps<{
  data: TapdDefectWidgetData;
  widgetId: string;
}>();

const emit = defineEmits<{
  close: [];
  save: [data: TapdDefectWidgetData, options?: TapdConfigSaveOptions];
}>();

const limitOptions = [30, 50, 100, 200] as const;
const { requireLogin } = useRequireLogin();
const requireTapdMutation = () => requireLogin("请先登录后再配置 TAPD 组件。");
const hasInitialCredential = props.data.hasServerCredential === true;

const editor = reactive({
  workspaceId: hasInitialCredential ? props.data.workspaceId : "",
  displayName: hasInitialCredential ? props.data.displayName || "" : "",
  projectName: hasInitialCredential ? props.data.projectName || "" : "",
  currentUser: hasInitialCredential ? props.data.query.currentUser || "" : "",
  visibilityScope: "owned-by-current-user" as const,
  limit: props.data.query.limit,
  order: props.data.query.order,
  fields: props.data.query.fields.join(","),
  severity: props.data.query.severity || "",
  priorityLabel: props.data.query.priorityLabel || "",
  iterationId: props.data.query.iterationId || "",
  label: props.data.query.label || "",
  module: props.data.query.module || "",
  versionReport: props.data.query.versionReport || "",
  source: props.data.query.source || "",
  bugtype: props.data.query.bugtype || "",
  refreshIntervalMinutes: props.data.refreshIntervalMinutes,
  credentialType: props.data.credentialType || ("basic" as TapdCredentialType),
  apiUser: "",
  apiPassword: "",
  accessToken: "",
  serverStorageAcknowledged: false,
});
const hasServerCredential = ref(props.data.hasServerCredential === true);
const credentialAccountHint = ref(props.data.credentialAccountHint || "");
const message = ref("");
const busy = ref(false);
const blockedSearch = ref("");
const showDeleteConfirm = ref(false);

const blockedRows = computed(() => {
  const keyword = blockedSearch.value.trim().toLowerCase();
  const snapshotsById = new Map(
    props.data.blockedBugSnapshots.map((item) => [item.id, item]),
  );
  return props.data.blockedBugIds
    .map(
      (id): TapdBlockedBugSnapshot =>
        snapshotsById.get(id) || {
          id,
          title: `缺陷 ${id}`,
        },
    )
    .filter((item) => {
      if (!keyword) return true;
      return (
        item.id.toLowerCase().includes(keyword) ||
        item.title.toLowerCase().includes(keyword)
      );
    });
});

const previewTitle = computed(() => {
  if (!hasServerCredential.value) return "TAPD 缺陷";
  return resolveTapdDisplayName(
    normalizeTapdDefectWidgetData({
      ...props.data,
      workspaceId: editor.workspaceId,
      projectName: editor.projectName,
      displayName: editor.displayName,
    }),
  );
});

const clearCredentialDependentEditor = () => {
  editor.workspaceId = "";
  editor.displayName = "";
  editor.projectName = "";
  editor.currentUser = "";
  editor.apiUser = "";
  editor.apiPassword = "";
  editor.accessToken = "";
};

const syncCredentialStatus = async () => {
  try {
    const status = await getTapdCredentialStatus(props.widgetId);
    hasServerCredential.value = status.hasServerCredential;
    credentialAccountHint.value = status.accountHint || "";
    if (status.credentialType) editor.credentialType = status.credentialType;
    if (!status.hasServerCredential && !props.data.hasServerCredential) {
      clearCredentialDependentEditor();
    }
  } catch {
    hasServerCredential.value = false;
    credentialAccountHint.value = "";
    if (!props.data.hasServerCredential) {
      clearCredentialDependentEditor();
    }
  }
};

const hasCredentialDraft = () =>
  editor.credentialType === "basic"
    ? Boolean(editor.apiUser.trim() && editor.apiPassword.trim())
    : Boolean(editor.accessToken.trim());

const saveCredentialIfNeeded = async () => {
  if (!hasCredentialDraft()) return false;
  if (!editor.serverStorageAcknowledged) {
    throw new Error("请先确认服务端保存凭据");
  }
  const status = await saveTapdServerCredential(props.widgetId, {
    credentialType: editor.credentialType,
    apiUser: editor.credentialType === "basic" ? editor.apiUser : undefined,
    apiPassword:
      editor.credentialType === "basic" ? editor.apiPassword : undefined,
    accessToken:
      editor.credentialType === "bearer" ? editor.accessToken : undefined,
    serverStorageAcknowledged: true,
  });
  hasServerCredential.value = status.hasServerCredential;
  credentialAccountHint.value = status.accountHint || "";
  editor.apiPassword = "";
  editor.accessToken = "";
  return status.hasServerCredential;
};

const resolveWorkspaceName = async () => {
  if (!requireTapdMutation()) return;
  if (!editor.workspaceId.trim()) {
    message.value = "请先填写项目 ID";
    return;
  }
  busy.value = true;
  message.value = "正在读取项目名称";
  try {
    if (!hasServerCredential.value) {
      const saved = await saveCredentialIfNeeded();
      if (!saved) {
        message.value = "请先保存 TAPD 服务端凭据";
        return;
      }
      message.value = "凭据已保存，正在读取项目名称";
    }
    const response = await resolveTapdWorkspace(
      props.widgetId,
      editor.workspaceId.trim(),
    );
    if (response.status === "connected" && response.projectName) {
      editor.projectName = response.projectName;
      message.value = "项目名称已更新";
      return;
    }
    message.value = response.errorCode || "项目名称读取失败";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "项目名称读取失败";
  } finally {
    busy.value = false;
  }
};

const requestRemoveCredential = () => {
  if (!requireTapdMutation()) return;
  showDeleteConfirm.value = true;
  message.value = "";
};

const buildDisconnectedData = (): TapdDefectWidgetData => {
  const next = buildData();
  return normalizeTapdDefectWidgetData({
    ...next,
    workspaceId: "",
    projectName: "",
    displayName: undefined,
    hasServerCredential: false,
    credentialType: undefined,
    credentialAccountHint: undefined,
    query: {
      ...next.query,
      currentUser: undefined,
    },
    lastSummary: undefined,
  });
};

const removeCredential = async () => {
  busy.value = true;
  message.value = "";
  try {
    await deleteTapdServerCredential(props.widgetId);
    hasServerCredential.value = false;
    credentialAccountHint.value = "";
    editor.serverStorageAcknowledged = false;
    clearCredentialDependentEditor();
    showDeleteConfirm.value = false;
    emit("save", buildDisconnectedData());
  } catch (error) {
    message.value = error instanceof Error ? error.message : "删除失败";
    showDeleteConfirm.value = false;
  } finally {
    busy.value = false;
  }
};

const buildData = (): TapdDefectWidgetData =>
  normalizeTapdDefectWidgetData({
    ...props.data,
    workspaceId: editor.workspaceId,
    projectName: editor.projectName,
    displayName: editor.displayName,
    visibilityScope: "owned-by-current-user",
    refreshIntervalMinutes: editor.refreshIntervalMinutes,
    hasServerCredential: hasServerCredential.value,
    credentialType: hasServerCredential.value
      ? editor.credentialType
      : undefined,
    credentialAccountHint: credentialAccountHint.value || undefined,
    query: {
      ...props.data.query,
      limit: editor.limit,
      order: editor.order,
      fields: editor.fields
        .split(",")
        .map((field) => field.trim())
        .filter(Boolean),
      currentUser: editor.currentUser,
      status: TAPD_ACTIONABLE_DEFECT_STATUS,
      vStatus: undefined,
      severity: editor.severity,
      priorityLabel: editor.priorityLabel,
      iterationId: editor.iterationId,
      label: editor.label,
      module: editor.module,
      versionReport: editor.versionReport,
      source: editor.source,
      bugtype: editor.bugtype,
    },
  });

const saveConfig = async () => {
  if (!requireTapdMutation()) return;
  busy.value = true;
  message.value = "";
  try {
    await saveCredentialIfNeeded();
    emit("save", buildData());
    message.value = "配置已保存";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "保存失败";
  } finally {
    busy.value = false;
  }
};

const restoreBlocked = (id: string) => {
  if (!requireTapdMutation()) return;
  const next = buildData();
  next.blockedBugIds = next.blockedBugIds.filter((item) => item !== id);
  next.blockedBugSnapshots = next.blockedBugSnapshots.filter(
    (item) => item.id !== id,
  );
  if (next.lastSummary) {
    next.lastSummary = {
      ...next.lastSummary,
      blockedTotal: next.blockedBugIds.length,
    };
  }
  emit("save", normalizeTapdDefectWidgetData(next), { close: false });
  message.value = "已恢复屏蔽缺陷";
};

watch(
  () => props.data,
  () => {
    hasServerCredential.value = props.data.hasServerCredential === true;
    credentialAccountHint.value = props.data.credentialAccountHint || "";
  },
);

onMounted(() => {
  void syncCredentialStatus();
});
</script>

<template>
  <div class="tapd-config-backdrop" @click.self="emit('close')">
    <section
      class="tapd-config-dialog"
      role="dialog"
      aria-label="TAPD 缺陷参数"
    >
      <header class="tapd-config-header">
        <TapdLogo />
        <div>
          <h3>TAPD 缺陷参数</h3>
          <p>{{ previewTitle }} · {{ scopeLabel(editor.visibilityScope) }}</p>
        </div>
        <button type="button" class="tapd-icon-button" @click="emit('close')">
          <X :size="17" />
        </button>
      </header>

      <div class="tapd-config-body">
        <section class="tapd-config-section">
          <h4>连接</h4>
          <div class="tapd-form-grid">
            <label>
              <span>服务端凭据</span>
              <strong :class="{ 'is-ready': hasServerCredential }">
                {{ hasServerCredential ? "已保存" : "未保存" }}
              </strong>
            </label>
            <label>
              <span>项目 ID</span>
              <input v-model="editor.workspaceId" placeholder="workspace_id" />
            </label>
            <label>
              <span>展示名</span>
              <input v-model="editor.displayName" placeholder="可选" />
            </label>
            <label>
              <span>项目名称</span>
              <input v-model="editor.projectName" placeholder="从 TAPD 读取" />
            </label>
            <label>
              <span>当前账号</span>
              <input v-model="editor.currentUser" placeholder="TAPD 用户名" />
            </label>
            <label>
              <span>处理范围</span>
              <strong>当前处理人</strong>
            </label>
          </div>
          <p class="tapd-hint">
            仅查询当前账号相关缺陷；Bearer Token 会优先尝试从 TAPD
            用户态接口自动识别账号，Basic Auth 可在这里填写 TAPD 用户名。
          </p>

          <div class="tapd-credential-grid">
            <label>
              <span>凭据类型</span>
              <select v-model="editor.credentialType">
                <option value="basic">Basic Auth</option>
                <option value="bearer">Bearer Token</option>
              </select>
            </label>
            <label v-if="editor.credentialType === 'basic'">
              <span>API User</span>
              <input v-model="editor.apiUser" autocomplete="off" />
            </label>
            <label v-if="editor.credentialType === 'basic'">
              <span>API Password</span>
              <input
                v-model="editor.apiPassword"
                type="password"
                autocomplete="new-password"
              />
            </label>
            <label v-else>
              <span>Access Token</span>
              <input
                v-model="editor.accessToken"
                type="password"
                autocomplete="new-password"
              />
            </label>
          </div>
          <label class="tapd-checkbox">
            <input v-model="editor.serverStorageAcknowledged" type="checkbox" />
            <span>确认保存到服务端加密存储</span>
          </label>
          <div class="tapd-config-actions">
            <button type="button" @click="resolveWorkspaceName">
              <CheckCircle2 :size="16" />
              读取项目名
            </button>
            <button
              type="button"
              class="danger"
              @click="requestRemoveCredential"
            >
              <Trash2 :size="16" />
              删除凭据
            </button>
          </div>
          <p v-if="credentialAccountHint" class="tapd-hint">
            凭据账号：{{ credentialAccountHint }}
          </p>
        </section>

        <section class="tapd-config-section">
          <h4>查询参数</h4>
          <div class="tapd-form-grid">
            <label>
              <span>每页数量</span>
              <select v-model.number="editor.limit">
                <option
                  v-for="limit in limitOptions"
                  :key="limit"
                  :value="limit"
                >
                  {{ limit }}
                </option>
              </select>
            </label>
            <label>
              <span>排序</span>
              <input v-model="editor.order" />
            </label>
            <label class="wide">
              <span>字段</span>
              <input v-model="editor.fields" />
            </label>
            <label>
              <span>刷新间隔（分钟）</span>
              <input
                v-model.number="editor.refreshIntervalMinutes"
                type="number"
                min="1"
                max="1440"
              />
            </label>
          </div>
        </section>

        <section class="tapd-config-section">
          <h4>筛选参数</h4>
          <div class="tapd-form-grid">
            <label class="wide tapd-fixed-status">
              <span>展示状态</span>
              <strong>{{ TAPD_ACTIONABLE_DEFECT_STATUS_LABEL }}</strong>
              <small>
                固定只显示当前用户需要处理的缺陷；已解决、已验证、已关闭、延期不会展示。
              </small>
            </label>
            <label>
              <span>严重程度</span>
              <input v-model="editor.severity" placeholder="severity" />
            </label>
            <label>
              <span>优先级</span>
              <input
                v-model="editor.priorityLabel"
                placeholder="priority_label"
              />
            </label>
            <label>
              <span>迭代</span>
              <input v-model="editor.iterationId" placeholder="iteration_id" />
            </label>
            <label>
              <span>重点关注标签</span>
              <input v-model="editor.label" placeholder="label" />
            </label>
            <label>
              <span>模块</span>
              <input v-model="editor.module" placeholder="module" />
            </label>
            <label>
              <span>版本</span>
              <input
                v-model="editor.versionReport"
                placeholder="version_report"
              />
            </label>
            <label>
              <span>来源</span>
              <input v-model="editor.source" placeholder="source" />
            </label>
            <label>
              <span>类型</span>
              <input v-model="editor.bugtype" placeholder="bugtype" />
            </label>
          </div>
        </section>

        <section class="tapd-config-section">
          <h4>屏蔽列表</h4>
          <div class="tapd-blocked-tools">
            <span>{{ data.blockedBugIds.length }} 条</span>
            <label>
              <Search :size="15" />
              <input v-model="blockedSearch" placeholder="搜索 ID 或标题" />
            </label>
          </div>
          <div class="tapd-blocked-list" data-testid="tapd-blocked-list">
            <p v-if="blockedRows.length === 0">暂无匹配结果</p>
            <div
              v-for="item in blockedRows"
              :key="item.id"
              class="tapd-blocked-row"
            >
              <strong>{{ item.id }}</strong>
              <span>{{ item.title }}</span>
              <button type="button" @click="restoreBlocked(item.id)">
                <RotateCcw :size="15" />
                恢复
              </button>
            </div>
          </div>
        </section>
      </div>

      <footer class="tapd-config-footer">
        <p>{{ message }}</p>
        <button type="button" :disabled="busy" @click="saveConfig">
          <Save :size="16" />
          保存配置
        </button>
      </footer>

      <div
        v-if="showDeleteConfirm"
        class="tapd-confirm-backdrop"
        role="alertdialog"
        aria-label="确认删除 TAPD 凭据"
      >
        <section class="tapd-confirm-dialog">
          <AlertTriangle :size="22" />
          <div>
            <h4>确认删除 TAPD 凭据？</h4>
            <p>
              删除后会立即清空当前组件的 TAPD
              连接信息并关闭配置页，组件会回到待配置状态。
            </p>
          </div>
          <div class="tapd-confirm-actions">
            <button
              type="button"
              :disabled="busy"
              @click="showDeleteConfirm = false"
            >
              取消
            </button>
            <button
              type="button"
              class="danger"
              :disabled="busy"
              @click="removeCredential"
            >
              确认删除
            </button>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
.tapd-config-backdrop {
  position: absolute;
  inset: 0;
  z-index: 12;
  display: grid;
  place-items: center;
  background: var(--sd-shell-overlay);
  backdrop-filter: blur(10px);
}

.tapd-config-dialog {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(920px, calc(100% - 42px));
  height: min(640px, calc(100% - 42px));
  overflow: hidden;
  border: 1px solid var(--sd-component-border);
  border-radius: 18px;
  background: var(--sd-component-surface);
  color: var(--sd-component-text-primary);
  box-shadow: var(--sd-shadow-window);
}

.tapd-config-header,
.tapd-config-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  border-color: var(--sd-component-border);
  padding: 14px 18px;
}

.tapd-config-header {
  border-bottom: 1px solid var(--sd-component-border);
}

.tapd-config-footer {
  border-top: 1px solid var(--sd-component-border);
}

.tapd-config-header h3,
.tapd-config-header p,
.tapd-config-footer p {
  margin: 0;
}

.tapd-config-header h3 {
  font-size: 17px;
  font-weight: 900;
}

.tapd-config-header p,
.tapd-config-footer p,
.tapd-hint {
  color: var(--sd-component-text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.tapd-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin-left: auto;
  border: 1px solid var(--sd-component-border);
  border-radius: 10px;
  background: var(--sd-component-surface-muted);
  color: var(--sd-component-text-primary);
}

.tapd-config-body {
  display: grid;
  gap: 14px;
  overflow: auto;
  padding: 16px 18px;
}

.tapd-config-section {
  display: grid;
  gap: 12px;
  border: 1px solid var(--sd-component-border);
  border-radius: 14px;
  background: color-mix(
    in srgb,
    var(--sd-component-surface-muted) 62%,
    transparent
  );
  padding: 14px;
}

.tapd-config-section h4 {
  margin: 0;
  color: var(--sd-component-text-secondary);
  font-size: 13px;
  font-weight: 900;
}

.tapd-form-grid,
.tapd-credential-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.tapd-credential-grid {
  grid-template-columns: 180px repeat(2, minmax(0, 1fr));
}

label {
  display: grid;
  min-width: 0;
  gap: 6px;
  color: var(--sd-component-text-secondary);
  font-size: 12px;
  font-weight: 800;
}

label.wide {
  grid-column: 1 / -1;
}

input,
select {
  min-width: 0;
  height: 36px;
  border: 1px solid var(--sd-component-border);
  border-radius: 10px;
  background: var(--sd-component-surface);
  color: var(--sd-component-text-primary);
  padding: 0 10px;
  font: inherit;
  font-size: 13px;
}

strong.is-ready {
  color: var(--sd-state-success);
}

.tapd-fixed-status {
  border: 1px solid var(--sd-component-border);
  border-radius: 12px;
  background: var(--sd-component-surface);
  padding: 10px 12px;
}

.tapd-fixed-status strong {
  color: var(--sd-component-text-primary);
  font-size: 14px;
  line-height: 1.3;
}

.tapd-fixed-status small {
  color: var(--sd-component-text-tertiary);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}

.tapd-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tapd-checkbox input {
  width: 16px;
  height: 16px;
}

.tapd-config-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tapd-config-actions button,
.tapd-config-footer button,
.tapd-blocked-row button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  border: 1px solid var(--sd-component-border);
  border-radius: 10px;
  background: var(--sd-state-info-surface);
  color: var(--sd-state-info);
  padding: 0 12px;
  font-size: 12px;
  font-weight: 900;
}

.tapd-config-actions button.danger {
  background: var(--sd-state-danger-surface);
  color: var(--sd-state-danger);
}

.tapd-config-footer button {
  margin-left: auto;
  background: var(--sd-state-info);
  color: var(--sd-color-text-inverse);
}

.tapd-confirm-backdrop {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--sd-shell-overlay) 72%, transparent);
  backdrop-filter: blur(8px);
  padding: 24px;
}

.tapd-confirm-dialog {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  width: min(420px, 100%);
  border: 1px solid var(--sd-component-border);
  border-radius: 16px;
  background: var(--sd-component-surface);
  color: var(--sd-component-text-primary);
  padding: 18px;
  box-shadow: var(--sd-shadow-window);
}

.tapd-confirm-dialog > svg {
  color: var(--sd-state-danger);
}

.tapd-confirm-dialog h4,
.tapd-confirm-dialog p {
  margin: 0;
}

.tapd-confirm-dialog h4 {
  font-size: 16px;
  font-weight: 900;
}

.tapd-confirm-dialog p {
  margin-top: 6px;
  color: var(--sd-component-text-secondary);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.5;
}

.tapd-confirm-actions {
  display: flex;
  grid-column: 1 / -1;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.tapd-confirm-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 86px;
  height: 34px;
  border: 1px solid var(--sd-component-border);
  border-radius: 10px;
  background: var(--sd-component-surface-muted);
  color: var(--sd-component-text-primary);
  padding: 0 12px;
  font-size: 12px;
  font-weight: 900;
}

.tapd-confirm-actions button.danger {
  background: var(--sd-state-danger-surface);
  color: var(--sd-state-danger);
}

.tapd-blocked-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tapd-blocked-tools > span {
  color: var(--sd-component-text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.tapd-blocked-tools label {
  display: flex;
  flex: 1;
  align-items: center;
  border: 1px solid var(--sd-component-border);
  border-radius: 10px;
  background: var(--sd-component-surface);
  padding: 0 10px;
}

.tapd-blocked-tools input {
  flex: 1;
  border: 0;
  background: transparent;
  padding: 0;
}

.tapd-blocked-list {
  display: grid;
  max-height: 176px;
  min-height: 104px;
  gap: 8px;
  overflow: auto;
}

.tapd-blocked-list p {
  margin: 0;
  color: var(--sd-component-text-tertiary);
  font-size: 12px;
  font-weight: 800;
}

.tapd-blocked-row {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) auto;
  align-items: center;
  min-width: 0;
  gap: 10px;
  border-radius: 11px;
  background: var(--sd-component-surface);
  padding: 8px 10px;
}

.tapd-blocked-row strong,
.tapd-blocked-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tapd-blocked-row span {
  font-size: 13px;
  font-weight: 800;
}

@media (max-width: 760px) {
  .tapd-config-dialog {
    width: calc(100% - 24px);
    height: calc(100% - 24px);
  }

  .tapd-form-grid,
  .tapd-credential-grid {
    grid-template-columns: 1fr;
  }
}
</style>
