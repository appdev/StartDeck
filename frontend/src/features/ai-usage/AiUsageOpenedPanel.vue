<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import { useAuthStore } from "@/stores/auth";
import { useRequireLogin } from "@/composables/useRequireLogin";
import AiProviderIcon from "./AiProviderIcon.vue";
import { queryAiUsage } from "./aiUsageApi";
import {
  clearBrowserAiUsageCredential,
  loadBrowserAiUsageCredential,
  saveBrowserAiUsageCredential,
} from "./aiUsageCredentialStorage";
import {
  normalizeAiUsageSummary,
  normalizeAiUsageWidgetData,
} from "./aiUsageModel";
import {
  AI_USAGE_PROVIDERS,
  getAiUsageProvider,
  isAiUsageProviderQueryAvailable,
} from "./aiUsageProviders";
import type {
  AiUsageCredentialStorage,
  AiUsageCredentialType,
  AiUsageProviderSummary,
  AiUsageWidgetData,
} from "./aiUsageTypes";

const props = defineProps<{
  widget: WidgetConfig;
}>();

const emit = defineEmits<{
  addData: [data: AiUsageWidgetData];
  close: [];
  updateData: [data: AiUsageWidgetData];
}>();

interface AiUsageEditorState {
  providerId: string;
  displayName: string;
  accountLabel: string;
  credentialStorage: AiUsageCredentialStorage;
  credentialType: AiUsageCredentialType;
  credential: string;
  accountId: string;
  refreshIntervalMinutes: number;
  lastSummary: AiUsageProviderSummary;
}

const auth = useAuthStore();
const { requireLogin } = useRequireLogin();
const requireAiUsageMutation = () =>
  requireLogin("请先登录后再配置 AI 使用量组件。");
const initialData = computed(() =>
  normalizeAiUsageWidgetData(props.widget.data),
);
const editor = reactive<AiUsageEditorState>({
  providerId: initialData.value.providerId,
  displayName: initialData.value.displayName,
  accountLabel: initialData.value.accountLabel || "",
  credentialStorage: initialData.value.credentialStorage,
  credentialType: initialData.value.credentialType || "access_token",
  credential: "",
  accountId: "",
  refreshIntervalMinutes: initialData.value.refreshIntervalMinutes,
  lastSummary: normalizeAiUsageSummary(
    initialData.value.lastSummary,
    initialData.value.providerId,
  ),
});
const busy = ref(false);
const message = ref("");
const selectedProvider = computed(() => getAiUsageProvider(editor.providerId));
const queryAvailable = computed(() =>
  isAiUsageProviderQueryAvailable(editor.providerId),
);

const percentLabel = (value: number | null | undefined) =>
  typeof value === "number" ? `${Math.round(value)}%` : "--";

const barStyle = (value: number | null | undefined) => ({
  width: `${typeof value === "number" ? Math.max(0, Math.min(100, value)) : 0}%`,
});

const sanitizeEditorData = (): AiUsageWidgetData => {
  const provider = getAiUsageProvider(editor.providerId);
  return normalizeAiUsageWidgetData({
    ...initialData.value,
    providerId: provider.id,
    displayName: editor.displayName || provider.defaultDisplayName,
    accountLabel: editor.accountLabel,
    iconKey: provider.iconKey,
    requestMode: "connector",
    credentialStorage: queryAvailable.value ? editor.credentialStorage : "once",
    credentialType: queryAvailable.value ? editor.credentialType : undefined,
    hasServerCredential: false,
    accountIdHint: undefined,
    refreshIntervalMinutes: editor.refreshIntervalMinutes,
    lastSummary: editor.lastSummary,
  });
};

const syncBrowserCredential = () => {
  if (!auth.isLogged) return;
  const stored = loadBrowserAiUsageCredential(
    auth.username || "admin",
    props.widget.id,
    editor.providerId,
  );
  if (!stored) return;
  editor.credentialType = stored.credentialType;
  editor.credential = stored.credential;
  editor.accountId = stored.accountId || "";
};

