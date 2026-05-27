<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useMainStore } from "../stores/main";
import type { NavGroup } from "../types";
import IconShape from "./IconShape.vue";
import IconUploader from "./IconUploader.vue";
import AppButton from "@/components/base/AppButton.vue";
import AppFieldRow from "@/components/base/AppFieldRow.vue";
import AppModalShell from "@/components/base/AppModalShell.vue";
import AppRangeField from "@/components/base/AppRangeField.vue";
import AppSectionCard from "@/components/base/AppSectionCard.vue";
import AppSegmentedControl from "@/components/base/AppSegmentedControl.vue";
import AppSwitch from "@/components/base/AppSwitch.vue";
import AppWindowControls from "@/components/base/AppWindowControls.vue";
import ConfirmDialog from "@/components/base/ConfirmDialog.vue";
import {
  DEFAULT_NAV_CARD_SIZE,
  DEFAULT_NAV_GRID_GAP,
  DEFAULT_NAV_ICON_SIZE,
} from "@/utils/layoutDefaults";

const props = defineProps<{
  show: boolean;
  groupId: string | null;
}>();

const emit = defineEmits(["update:show"]);
const store = useMainStore();
const showDeleteConfirm = ref(false);
const showResetConfirm = ref(false);

const group = computed(() => {
  return store.groups.find((g) => g.id === props.groupId);
});

const saveGroupChanges = (immediate = false) => {
  if (!store.isLogged) return;
  store.markDirty();
  void store.saveData(immediate);
};

const flushGroupChanges = () => {
  if (store.hasUnsavedChanges) {
    void store.saveData(true);
  }
};

const close = () => {
  flushGroupChanges();
  emit("update:show", false);
};

const updateGroup = (updates: Partial<NavGroup>) => {
  if (props.groupId) {
    store.updateGroup(props.groupId, updates);
    saveGroupChanges();
  }
};

const handleDeleteGroup = () => {
  if (!group.value) return;
  showDeleteConfirm.value = true;
};

const handleReset = () => {
  if (!group.value) return;
  showResetConfirm.value = true;
};

const confirmDeleteGroup = () => {
  if (!group.value) return;
  store.deleteGroup(group.value.id, true);
  saveGroupChanges(true);
  close();
};

const confirmResetGroup = () => {
  if (!group.value) return;
  updateGroup({
    titleColor: undefined,
    cardLayout: undefined,
    cardSize: undefined,
    gridGap: undefined,
    cardTitleSize: undefined,
    cardBgColor: undefined,
    showCardBackground: undefined,
    iconShape: undefined,
    backgroundImage: undefined,
    backgroundBlur: undefined,
    backgroundMask: undefined,
    autoHideTitle: undefined,
  });
};

onBeforeUnmount(() => {
  flushGroupChanges();
});

const handleBatchPublish = () => {
  if (!group.value) return;

  const updates: Partial<NavGroup> = { isPublic: true };
  if (group.value.items) {
    const newItems = group.value.items.map((item) => ({
      ...item,
      isPublic: true,
    }));
    updates.items = newItems;
  }
  updateGroup(updates);
};

const handleBatchUnpublish = () => {
  if (!group.value || !group.value.items) return;

  const newItems = group.value.items.map((item) => ({
    ...item,
    isPublic: false,
  }));
  updateGroup({ isPublic: false, items: newItems });
};

// --- Color Helper ---
const currentBgColor = computed(
  () => group.value?.cardBgColor || store.appConfig.cardBgColor || "#ffffff",
);

const bgHex = computed({
  get: () => {
    const c = currentBgColor.value;
    if (c.startsWith("#")) return c.substring(0, 7);
    if (c.startsWith("rgba") || c.startsWith("rgb")) {
      const rgb = c.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const r = parseInt(rgb[0]).toString(16).padStart(2, "0");
        const g = parseInt(rgb[1]!).toString(16).padStart(2, "0");
        const b = parseInt(rgb[2]!).toString(16).padStart(2, "0");
        return `#${r}${g}${b}`;
      }
    }
    return "#ffffff";
  },
  set: (val) => {
    const alpha = bgAlpha.value;
    const r = parseInt(val.slice(1, 3), 16);
    const g = parseInt(val.slice(3, 5), 16);
    const b = parseInt(val.slice(5, 7), 16);
    updateGroup({ cardBgColor: `rgba(${r}, ${g}, ${b}, ${alpha})` });
  },
});