const syncCredentialDraft = () => {
  editor.credential = "";
  editor.accountId = "";
  if (editor.credentialStorage === "browser") {
    syncBrowserCredential();
  }
};

const setProvider = (providerId: string) => {
  if (!requireAiUsageMutation()) return;
  const provider = getAiUsageProvider(providerId);
  editor.providerId = provider.id;
  editor.displayName = provider.defaultDisplayName;
  editor.accountLabel = "";
  editor.credentialStorage =
    provider.querySupport === "available" ? "browser" : "once";
  editor.credentialType = "access_token";
  editor.credential = "";
  editor.accountId = "";
  editor.lastSummary = normalizeAiUsageSummary({}, provider.id);
  message.value =
    provider.querySupport === "available"
      ? ""
      : "此 provider 的查询适配器将在后续版本接入";
  syncCredentialDraft();
};

const persistCredentialChoice = async () => {
  if (!queryAvailable.value) return;
  const scope = auth.username || "admin";
  if (editor.credentialStorage === "browser") {
    if (editor.credential.trim()) {
      saveBrowserAiUsageCredential(scope, props.widget.id, editor.providerId, {
        credentialType: editor.credentialType,
        credential: editor.credential,
        accountId: editor.accountId.trim() || undefined,
        savedAt: new Date().toISOString(),
      });
    }
  } else {
    clearBrowserAiUsageCredential(scope, props.widget.id, editor.providerId);
  }
};

const saveConfig = async () => {
  if (!requireAiUsageMutation()) return;
  busy.value = true;
  message.value = "";
  try {
    await persistCredentialChoice();
    emit("updateData", sanitizeEditorData());
    message.value = "配置已保存";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "保存失败";
  } finally {
    busy.value = false;
  }
};

const addProviderWidget = () => {
  if (!requireAiUsageMutation()) return;
  emit("addData", sanitizeEditorData());
};

const testConnection = async () => {
  if (!requireAiUsageMutation()) return;
  if (!queryAvailable.value) {
    message.value = "此 provider 的查询适配器待接入";
    return;
  }
  busy.value = true;
  message.value = "正在测试连接";
  try {
    const scope = auth.username || "admin";
    const stored =
      editor.credentialStorage === "browser"
        ? loadBrowserAiUsageCredential(
            scope,
            props.widget.id,
            editor.providerId,
          )
        : null;
    const summary = await queryAiUsage({
      widgetId: props.widget.id,
      providerId: editor.providerId,
      requestMode: "connector",
      credentialStorage: editor.credentialStorage,
      credentialType: stored?.credentialType || editor.credentialType,
      credential: stored?.credential || editor.credential,
      accountId: stored?.accountId || editor.accountId.trim() || undefined,
    });
    editor.lastSummary = normalizeAiUsageSummary(summary, editor.providerId);
    emit("updateData", sanitizeEditorData());
    message.value =
      summary.status === "connected"
        ? "连接成功"
        : summary.errorCode || "连接失败";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "连接失败";
    editor.lastSummary = {
      providerId: editor.providerId,
      status: "error",
      primaryRemainingPercent: editor.lastSummary.primaryRemainingPercent,
      weeklyRemainingPercent: editor.lastSummary.weeklyRemainingPercent,
      lastSyncedAt: new Date().toISOString(),
      errorCode: message.value,
    };
  } finally {
    busy.value = false;
  }
};

watch(
  () => editor.credentialStorage,
  () => {
    syncCredentialDraft();
  },
);

onMounted(() => {
  syncCredentialDraft();
});
</script>

<template>
  <div class="ai-usage-opened scrollbar-glass">
    <aside class="provider-pane" aria-label="选择 provider">
      <p class="pane-title">选择 provider</p>
      <button
        v-for="provider in AI_USAGE_PROVIDERS"
        :key="provider.id"
        class="provider-row"
        :class="{ active: provider.id === editor.providerId }"
        type="button"
        @click="setProvider(provider.id)"
      >
        <AiProviderIcon :provider-id="provider.id" size="large" />
        <span class="provider-row-copy">
          <strong>{{ provider.name }}</strong>
          <small>
            {{
              provider.id === initialData.providerId
                ? "绑定此组件"
                : "可新建组件"
            }}
          </small>
        </span>
      </button>
      <div class="provider-note">多个 provider 使用多个组件实例</div>
    </aside>

    <section class="usage-pane">
      <header class="usage-head">
        <AiProviderIcon :provider-id="editor.providerId" size="large" />
        <span>
          <strong>{{ editor.displayName }}</strong>
          <small
            >{{ selectedProvider.name }} ·
            {{ editor.accountLabel || "未设置账号标签" }}</small
          >
        </span>
      </header>

      <div class="usage-grid">
        <article class="usage-card">
          <small>5 小时使用限额</small>
          <strong>{{
            percentLabel(editor.lastSummary.primaryRemainingPercent)
          }}</strong>
          <span class="usage-meter">
            <span
              :style="barStyle(editor.lastSummary.primaryRemainingPercent)"
            />
          </span>
          <em>重置时间：{{ editor.lastSummary.primaryResetLabel || "--" }}</em>
        </article>
        <article class="usage-card">
          <small>每周使用限额</small>
          <strong>{{
            percentLabel(editor.lastSummary.weeklyRemainingPercent)
          }}</strong>
          <span class="usage-meter">
            <span
              :style="barStyle(editor.lastSummary.weeklyRemainingPercent)"
            />
          </span>
          <em>重置：{{ editor.lastSummary.weeklyResetLabel || "--" }}</em>
        </article>
      </div>

      <div class="status-card">
        <strong>{{
          editor.lastSummary.status === "connected" ? "已同步" : "等待配置"
        }}</strong>
        <span>{{ editor.lastSummary.lastSyncedAt || "尚未同步" }}</span>
      </div>
    </section>

    <section class="config-pane">
      <p class="pane-title">连接参数</p>
      <div class="settings-group">
        <label class="field">
          <span>组件名称</span>
          <input v-model="editor.displayName" type="text" />
        </label>

        <template v-if="queryAvailable">
          <div class="field">
            <span>credentialType</span>
            <div class="segmented segmented-two">
              <button
                type="button"
                :class="{ active: editor.credentialType === 'access_token' }"
                @click="editor.credentialType = 'access_token'"
              >
                access_token
              </button>
              <button
                type="button"
                :class="{ active: editor.credentialType === 'session_cookie' }"
                @click="editor.credentialType = 'session_cookie'"
              >
                session_cookie
              </button>
            </div>
          </div>

          <label class="field">
            <span>credential</span>
            <input
              v-model="editor.credential"
              type="password"
              placeholder="粘贴 access token 或 ChatGPT session cookie"
            />
          </label>
          <label class="field">
            <span>accountId · 可选</span>
            <input
              v-model="editor.accountId"
              type="text"
              placeholder="acct_••••••••"
            />
          </label>

          <div class="field">
            <span>凭证保存方式</span>
            <div class="segmented segmented-two">
              <button
                type="button"
                :class="{ active: editor.credentialStorage === 'once' }"
                @click="editor.credentialStorage = 'once'"
              >
                本次
              </button>
              <button
                type="button"
                :class="{ active: editor.credentialStorage === 'browser' }"
                @click="editor.credentialStorage = 'browser'"
              >
                浏览器
              </button>
            </div>
          </div>

          <div class="credential-card warning">
            插件模式会通过当前浏览器网络请求上游，凭据只用于本地发起请求。
          </div>
        </template>
        <div v-else class="planned-card">
          {{ selectedProvider.name }}
          的用量查询适配器待接入。本次只保存组件名称、provider 和展示配置。
        </div>
      </div>

      <div class="actions">
        <button
          type="button"
          class="secondary"
          :disabled="busy"
          @click="testConnection"
        >
          测试连接
        </button>
        <button
          type="button"
          class="primary"
          :disabled="busy"
          @click="
            editor.providerId === initialData.providerId
              ? saveConfig()
              : addProviderWidget()
          "
        >
          {{
            editor.providerId === initialData.providerId
              ? "保存配置"
              : "新建组件"
          }}
        </button>
      </div>
      <p class="message" v-if="message">{{ message }}</p>
    </section>
  </div>