const bgAlpha = computed({
  get: () => {
    const c = currentBgColor.value;
    if (c.startsWith("rgba")) {
      const parts = c.match(/[\d\.]+/g);
      if (parts && parts.length >= 4) {
        return parseFloat(parts[3]!);
      }
    }
    return 1;
  },
  set: (val) => {
    const hex = bgHex.value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    updateGroup({ cardBgColor: `rgba(${r}, ${g}, ${b}, ${val})` });
  },
});

const layoutOptions = [
  { label: "垂直", value: "vertical" },
  { label: "水平", value: "horizontal" },
] as const;

const groupItemCount = computed(() => group.value?.items?.length ?? 0);
const groupVisibilityLabel = computed(() =>
  group.value?.isPublic ? "访客可见" : "仅管理员",
);
const groupTitleValue = computed(() => group.value?.title || "未命名分组");
const isLayoutCustomized = computed(
  () =>
    !!group.value?.cardLayout ||
    group.value?.gridGap !== undefined ||
    group.value?.cardSize !== undefined ||
    group.value?.iconSize !== undefined ||
    group.value?.cardTitleSize !== undefined,
);
const isStyleCustomized = computed(
  () =>
    !!group.value?.cardBgColor ||
    group.value?.showCardBackground !== undefined ||
    !!group.value?.iconShape ||
    !!group.value?.cardTitleColor,
);
const isMediaCustomized = computed(() => !!group.value?.backgroundImage);
</script>

<template>
  <AppModalShell
    :show="show && !!group"
    :z-index="50"
    close-on-overlay
    close-on-escape
    overlay-class="group-settings-overlay"
    panel-class="group-settings-panel"
    surface-class="group-settings-surface"
    body-class="group-settings-body"
    aria-label="分组设置"
    :show-close="false"
    @close="close"
  >
    <div
      v-if="group"
      data-testid="group-settings-modal"
      class="group-settings-layout"
    >
      <AppWindowControls
        class="group-settings-window-controls"
        aria-label="分组设置窗口控制"
        close-label="关闭分组设置"
        @close="close"
      />

      <aside class="group-settings-sidebar">
        <div class="group-settings-profile">
          <p class="group-settings-kicker">Group Settings</p>
          <h3 class="group-settings-title">{{ groupTitleValue }}</h3>
          <p class="group-settings-summary">
            {{ groupItemCount }} 个项目 · {{ groupVisibilityLabel }}
          </p>
        </div>

        <div class="group-settings-quick-actions" aria-label="分组公开操作">
          <button type="button" @click="handleBatchPublish">公开</button>
          <button type="button" class="is-danger" @click="handleBatchUnpublish">
            不公开
          </button>
        </div>

        <div class="group-settings-overview" aria-label="分组设置摘要">
          <div class="group-settings-overview-row">
            <span>布局</span>
            <strong>{{ isLayoutCustomized ? "已自定义" : "默认" }}</strong>
          </div>
          <div class="group-settings-overview-row">
            <span>样式</span>
            <strong>{{ isStyleCustomized ? "已自定义" : "默认" }}</strong>
          </div>
          <div class="group-settings-overview-row">
            <span>背景</span>
            <strong>{{ isMediaCustomized ? "已设置" : "未设置" }}</strong>
          </div>
        </div>
      </aside>

      <section class="group-settings-main">
        <header class="group-settings-section-head">
          <div>
            <p class="group-settings-section-kicker">分组设置</p>
            <h3 class="group-settings-section-title">常用设置</h3>
            <p class="group-settings-section-summary">
              标题、公开状态、布局、样式和背景集中在同一页。
            </p>
          </div>
          <div class="group-settings-status-badges" aria-label="自定义状态">
            <span v-if="isLayoutCustomized" class="group-settings-status-badge">
              布局已自定义
            </span>
            <span v-if="isStyleCustomized" class="group-settings-status-badge">
              样式已自定义
            </span>
            <span v-if="isMediaCustomized" class="group-settings-status-badge">
              背景已设置
            </span>
          </div>
        </header>

        <div class="group-settings-scroll">
          <div class="group-settings-stack">
            <AppSectionCard
              title="基础与公开状态"
              description="标题、标题颜色和访客可见状态会立即同步到首页分组。"
              body-class="group-settings-field-stack"
            >
              <AppFieldRow label="分组标题" hint="显示在首页分组标题区。">
                <template #control>
                  <div class="group-settings-title-control">
                    <input
                      :value="group.title"
                      type="text"
                      class="sd-input"
                      @input="
                        (e) =>
                          updateGroup({
                            title: (e.target as HTMLInputElement).value,
                          })
                      "
                    />
                    <input
                      type="color"
                      :value="
                        group.titleColor ||
                        store.appConfig.titleColor ||
                        '#374151'
                      "
                      class="group-settings-color-swatch"
                      title="标题颜色"
                      @input="
                        (e) =>
                          updateGroup({
                            titleColor: (e.target as HTMLInputElement).value,
                          })
                      "
                    />
                  </div>
                </template>
              </AppFieldRow>

              <AppFieldRow
                label="自动隐藏标题"
                hint="开启后，鼠标悬停时才显示组名和操作按钮。"
                align="center"
              >
                <template #control>
                  <AppSwitch
                    :model-value="!!group.autoHideTitle"
                    label=""
                    @update:model-value="
                      (value) => updateGroup({ autoHideTitle: value })
                    "
                  />
                </template>
              </AppFieldRow>

              <div class="group-settings-visibility-card">
                <div>
                  <span>当前状态</span>
                  <strong>{{ groupVisibilityLabel }}</strong>
                </div>
                <div class="group-settings-action-row">
                  <AppButton
                    size="sm"
                    variant="secondary"
                    @click="handleBatchPublish"
                  >
                    公开
                  </AppButton>
                  <AppButton
                    size="sm"
                    variant="danger-soft"
                    @click="handleBatchUnpublish"
                  >
                    不公开
                  </AppButton>
                </div>
              </div>
            </AppSectionCard>

            <AppSectionCard
              title="布局与密度"
              description="控制分组内项目的默认排列、尺寸和间距。"
              body-class="group-settings-field-stack"
            >
              <AppFieldRow
                label="卡片布局"
                hint="继承全局设置，或为当前分组单独指定。"
              >
                <template #control>
                  <AppSegmentedControl
                    :model-value="
                      group.cardLayout || store.appConfig.cardLayout
                    "
                    :options="layoutOptions"
                    @update:model-value="
                      (value) =>
                        updateGroup({
                          cardLayout: value as 'vertical' | 'horizontal',
                        })
                    "
                  />
                </template>
              </AppFieldRow>

              <div class="group-settings-range-grid">
                <AppRangeField
                  label="卡片间距"
                  :model-value="group.gridGap ?? DEFAULT_NAV_GRID_GAP"
                  :value-text="`${group.gridGap ?? DEFAULT_NAV_GRID_GAP}px`"
                  :min="4"
                  :max="32"
                  :step="2"
                  @update:model-value="
                    (value) => updateGroup({ gridGap: value })
                  "
                  @change="flushGroupChanges"
                />

                <AppRangeField
                  label="卡片大小"
                  :model-value="group.cardSize ?? DEFAULT_NAV_CARD_SIZE"
                  :value-text="`${group.cardSize ?? DEFAULT_NAV_CARD_SIZE}px`"
                  :min="60"
                  :max="216"
                  :step="4"
                  @update:model-value="
                    (value) => updateGroup({ cardSize: value })
                  "
                  @change="flushGroupChanges"
                />

                <AppRangeField
                  label="图标大小"
                  :model-value="group.iconSize ?? DEFAULT_NAV_ICON_SIZE"
                  :value-text="`${group.iconSize ?? DEFAULT_NAV_ICON_SIZE}px`"
                  :min="20"
                  :max="100"
                  :step="2"
                  @update:model-value="
                    (value) => updateGroup({ iconSize: value })
                  "
                  @change="flushGroupChanges"
                />

                <AppRangeField
                  label="文字大小"
                  :model-value="group.cardTitleSize ?? 13"
                  :value-text="
                    group.cardTitleSize == null
                      ? '默认'
                      : `${group.cardTitleSize}px`
                  "
                  :min="10"
                  :max="22"
                  :step="1"
                  @update:model-value="
                    (value) => updateGroup({ cardTitleSize: value })
                  "
                  @change="flushGroupChanges"
                />
              </div>
            </AppSectionCard>

            <AppSectionCard
              title="卡片外观"
              description="颜色、透明度和图标形状只作用于当前分组。"
              body-class="group-settings-field-stack"
            >
              <AppFieldRow
                label="显示卡片背景"
                hint="关闭后只保留图标和文字。"
                align="center"
              >
                <template #control>
                  <AppSwitch
                    :model-value="
                      group.showCardBackground ??
                      store.appConfig.showCardBackground
                    "
                    label=""
                    @update:model-value="
                      (value) => updateGroup({ showCardBackground: value })
                    "
                  />
                </template>
              </AppFieldRow>

              <div class="group-settings-swatch-grid">
                <label class="group-settings-swatch-field">
                  <span>文字</span>
                  <input
                    type="color"
                    :value="
                      group.cardTitleColor ||
                      store.appConfig.cardTitleColor ||
                      '#111827'
                    "
                    class="group-settings-color-swatch"
                    @input="
                      (e) =>
                        updateGroup({
                          cardTitleColor: (e.target as HTMLInputElement).value,
                        })
                    "
                  />
                </label>

                <label class="group-settings-swatch-field">
                  <span>背景</span>
                  <input
                    type="color"
                    v-model="bgHex"
                    class="group-settings-color-swatch"
                    :disabled="
                      !(
                        group.showCardBackground ??
                        store.appConfig.showCardBackground
                      )
                    "
                  />
                </label>
              </div>

              <AppRangeField
                v-if="
                  group.showCardBackground ?? store.appConfig.showCardBackground
                "
                label="背景透明度"
                v-model="bgAlpha"
                :value-text="`${Math.round(bgAlpha * 100)}%`"
                :min="0"
                :max="1"
                :step="0.05"
                @change="flushGroupChanges"
              />

              <AppFieldRow label="图标形状" hint="图标外框形状和隐藏图标策略。">
                <template #control>
                  <div class="group-settings-icon-shape-row">
                    <select
                      :value="group.iconShape || store.appConfig.iconShape"
                      class="sd-select"
                      @change="
                        (e) =>
                          updateGroup({
                            iconShape: (e.target as HTMLInputElement).value,
                          })
                      "
                    >
                      <option value="none">无形状</option>
                      <option value="hidden">不使用图标</option>
                      <option value="rounded">圆角矩形</option>
                      <option value="square">方形</option>
                      <option value="circle">圆形</option>
                      <option value="leaf">叶形</option>
                      <option value="diamond">菱形</option>
                      <option value="pentagon">五角形</option>
                      <option value="hexagon">六边形</option>
                      <option value="octagon">八边形</option>
                    </select>
                    <div class="group-settings-icon-preview">
                      <IconShape
                        :shape="group.iconShape || store.appConfig.iconShape"
                        :size="24"
                        bgClass="fill-blue-500"
                        icon=""
                      />
                    </div>
                  </div>
                </template>
              </AppFieldRow>
            </AppSectionCard>

            <AppSectionCard
              title="卡片背景图"
              description="背景图会应用到当前分组内所有卡片。"
              body-class="group-settings-field-stack"
            >
              <AppFieldRow label="图片地址" hint="支持上传结果或远程图片 URL。">
                <template #control>
                  <div class="group-settings-url-row">
                    <input
                      :value="group.backgroundImage"
                      type="text"
                      placeholder="背景图 URL..."
                      class="sd-input"
                      @input="
                        (e) =>
                          updateGroup({
                            backgroundImage: (e.target as HTMLInputElement)
                              .value,
                          })
                      "
                    />
                    <button
                      v-if="group.backgroundImage"
                      type="button"
                      class="group-settings-icon-button"
                      title="清除背景"
                      aria-label="清除背景"
                      @click="updateGroup({ backgroundImage: '' })"
                    >
                      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path
                          d="m5 5 10 10M15 5 5 15"
                          stroke="currentColor"
                          stroke-width="1.8"
                          stroke-linecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                </template>
              </AppFieldRow>

              <IconUploader
                :modelValue="group.backgroundImage"
                :crop="false"
                :uploadOnly="true"
                :previewStyle="{
                  filter: `blur(${group.backgroundBlur ?? 6}px)`,
                  transform: 'scale(1.1)',
                }"
                :overlayStyle="{
                  backgroundColor: `rgba(0,0,0,${group.backgroundMask ?? 0.3})`,
                }"
                @update:modelValue="
                  (val) => updateGroup({ backgroundImage: val })
                "
              />

              <div
                v-if="group.backgroundImage"
                class="group-settings-range-grid"
              >
                <AppRangeField
                  label="模糊半径"
                  :model-value="group.backgroundBlur ?? 6"
                  :value-text="`${group.backgroundBlur ?? 6}px`"
                  :min="0"
                  :max="20"
                  :step="1"
                  @update:model-value="
                    (value) => updateGroup({ backgroundBlur: value })
                  "
                  @change="flushGroupChanges"
                />
                <AppRangeField
                  label="遮罩浓度"
                  :model-value="group.backgroundMask ?? 0.3"
                  :value-text="`${Math.round((group.backgroundMask ?? 0.3) * 100)}%`"
                  :min="0"
                  :max="1"
                  :step="0.1"
                  @update:model-value="
                    (value) => updateGroup({ backgroundMask: value })
                  "
                  @change="flushGroupChanges"
                />
              </div>
            </AppSectionCard>

            <AppSectionCard
              title="维护操作"
              description="恢复默认会清除当前分组外观自定义；删除分组需要二次确认。"
            >
              <div class="group-settings-maintenance-actions">
                <AppButton variant="secondary" block @click="handleReset">
                  恢复默认设置
                </AppButton>
                <AppButton
                  variant="danger-soft"
                  block
                  @click="handleDeleteGroup"
                >
                  删除此分组
                </AppButton>
              </div>
            </AppSectionCard>
          </div>
        </div>
      </section>
    </div>
  </AppModalShell>

  <ConfirmDialog
    v-model:show="showResetConfirm"
    title="恢复默认设置"
    message="确定要重置此分组的所有设置，恢复为全局默认吗？"
    confirm-label="恢复默认"
    @confirm="confirmResetGroup"
  />

  <ConfirmDialog
    v-model:show="showDeleteConfirm"
    title="删除分组"
    :message="`确定要删除分组 “${group?.title || ''}” 及其所有内容吗？此操作无法撤销。`"
    confirm-label="删除"
    tone="danger"
    @confirm="confirmDeleteGroup"
  />