</template>

<style scoped>
.ai-usage-opened {
  --sd-ai-usage-row-surface: color-mix(
    in srgb,
    var(--sd-component-surface) 70%,
    transparent
  );
  --sd-ai-usage-active-surface: var(--sd-component-surface);
  --sd-ai-usage-active-shadow: 0 8px 18px
    color-mix(in srgb, var(--sd-state-info) 10%, transparent);
  --sd-ai-usage-settings-surface: var(--sd-component-surface-muted);
  --sd-ai-usage-field-surface: var(--sd-component-surface);
  --sd-ai-usage-surface-soft: color-mix(
    in srgb,
    var(--sd-state-info) 7%,
    var(--sd-component-surface) 93%
  );
  --sd-ai-usage-warning-surface: var(--sd-state-warning-surface);
  --sd-ai-usage-warning-border: color-mix(
    in srgb,
    var(--sd-state-warning) 25%,
    transparent
  );
  --sd-ai-usage-warning-text: var(--sd-state-warning);
  --sd-ai-usage-button-primary-bg: var(--sd-color-text-primary);
  --sd-ai-usage-button-primary-text: var(--sd-color-text-inverse);
  --sd-ai-usage-soft-shadow: var(--sd-shadow-popover);
  display: grid;
  grid-template-columns: 226px minmax(300px, 1fr) 292px;
  gap: 18px;
  width: 100%;
  height: 100%;
  padding: 28px;
  overflow: auto;
  background: var(--sd-component-surface);
  color: var(--sd-component-text-primary);
}

[data-sd-theme="dark"] .ai-usage-opened {
  --sd-ai-usage-row-surface: color-mix(
    in srgb,
    var(--sd-component-text-primary) 6%,
    transparent
  );
  --sd-ai-usage-active-surface: color-mix(
    in srgb,
    var(--sd-component-text-primary) 9%,
    transparent
  );
  --sd-ai-usage-active-shadow: var(--sd-shadow-popover);
  --sd-ai-usage-settings-surface: var(--sd-component-surface-muted);
  --sd-ai-usage-field-surface: var(--sd-component-surface);
  --sd-ai-usage-surface-soft: color-mix(
    in srgb,
    var(--sd-state-info) 13%,
    var(--sd-component-surface) 87%
  );
  --sd-ai-usage-warning-surface: var(--sd-state-warning-surface);
  --sd-ai-usage-warning-border: color-mix(
    in srgb,
    var(--sd-state-warning) 25%,
    transparent
  );
  --sd-ai-usage-warning-text: var(--sd-state-warning);
  --sd-ai-usage-button-primary-bg: var(--sd-color-text-primary);
  --sd-ai-usage-button-primary-text: var(--sd-color-text-inverse);
  --sd-ai-usage-soft-shadow: var(--sd-shadow-popover);
}

.provider-pane,
.usage-pane,
.config-pane {
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--sd-component-border);
  border-radius: 28px;
  background: var(--sd-ai-usage-settings-surface);
}

.pane-title {
  margin: 0 0 14px;
  color: var(--sd-component-text-secondary);
  font-size: 15px;
  font-weight: 760;
  line-height: normal;
}

.provider-pane,
.config-pane {
  display: flex;
  flex-direction: column;
  padding: 18px;
}

.provider-list {
  display: grid;
  gap: 10px;
}

.provider-row {
  display: grid;
  align-items: center;
  width: 100%;
  min-height: 70px;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 14px;
  border: 1px solid transparent;
  border-radius: 24px;
  background: var(
    --sd-ai-usage-row-surface,
    var(--sd-component-surface-raised)
  );
  color: var(--sd-component-text-primary);
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
}

.provider-row + .provider-row {
  margin-top: 10px;
}

.provider-row.active {
  border-color: var(--sd-color-border-accent);
  background: var(--sd-ai-usage-active-surface);
  box-shadow: var(--sd-ai-usage-active-shadow);
}

.provider-row :deep(.ai-provider-icon) {
  --ai-provider-icon-size: 52px;
  --ai-provider-icon-radius: 18px;
  --ai-provider-icon-symbol-size: 64%;
}