</template>

<style scoped>
:global(.group-settings-overlay) {
  background: var(--sd-shell-overlay);
  -webkit-backdrop-filter: var(--sd-shell-overlay-filter);
  backdrop-filter: var(--sd-shell-overlay-filter);
}

:global(.group-settings-panel) {
  width: min(900px, calc(100vw - 32px));
}

:global(.group-settings-surface) {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--sd-shell-border);
  border-radius: 20px;
  background: var(--sd-shell-surface);
  box-shadow: var(--sd-shadow-window);
  -webkit-backdrop-filter: var(--sd-shell-surface-filter);
  backdrop-filter: var(--sd-shell-surface-filter);
}

:global(.group-settings-surface > .sd-window-bar) {
  display: none;
}

:global(.group-settings-body) {
  padding: 0;
  overflow: hidden;
}

.group-settings-layout {
  position: relative;
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr);
  height: min(620px, calc(100vh - 96px));
  min-height: min(560px, calc(100vh - 96px));
  color: var(--sd-shell-text-primary);
}

.group-settings-window-controls {
  position: absolute;
  z-index: 4;
  top: 11px;
  right: 20px;
}

.group-settings-sidebar {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  padding: 68px 12px 18px;
}

.group-settings-profile {
  display: grid;
  gap: 4px;
  padding: 0 6px 6px;
}