.provider-row-copy {
  display: grid;
  min-width: 0;
}

.provider-row strong {
  overflow: hidden;
  font-size: 18px;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-row small,
.provider-note,
.usage-head small,
.usage-card small,
.usage-card em,
.status-card span,
.field > span,
.message {
  color: var(--sd-component-text-secondary);
}

.provider-row small {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 650;
}

.provider-note,
.planned-card {
  margin-top: 14px;
  border: 1px dashed var(--sd-component-border);
  border-radius: 18px;
  padding: 12px;
  text-align: center;
  font-size: 14px;
  font-weight: 740;
}

.usage-pane {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 16px;
  padding: 20px;
}

.usage-head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.usage-head span {
  display: grid;
  min-width: 0;
}

.usage-head strong {
  font-size: 18px;
}

.usage-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.usage-card,
.status-card {
  display: grid;
  min-width: 0;
  gap: 10px;
  border: 1px solid var(--sd-component-border);
  border-radius: 18px;
  background: var(--sd-component-surface-muted);
  padding: 16px;
}

.usage-card strong {
  font-size: 36px;
  line-height: 40px;
}

.usage-meter {
  display: block;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(
    in srgb,
    var(--sd-component-text-tertiary) 18%,
    transparent
  );
}

.usage-meter span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--sd-state-success);
}

.config-pane {
  gap: 0;
  overflow: auto;
}

.settings-group {
  display: grid;
  gap: 9px;
}

.field {
  display: grid;
  gap: 5px;
}

.field > span {
  font-size: 12px;
  font-weight: 760;
  line-height: normal;
}

.field input {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--sd-color-border-strong);
  border-radius: 14px;
  background: var(--sd-ai-usage-field-surface);
  color: var(--sd-component-text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 680;
  line-height: 1.1;
  padding: 9px 11px;
  outline: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.segmented {
  display: grid;
  border-radius: 15px;
  background: var(--sd-ai-usage-surface-soft);
  padding: 4px;
}

.segmented-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.segmented button,
.actions button {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.segmented button {
  appearance: none;
  border-radius: 11px;
  background: transparent;
  color: var(--sd-component-text-secondary);
  font-size: 11px;
  font-weight: 760;
  line-height: normal;
  padding: 7px 4px;
  text-align: center;
}

.segmented button.active {
  background: var(--sd-ai-usage-field-surface);
  color: var(--sd-component-text-primary);
  box-shadow: var(--sd-ai-usage-soft-shadow);
}

.credential-card {
  display: block;
  border: 1px solid var(--sd-ai-usage-warning-border);
  border-radius: 18px;
  background: var(--sd-ai-usage-warning-surface);
  color: var(--sd-ai-usage-warning-text);
  font-size: 12px;
  font-weight: 720;
  line-height: 1.35;
  padding: 9px 10px;
}

.credential-card input {
  margin: 0 6px 0 0;
  vertical-align: -2px;
}

.actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.actions button {
  border-radius: 15px;
  font-size: 13px;
  font-weight: 760;
  padding: 10px;
  text-align: center;
}

.actions button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.actions .secondary {
  border: 1px solid var(--sd-component-border);
  background: var(--sd-ai-usage-field-surface);
  color: var(--sd-component-text-primary);
}

.actions .primary {
  background: var(--sd-ai-usage-button-primary-bg);
  color: var(--sd-ai-usage-button-primary-text);
}

.message {
  min-height: 18px;
  margin: 8px 0 0;
  color: var(--sd-component-text-secondary);
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 940px) {
  .ai-usage-opened {
    display: flex;
    flex-direction: column;
    padding: 24px;
  }

  .provider-pane,
  .usage-pane,
  .config-pane {
    flex: 0 0 auto;
    min-height: auto;
  }

  .usage-pane {
    grid-template-rows: auto;
  }

  .provider-note,
  .actions {
    margin-top: 10px;
  }

  .usage-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .config-pane {
    align-self: flex-end;
    overflow: visible;
    width: min(100%, 292px);
  }
}
</style>