.group-settings-kicker,
.group-settings-section-kicker {
  margin: 0;
  color: var(--sd-theme-group-settings-modal-text-01);
  font-size: 11px;
  font-weight: 700;
  line-height: 14px;
  letter-spacing: 0;
  text-transform: uppercase;
}

.group-settings-title {
  min-width: 0;
  overflow: hidden;
  color: var(--sd-theme-group-settings-modal-text-02);
  font-size: 17px;
  font-weight: 800;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-settings-summary,
.group-settings-section-summary {
  color: var(--sd-theme-group-settings-modal-text-03);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
}

.group-settings-quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 0 6px 4px;
}

.group-settings-quick-actions button {
  min-height: 26px;
  border: 1px solid var(--sd-theme-group-settings-modal-border-01);
  border-radius: 10px;
  background: var(--sd-theme-group-settings-modal-surface-01);
  color: var(--sd-theme-group-settings-modal-text-04);
  font-size: 12px;
  font-weight: 700;
}

.group-settings-quick-actions button:hover {
  border-color: var(--sd-theme-group-settings-modal-accent-border-01);
  background: var(--sd-theme-group-settings-modal-surface-02);
}

.group-settings-quick-actions button.is-danger {
  color: var(--sd-theme-group-settings-modal-accent-text-01);
}

.group-settings-overview {
  display: grid;
  gap: 8px;
  padding: 4px 6px 0;
}

.group-settings-overview-row {
  display: flex;
  min-height: 34px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid var(--sd-theme-group-settings-modal-border-02);
  border-radius: 11px;
  background: var(--sd-theme-group-settings-modal-surface-03);
  padding: 0 10px;
}

.group-settings-overview-row span {
  color: var(--sd-theme-group-settings-modal-text-05);
  font-size: 12px;
  font-weight: 700;
}

.group-settings-overview-row strong {
  overflow: hidden;
  color: var(--sd-theme-group-settings-modal-text-02);
  font-size: 12px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-settings-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}

.group-settings-section-head {
  display: flex;
  min-height: 82px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 12px;
}

.group-settings-section-title {
  margin: 2px 0;
  color: var(--sd-theme-group-settings-modal-text-02);
  font-size: 22px;
  font-weight: 800;
  line-height: 1.15;
}

.group-settings-status-badges {
  display: flex;
  max-width: 280px;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.group-settings-status-badge {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  border-radius: 999px;
  background: var(--sd-theme-group-settings-modal-accent-surface-01);
  color: var(--sd-theme-group-settings-modal-accent-text-02);
  font-size: 12px;
  font-weight: 800;
  padding: 0 10px;
  white-space: nowrap;
}

.group-settings-scroll {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 18px 20px;
}

.group-settings-stack,
:deep(.group-settings-field-stack) {
  display: grid;
  gap: 14px;
}

.group-settings-title-control,
.group-settings-url-row,
.group-settings-icon-shape-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.group-settings-color-swatch {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid var(--sd-theme-group-settings-modal-border-03);
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.group-settings-color-swatch:disabled {
  cursor: not-allowed;
  opacity: 0.44;
}

.group-settings-visibility-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.group-settings-visibility-card span,
.group-settings-swatch-field span {
  color: var(--sd-theme-group-settings-modal-text-06);
  font-size: 12px;
  font-weight: 700;
}

.group-settings-visibility-card strong {
  display: block;
  margin-top: 2px;
  color: var(--sd-theme-group-settings-modal-text-02);
  font-size: 16px;
  font-weight: 800;
}

.group-settings-action-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.group-settings-maintenance-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.group-settings-range-grid,
.group-settings-swatch-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.group-settings-swatch-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--sd-theme-group-settings-modal-border-04);
  border-radius: 14px;
  background: var(--sd-theme-group-settings-modal-surface-04);
  padding: 10px 12px;
}

.group-settings-icon-preview {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--sd-theme-group-settings-modal-border-04);
  border-radius: 14px;
  background: var(--sd-theme-group-settings-modal-surface-05);
}

.group-settings-icon-button {
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid var(--sd-theme-group-settings-modal-border-01);
  border-radius: 12px;
  background: var(--sd-theme-group-settings-modal-surface-05);
  color: var(--sd-theme-group-settings-modal-text-07);
}

.group-settings-icon-button:hover {
  border-color: var(--sd-theme-group-settings-modal-accent-border-02);
  color: var(--sd-theme-group-settings-modal-accent-text-01);
}

.group-settings-icon-button svg {
  width: 18px;
  height: 18px;
}

.group-settings-layout :deep(.sd-section-card) {
  border-color: var(--sd-theme-group-settings-modal-border-04);
  background: var(--sd-theme-group-settings-modal-surface-03);
  box-shadow: none;
}

.group-settings-layout :deep(.sd-section-card-header) {
  padding: 15px 16px 0;
}

.group-settings-layout :deep(.sd-section-card-body) {
  padding: 15px 16px 16px;
}

.group-settings-layout :deep(.sd-section-card-title),
.group-settings-layout :deep(.sd-field-label),
.group-settings-layout :deep(.sd-range-field-value) {
  color: var(--sd-theme-group-settings-modal-text-02);
}

.group-settings-layout :deep(.sd-section-card-description),
.group-settings-layout :deep(.sd-field-hint),
.group-settings-layout :deep(.sd-range-field-title),
.group-settings-layout :deep(.sd-switch-hint) {
  color: var(--sd-theme-group-settings-modal-text-08);
}

.group-settings-layout :deep(.sd-input),
.group-settings-layout :deep(.sd-select) {
  border-color: var(--sd-theme-group-settings-modal-border-04);
  background: var(--sd-theme-group-settings-modal-surface-01);
  color: var(--sd-theme-group-settings-modal-text-02);
}

.group-settings-layout :deep(.sd-input::placeholder) {
  color: var(--sd-theme-group-settings-modal-text-09);
}

.group-settings-layout :deep(.sd-segmented) {
  background: var(--sd-theme-group-settings-modal-surface-05);
}

.group-settings-layout :deep(.sd-segment-button.is-active) {
  background: var(--sd-theme-group-settings-modal-accent-surface-02);
  color: var(--sd-theme-group-settings-modal-text-10);
  box-shadow: none;
}

.group-settings-layout :deep(.sd-switch:not(.is-checked)) {
  background: var(--sd-theme-group-settings-modal-surface-06);
}

.group-settings-layout :deep(.sd-range) {
  background: var(--sd-theme-group-settings-modal-surface-07);
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: var(--sd-theme-group-settings-modal-accent-surface-03);
  cursor: pointer;
  margin-top: -6px;
}
input[type="range"]::-webkit-slider-runnable-track {
  width: 100%;
  height: 4px;
  cursor: pointer;
  background: var(--sd-theme-group-settings-modal-surface-08);
  border-radius: 2px;
}

@media (max-width: 767px) {
  :global(.group-settings-panel) {
    width: min(100vw, calc(100vw - 16px));
  }

  :global(.group-settings-surface) {
    border-radius: 18px;
  }

  .group-settings-layout {
    grid-template-columns: minmax(0, 1fr);
    height: min(760px, calc(100dvh - 24px));
  }

  .group-settings-sidebar {
    min-height: auto;
    padding: 54px 12px 10px;
  }

  .group-settings-profile {
    padding-right: 70px;
  }

  .group-settings-section-head {
    min-height: auto;
    align-items: flex-start;
    flex-direction: column;
    padding: 8px 16px 12px;
  }

  .group-settings-status-badges {
    max-width: none;
    justify-content: flex-start;
  }

  .group-settings-scroll {
    padding: 0 12px 16px;
  }

  .group-settings-range-grid,
  .group-settings-swatch-grid,
  .group-settings-title-control,
  .group-settings-url-row,
  .group-settings-icon-shape-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .group-settings-visibility-card {
    align-items: stretch;
    flex-direction: column;
  }

  .group-settings-action-row {
    justify-content: stretch;
  }

  .group-settings-action-row :deep(.sd-btn) {
    flex: 1 1 0;
  }

  .group-settings-maintenance-actions {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
