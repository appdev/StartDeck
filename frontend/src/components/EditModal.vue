<script setup lang="ts">
import { ref, watch, computed, shallowRef, onUnmounted, nextTick } from "vue";
import type { NavItem } from "@/types";
import {
  useSmartIconMatch,
  type SmartIconMatchResult,
} from "@/composables/useSmartIconMatch";
import { useMainStore } from "../stores/main";
import IconShape from "./IconShape.vue";
import IconUploader from "./IconUploader.vue";
import IconSelectionModal from "./IconSelectionModal.vue";
import GroupSelector from "./GroupSelector.vue";
import AppButton from "@/components/base/AppButton.vue";
import AppModalShell from "@/components/base/AppModalShell.vue";
import AppSwitch from "@/components/base/AppSwitch.vue";
import AppWindowControls from "@/components/base/AppWindowControls.vue";
import ConfirmDialog from "@/components/base/ConfirmDialog.vue";
import {
  useDirtyStateGuard,
  type DirtyCloseReason,
} from "@/composables/useDirtyStateGuard";
import { VueCropper } from "vue-cropper";
import { cacheIconToLocal } from "@/utils/iconCache";
import { getSiteIconUrl } from "@/utils/siteMetadata";
import {
  normalizeIconBackgroundColor,
  resolveIconBackground,
} from "@/utils/iconAppearance";
import { useUiFeedbackStore } from "@/stores/uiFeedback";
import {
  applyCropperZoom,
  readCropperScale,
  type VueCropperHandle,
} from "@/utils/vueCropperZoom";
import "vue-cropper/dist/index.css";

// 接收父组件传来的数据
const props = defineProps<{
  show: boolean;
  data?: NavItem | null;
  // ✨✨✨ 新增关键参数：当前分组ID (必须有这个才能支持分组添加)
  groupId?: string;
  onSave?: (payload: { item: NavItem; groupId?: string }) => Promise<void>;
}>();

const emit = defineEmits(["update:show", "save"]);

const store = useMainStore();
const uiFeedback = useUiFeedbackStore();

let smartMatchToastTimer: number | null = null;
const editModalTitle = computed(() => (props.data ? "修改项目" : "添加新项目"));

onUnmounted(() => {
  if (smartMatchToastTimer) window.clearTimeout(smartMatchToastTimer);
});

const isVertical = computed(() => {
  const layout = props.groupId
    ? store.groups.find((g) => g.id === props.groupId)?.cardLayout
    : undefined;
  return (layout || store.appConfig.cardLayout) === "vertical";
});

// 合并描述字段的计算属性
const mergedDescription = computed({
  get: () => {
    const d1 = form.value.description1 || "";
    const d2 = form.value.description2 || "";
    const d3 = form.value.description3 || "";
    // 如果有后面行的内容，则保留前面的换行符
    if (d3) return `${d1}\n${d2}\n${d3}`;
    if (d2) return `${d1}\n${d2}`;
    return d1;
  },
  set: (val: string) => {
    const lines = val.split("\n");
    form.value.description1 = lines[0] || "";
    form.value.description2 = lines[1] || "";
    form.value.description3 = lines[2] || "";
  },
});

// 自动调整高度
const autoResize = (event: Event) => {
  const el = event.target as HTMLTextAreaElement;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
};

// 搜索相关状态
const showIconSelection = ref(false);
const iconCandidates = shallowRef<string[]>([]);
const searchSource = ref<"local" | "api">("api");

const localGroupId = ref("");
const initialFormSnapshot = ref("");
const showDiscardConfirm = ref(false);
const modalOpenedAt = ref(0);

// 表单数据 (合并管理，比以前分散的 ref 更整洁)
interface EditForm
  extends Omit<NavItem, "id" | "backupUrls" | "backupLanUrls"> {
  backupUrls: { name: string; url: string }[];
  backupLanUrls: { name: string; url: string }[];
}

const createEmptyForm = (): EditForm => ({
  title: "",
  url: "",
  lanUrl: "",
  backupUrls: [],
  backupLanUrls: [],
  icon: "",
  description1: "",
  description2: "",
  description3: "",
  iconBackgroundMode: "auto",
  iconAutoBackgroundColor: "",
  iconCustomBackgroundColor: "",
  color: "bg-gray-100 text-gray-700",
  titleColor: "",
  isPublic: false,
  backgroundImage: "",
  backgroundBlur: 6,
  backgroundMask: 0.3,
  iconSize: 100,
});

const form = ref<EditForm>({
  ...createEmptyForm(),
});

const serializeFormState = () =>
  JSON.stringify({
    groupId: localGroupId.value || props.groupId || "",
    form: form.value,
  });

const isDirty = computed(() => {
  if (!props.show || !initialFormSnapshot.value) return false;
  return serializeFormState() !== initialFormSnapshot.value;
});

const finalizeClose = () => {
  showDiscardConfirm.value = false;
  emit("update:show", false);
};

const { requestClose, handleDismissAttempt } = useDirtyStateGuard({
  isDirty,
  onCleanClose: finalizeClose,
  onDirtyAttempt: () => {
    showDiscardConfirm.value = true;
  },
});

// 选中图标
const activeGroup = computed(() =>
  store.groups.find(
    (group) => group.id === (localGroupId.value || props.groupId || ""),
  ),
);

const effectiveIconShape = computed(
  () => activeGroup.value?.iconShape || store.appConfig.iconShape || "circle",
);
const isIconHidden = computed(() => effectiveIconShape.value === "hidden");
const iconBackgroundResolution = computed(() =>
  resolveIconBackground(form.value, {
    fallback: "bg-gray-100",
    shape: effectiveIconShape.value,
  }),
);

const iconBackgroundModes = [
  { value: "auto", label: "自动" },
  { value: "custom", label: "自定义" },
] as const;

const iconBackgroundPresets = [
  "#111827",
  "#1d4ed8",
  "#047857",
  "#b45309",
  "#be123c",
  "#7c3aed",
  "#0f766e",
  "#f3f4f6",
] as const;

const setIconBackgroundMode = (
  mode: (typeof iconBackgroundModes)[number]["value"],
) => {
  form.value.iconBackgroundMode = mode;
  if (
    mode === "custom" &&
    !normalizeIconBackgroundColor(form.value.iconCustomBackgroundColor)
  ) {
    form.value.iconCustomBackgroundColor =
      normalizeIconBackgroundColor(form.value.iconAutoBackgroundColor) ||
      "#111827";
  }
};

const setCustomIconBackgroundColor = (value: string) => {
  const normalized = normalizeIconBackgroundColor(value);
  if (!normalized || !normalized.startsWith("#") || normalized.length !== 7)
    return;
  form.value.iconBackgroundMode = "custom";
  form.value.iconCustomBackgroundColor = normalized;
};

const iconCustomColorValue = computed(
  () =>
    normalizeIconBackgroundColor(form.value.iconCustomBackgroundColor) ||
    "#111827",
);

const onIconSelect = (result: SmartIconMatchResult) => {
  form.value.icon = result.icon;
  const backgroundColor = normalizeIconBackgroundColor(result.backgroundColor);
  form.value.iconAutoBackgroundColor = backgroundColor || "";
  if (form.value.iconBackgroundMode !== "custom") {
    form.value.iconBackgroundMode = "auto";
  }
};

const smartMatchToast = ref("");

const clearSmartMatchToast = () => {
  smartMatchToast.value = "";
  if (smartMatchToastTimer) {
    window.clearTimeout(smartMatchToastTimer);
    smartMatchToastTimer = null;
  }
};

const showSmartMatchToast = (message: string) => {
  smartMatchToast.value = message;
  if (smartMatchToastTimer) window.clearTimeout(smartMatchToastTimer);
  smartMatchToastTimer = window.setTimeout(() => {
    smartMatchToast.value = "";
    smartMatchToastTimer = null;
  }, 2400);
};

const {
  smartMatchCandidates,
  isSmartMatching,
  lastSiteMetadata,
  smartMatchIcons,
  closeSmartMatchModal,
  resetSmartMatchState,
} = useSmartIconMatch({
  form,
  onSelect: onIconSelect,
  notify: showSmartMatchToast,
});

const showExtraLinks = ref(false);

const hasExtraLinks = computed(
  () =>
    (form.value.backupUrls && form.value.backupUrls.length > 0) ||
    (form.value.backupLanUrls && form.value.backupLanUrls.length > 0),
);

const metadataFetchParts = computed(() => {
  const metadata = lastSiteMetadata.value;
  if (!metadata) return [];
  return [
    metadata.title ? "标题" : "",
    metadata.icon ? "图标" : "",
    metadata.description ? "描述" : "",
  ].filter(Boolean);
});

const metadataFetchSummary = computed(() => {
  if (isSmartMatching.value) return "正在获取站点信息...";
  const parts = metadataFetchParts.value;
  if (parts.length > 0) return `已获取${parts.join("、")}`;
  if (lastSiteMetadata.value) return "未获取到可用站点信息";
  return "填写公网地址后可自动获取标题、图标和摘要";
});

const hasFetchedMetadata = computed(() => metadataFetchParts.value.length > 0);

const cardPreviewTitle = computed(() => form.value.title || "未命名卡片");

const cardPreviewUrl = computed(() => form.value.url || "https://example.com");

const cardPreviewIcon = computed(() => form.value.icon || "");

const metadataTitle = computed(
  () => lastSiteMetadata.value?.title || cardPreviewTitle.value,
);

const metadataUrl = computed(
  () => lastSiteMetadata.value?.url || cardPreviewUrl.value,
);

const previewDescription = computed(
  () => lastSiteMetadata.value?.description || "",
);

const metadataIcon = computed(
  () => lastSiteMetadata.value?.icon || form.value.icon || "",
);

const openExtraLinks = () => {
  showExtraLinks.value = true;
  if (!hasExtraLinks.value) addBackupUrl();
};

const runSmartMetadataFetch = async () => {
  await smartMatchIcons();
  closeSmartMatchModal();
};

const openCandidateSelection = async () => {
  if (smartMatchCandidates.value.length === 0 && form.value.url) {
    await smartMatchIcons();
    closeSmartMatchModal();
  }
  iconCandidates.value = smartMatchCandidates.value
    .map((candidate) => candidate.url)
    .filter(Boolean);
  if (iconCandidates.value.length === 0) {
    uiFeedback.notify({
      title: "暂无候选图标",
      message: "请先填写链接或执行一次智能匹配。",
      tone: "warning",
    });
    return;
  }
  searchSource.value = "api";
  showIconSelection.value = true;
};

// 监听弹窗打开，初始化表单
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      modalOpenedAt.value = Date.now();
      showDiscardConfirm.value = false;
      localGroupId.value = props.groupId || "";
      resetSmartMatchState();
      if (props.data) {
        // 编辑模式：回填数据
        form.value = {
          ...props.data,
          backupUrls: props.data.backupUrls
            ? props.data.backupUrls.map((u) =>
                typeof u === "string" ? { name: "", url: u } : { ...u },
              )
            : [],
          backupLanUrls: props.data.backupLanUrls
            ? props.data.backupLanUrls.map((u) =>
                typeof u === "string" ? { name: "", url: u } : { ...u },
              )
            : [],
          description1: props.data.description1 || "",
          description2: props.data.description2 || "",
          description3: props.data.description3 || "",
          iconBackgroundMode:
            props.data.iconBackgroundMode === "custom" ? "custom" : "auto",
          iconAutoBackgroundColor: props.data.iconAutoBackgroundColor || "",
          iconCustomBackgroundColor: props.data.iconCustomBackgroundColor || "",
          titleColor: props.data.titleColor || "",
          backgroundImage: props.data.backgroundImage || "",
          backgroundBlur: props.data.backgroundBlur ?? 6,
          backgroundMask: props.data.backgroundMask ?? 0.3,
          iconSize: props.data.iconSize ?? 100,
        };
      } else {
        // 新增模式：重置表单
        form.value = createEmptyForm();
      }
      showExtraLinks.value = hasExtraLinks.value;
      nextTick(() => {
        initialFormSnapshot.value = serializeFormState();
      });
    } else {
      modalOpenedAt.value = 0;
      initialFormSnapshot.value = "";
      showDiscardConfirm.value = false;
      showExtraLinks.value = false;
      resetSmartMatchState();
      clearSmartMatchToast();
    }
  },
  { immediate: true },
);

const addBackupUrl = () => {
  showExtraLinks.value = true;
  if (!form.value.backupUrls) form.value.backupUrls = [];
  form.value.backupUrls.push({ name: "", url: "" });
};

const removeBackupUrl = (index: number) => {
  if (form.value.backupUrls) {
    form.value.backupUrls.splice(index, 1);
  }
};

const addBackupLanUrl = () => {
  showExtraLinks.value = true;
  if (!form.value.backupLanUrls) form.value.backupLanUrls = [];
  form.value.backupLanUrls.push({ name: "", url: "" });
};

const removeBackupLanUrl = (index: number) => {
  if (form.value.backupLanUrls) {
    form.value.backupLanUrls.splice(index, 1);
  }
};

const isValidUrl = (url: string) => {
  if (!url) return true; // allow empty for now? No, required if item exists?
  // User said: Address field RFC 3986 validation.
  // Simple regex
  return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(url);
};

const focusNextInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const parent = target.parentElement?.parentElement;
  if (parent) {
    const inputs = parent.querySelectorAll("input");
    if (inputs.length > 1 && inputs[0] === target && inputs[1]) {
      (inputs[1] as HTMLElement).focus();
      event.preventDefault();
    }
  }
};

const close = (reason: DirtyCloseReason = "programmatic") => {
  if (reason === "overlay" && Date.now() - modalOpenedAt.value < 350) {
    return;
  }
  requestClose(reason);
};

const handleEditDismissAttempt = (reason: DirtyCloseReason) => {
  if (reason === "overlay" && Date.now() - modalOpenedAt.value < 350) {
    return;
  }
  handleDismissAttempt(reason);
};

const discardChanges = () => {
  finalizeClose();
};

// 处理图标加载错误
const iconInputFocused = ref(false);
const isImgError = ref(false);

const processIconError = () => {
  const val = form.value.icon;
  if (
    val &&
    val.startsWith("http") &&
    !val.includes("simpleicons.org") &&
    !val.includes("/api/site/icon")
  ) {
    try {
      const urlObj = new URL(val);
      form.value.icon = getSiteIconUrl(urlObj.origin);
      return;
    } catch {
      // ignore
    }
  }
  // 否则直接清空
  form.value.icon = "";
};

const onIconInputBlur = () => {
  iconInputFocused.value = false;
  // 失去焦点时，如果有错误，尝试修正
  if (isImgError.value) {
    processIconError();
  }
};

const saveIconToLocal = ref(true);
const isSaving = ref(false);

// Icon upload embedded in preview
const iconFileInput = ref<HTMLInputElement | null>(null);
const showIconCropper = ref(false);
const iconUploadImgUrl = ref("");
const iconCropperRef = ref<VueCropperHandle | null>(null);
const iconZoom = ref(1);
const iconCropperBaseScale = ref(1);
const isIconCropperReady = ref(false);

const triggerIconUpload = () => {
  iconFileInput.value?.click();
};

const onIconFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    uiFeedback.notify({
      title: "图片过大",
      message: "请上传小于 5MB 的图片。",
      tone: "warning",
    });
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    iconUploadImgUrl.value = e.target?.result as string;
    iconZoom.value = 1;
    iconCropperBaseScale.value = 1;
    isIconCropperReady.value = false;
    showIconCropper.value = true;
  };
  reader.readAsDataURL(file);
  if (iconFileInput.value) iconFileInput.value.value = "";
};

const onIconZoomChange = (e: Event) => {
  const newVal = parseFloat((e.target as HTMLInputElement).value);
  if (!Number.isFinite(newVal)) return;
  const result = applyCropperZoom(
    iconCropperRef.value,
    iconZoom.value,
    newVal,
    iconCropperBaseScale.value,
  );
  iconZoom.value = result.zoom;
};

const onIconCropperLoad = (status: string) => {
  if (status !== "success") {
    isIconCropperReady.value = false;
    return;
  }
  iconCropperBaseScale.value = readCropperScale(iconCropperRef.value) ?? 1;
  iconZoom.value = 1;
  isIconCropperReady.value = true;
};

const confirmIconCrop = () => {
  if (!iconCropperRef.value?.getCropData) return;
  iconCropperRef.value.getCropData((data: string) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 216;
      canvas.height = 216;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, 216, 216);
        form.value.icon = canvas.toDataURL("image/png");
      } else {
        form.value.icon = data;
      }
      showIconCropper.value = false;
    };
    img.src = data;
  });
};

// 提交保存
const submit = async () => {
  if (!form.value.title && !form.value.url) {
    uiFeedback.notify({
      title: "无法保存",
      message: "标题和链接至少需要填写一项。",
      tone: "warning",
    });
    return;
  }

  isSaving.value = true;
  try {
    form.value.iconAutoBackgroundColor =
      normalizeIconBackgroundColor(form.value.iconAutoBackgroundColor) || "";
    form.value.iconCustomBackgroundColor =
      normalizeIconBackgroundColor(form.value.iconCustomBackgroundColor) || "";
    if (
      form.value.iconBackgroundMode === "custom" &&
      !form.value.iconCustomBackgroundColor
    ) {
      form.value.iconBackgroundMode = "auto";
    }

    if (saveIconToLocal.value) {
      const icon = (form.value.icon || "").trim();
      if (icon) {
        const cached = await cacheIconToLocal(icon);
        if (cached.path) {
          form.value.icon = cached.path;
        } else if (cached.error) {
          void uiFeedback.alert({
            title: "图标本地缓存失败",
            message: `${cached.error}\n将保留当前图标继续保存。`,
            tone: "warning",
          });
        }
      }
    }

    const payload = {
      item: { ...form.value, id: props.data?.id },
      groupId: localGroupId.value || props.groupId,
    };

    if (props.onSave) {
      await props.onSave(payload);
    } else {
      emit("save", payload);
    }

    initialFormSnapshot.value = serializeFormState();
    finalizeClose();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "";
    void uiFeedback.alert({
      title: "保存失败",
      message: message || "保存失败，请重试",
      tone: "danger",
    });
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <AppModalShell
    :show="show"
    :z-index="130"
    :close-on-overlay="!isDirty"
    :close-on-escape="!isDirty"
    overlay-class="edit-card-overlay"
    panel-class="edit-card-panel"
    surface-class="edit-card-surface"
    :title="editModalTitle"
    scheme="auto"
    body-class="edit-card-body"
    footer-class="edit-card-footer"
    :show-close="false"
    @close="(reason) => close(reason || 'programmatic')"
    @dismiss-attempt="handleEditDismissAttempt"
  >
    <template #headerActions>
      <div class="edit-card-header-actions">
        <AppWindowControls
          class="edit-card-window-controls"
          aria-label="编辑卡片窗口控制"
          close-label="关闭编辑卡片"
          @close="close()"
        />
      </div>
    </template>

    <div class="edit-card-layout">
      <aside class="edit-card-preview-pane">
        <div class="edit-card-preview-title">卡片预览</div>
        <div class="edit-card-preview-card">
          <button
            type="button"
            class="edit-card-preview-open"
            title="打开链接"
            aria-label="打开链接"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M14 5h5v5m0-5L10 14m-5 5h14"
              />
            </svg>
          </button>
          <div class="edit-card-preview-main">
            <div
              class="edit-card-preview-icon"
              :class="{ 'is-empty': !cardPreviewIcon || isIconHidden }"
            >
              <IconShape
                v-if="cardPreviewIcon && !isIconHidden"
                :shape="effectiveIconShape"
                :size="78"
                :imgScale="form.iconSize"
                :bgClass="iconBackgroundResolution.color"
                :icon="cardPreviewIcon"
              />
              <span v-else>{{ cardPreviewTitle.slice(0, 1) }}</span>
            </div>
            <div class="edit-card-preview-copy">
              <div class="edit-card-preview-name">{{ cardPreviewTitle }}</div>
              <div class="edit-card-preview-public">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="9" stroke-width="2" />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"
                  />
                </svg>
                {{ form.isPublic ? "公开" : "私有" }}
              </div>
              <div class="edit-card-preview-url">{{ cardPreviewUrl }}</div>
            </div>
          </div>
        </div>

        <div class="edit-card-metadata-header">
          <span>已获取的信息</span>
          <span
            class="edit-card-metadata-badge"
            :class="{ 'is-muted': !hasFetchedMetadata }"
          >
            {{ metadataFetchSummary }}
          </span>
        </div>

        <div class="edit-card-metadata-list">
          <div class="edit-card-metadata-row">
            <span class="edit-card-metadata-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 7h6m-7 4h8m-9 8h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
                />
              </svg>
            </span>
            <span class="edit-card-metadata-label">标题</span>
            <span class="edit-card-metadata-value">{{ metadataTitle }}</span>
          </div>
          <div v-if="previewDescription" class="edit-card-metadata-row">
            <span class="edit-card-metadata-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 7h8M8 12h8m-8 5h5M5 3h14v18H5z"
                />
              </svg>
            </span>
            <span class="edit-card-metadata-label">描述</span>
            <span class="edit-card-metadata-value">
              {{ previewDescription }}
            </span>
          </div>
          <div class="edit-card-metadata-row">
            <span class="edit-card-metadata-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16l4-4 3 3 5-6 4 5M5 5h14v14H5z"
                />
              </svg>
            </span>
            <span class="edit-card-metadata-label">图标</span>
            <span class="edit-card-metadata-value">
              <IconShape
                v-if="metadataIcon && !isIconHidden"
                :shape="effectiveIconShape"
                :size="28"
                :imgScale="form.iconSize"
                :bgClass="iconBackgroundResolution.color"
                :icon="metadataIcon"
              />
              <span v-else>未设置</span>
            </span>
          </div>
          <div class="edit-card-metadata-row">
            <span class="edit-card-metadata-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19.07"
                />
              </svg>
            </span>
            <span class="edit-card-metadata-label">链接</span>
            <span class="edit-card-metadata-value">{{ metadataUrl }}</span>
          </div>
        </div>

        <p class="edit-card-metadata-note">
          信息来自公网地址自动获取，描述仅作预览，不会自动写入卡片描述。
        </p>
      </aside>

      <section class="edit-card-form-pane custom-scrollbar">
        <section class="edit-card-section edit-card-section-link">
          <div class="edit-card-section-heading">
            <span class="edit-card-section-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19.07"
                />
              </svg>
            </span>
            <span>链接</span>
          </div>

          <div class="edit-card-field-grid is-link-row">
            <label class="sd-label" for="edit-card-url">
              公网地址 <span class="text-red-500">*</span>
            </label>
            <div class="edit-card-link-match-row">
              <input
                id="edit-card-url"
                v-model="form.url"
                type="text"
                class="sd-input"
                placeholder="https://example.com"
              />
              <AppButton
                variant="primary"
                :busy="isSmartMatching"
                class="edit-card-smart-match-button"
                @click.prevent="runSmartMetadataFetch"
              >
                <span
                  v-if="isSmartMatching"
                  class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"
                ></span>
                <svg
                  v-else
                  class="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                {{ isSmartMatching ? "获取中..." : "自动获取" }}
              </AppButton>
            </div>
          </div>

          <div
            class="edit-card-fetch-state"
            :class="{ 'is-muted': !hasFetchedMetadata }"
          >
            <span class="edit-card-fetch-dot">✓</span>
            <span>{{ metadataFetchSummary }}</span>
          </div>

          <div class="edit-card-field-grid">
            <label class="sd-label" for="edit-card-lan-url">
              内网地址 <span class="text-gray-400 text-xs">(可选)</span>
            </label>
            <input
              id="edit-card-lan-url"
              v-model="form.lanUrl"
              type="text"
              placeholder="例如：http://192.168.1.10:8080"
              class="sd-input"
            />
          </div>

          <AppButton
            v-if="!showExtraLinks"
            variant="secondary"
            class="edit-card-add-links-button"
            @click="openExtraLinks"
          >
            <span>＋</span>
            添加其他地址
          </AppButton>

          <div v-if="showExtraLinks" class="edit-card-extra-links">
            <div class="edit-card-extra-links-head">
              <span>其他地址</span>
              <span>用于公网/内网备用入口，可按需添加多个。</span>
            </div>

            <div class="edit-card-extra-links-block">
              <div class="edit-card-extra-links-title">
                <span>备用公网地址</span>
                <button type="button" @click="addBackupUrl">
                  ＋ 添加备用公网
                </button>
              </div>
              <div
                v-if="form.backupUrls && form.backupUrls.length > 0"
                class="edit-card-backup-list"
              >
                <div
                  v-for="(item, index) in form.backupUrls"
                  :key="'backup-wan-' + index"
                  data-testid="edit-card-backup-url-row"
                  class="edit-card-backup-row"
                >
                  <input
                    v-model="item.name"
                    type="text"
                    maxlength="50"
                    class="sd-input"
                    :class="[
                      form.backupUrls.filter(
                        (i, idx) =>
                          i.name && i.name === item.name && idx !== index,
                      ).length > 0
                        ? 'border-red-300'
                        : 'border-gray-200',
                    ]"
                    placeholder="名称"
                    @keydown.enter.prevent
                    @keydown.tab="focusNextInput($event)"
                  />
                  <input
                    v-model="item.url"
                    type="text"
                    maxlength="500"
                    class="sd-input"
                    :class="
                      isValidUrl(item.url)
                        ? 'border-gray-200'
                        : 'border-red-300 bg-red-50'
                    "
                    placeholder="请输入完整 URL 地址"
                    @keydown.enter.prevent
                  />
                  <button
                    type="button"
                    class="edit-card-remove-link"
                    title="删除"
                    @click="removeBackupUrl(index)"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>

            <div class="edit-card-extra-links-block">
              <div class="edit-card-extra-links-title">
                <span>备用内网地址</span>
                <button type="button" @click="addBackupLanUrl">
                  ＋ 添加备用内网
                </button>
              </div>
              <div
                v-if="form.backupLanUrls && form.backupLanUrls.length > 0"
                class="edit-card-backup-list"
              >
                <div
                  v-for="(item, index) in form.backupLanUrls"
                  :key="'backup-lan-' + index"
                  data-testid="edit-card-backup-lan-url-row"
                  class="edit-card-backup-row"
                >
                  <input
                    v-model="item.name"
                    type="text"
                    maxlength="50"
                    class="sd-input"
                    :class="[
                      form.backupLanUrls.filter(
                        (i, idx) =>
                          i.name && i.name === item.name && idx !== index,
                      ).length > 0
                        ? 'border-red-300'
                        : 'border-gray-200',
                    ]"
                    placeholder="名称"
                    @keydown.enter.prevent
                    @keydown.tab="focusNextInput($event)"
                  />
                  <input
                    v-model="item.url"
                    type="text"
                    maxlength="500"
                    class="sd-input"
                    :class="
                      isValidUrl(item.url)
                        ? 'border-gray-200'
                        : 'border-red-300 bg-red-50'
                    "
                    placeholder="请输入完整 URL 地址"
                    @keydown.enter.prevent
                  />
                  <button
                    type="button"
                    class="edit-card-remove-link"
                    title="删除"
                    @click="removeBackupLanUrl(index)"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="edit-card-section edit-card-section-basic">
          <div class="edit-card-section-heading">
            <span class="edit-card-section-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5h6m-8 4h10M7 13h10m-7 4h4"
                />
              </svg>
            </span>
            <span>基础信息</span>
          </div>

          <div class="edit-card-basic-row">
            <div class="edit-card-field-grid">
              <label class="sd-label" for="edit-card-title">
                标题 <span class="text-red-500">*</span>
              </label>
              <input
                id="edit-card-title"
                v-model="form.title"
                type="text"
                class="sd-input"
                placeholder="例如：我的博客"
              />
            </div>
            <div class="edit-card-public-control">
              <span>公开</span>
              <AppSwitch v-model="form.isPublic" />
            </div>
          </div>

          <details
            v-if="
              !isVertical ||
              form.description1 ||
              form.description2 ||
              form.description3
            "
            class="edit-card-description-details"
          >
            <summary>水平卡片描述</summary>
            <textarea
              v-model="mergedDescription"
              @input="autoResize"
              class="sd-textarea text-sm resize-none overflow-hidden"
              placeholder="第一行（上）
第二行（中）
第三行（下）"
              rows="3"
            ></textarea>
          </details>
        </section>

        <section class="edit-card-section">
          <div class="edit-card-section-heading">
            <span class="edit-card-section-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16l4-4 3 3 5-6 4 5M5 5h14v14H5z"
                />
              </svg>
            </span>
            <span>图标外观</span>
          </div>

          <div class="edit-card-icon-appearance-grid">
            <div class="edit-card-upload-stack">
              <span class="edit-card-control-label">上传图标</span>
              <AppButton
                variant="secondary"
                size="sm"
                data-testid="edit-card-upload-icon"
                @click="triggerIconUpload"
              >
                <svg
                  class="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                  />
                </svg>
                上传图标
              </AppButton>
            </div>

            <div class="edit-card-icon-scale">
              <span class="edit-card-control-label">缩放</span>
              <input
                type="range"
                v-model.number="form.iconSize"
                min="20"
                max="200"
                step="5"
                class="sd-range"
              />
              <span class="edit-card-percent">{{ form.iconSize }}%</span>
            </div>

            <div v-if="!isIconHidden" class="edit-card-icon-bg-control">
              <span class="edit-card-control-label">图标底色</span>
              <div class="edit-card-background-mode">
                <button
                  v-for="mode in iconBackgroundModes"
                  :key="mode.value"
                  type="button"
                  @click="setIconBackgroundMode(mode.value)"
                  :class="
                    (form.iconBackgroundMode || 'auto') === mode.value
                      ? 'is-active'
                      : ''
                  "
                >
                  {{ mode.label }}
                </button>
              </div>
              <div class="edit-card-color-row">
                <button
                  v-for="color in iconBackgroundPresets"
                  :key="color"
                  type="button"
                  class="edit-card-color-swatch"
                  :class="{ 'is-active': iconCustomColorValue === color }"
                  :style="{ backgroundColor: color }"
                  :title="color"
                  @click="setCustomIconBackgroundColor(color)"
                ></button>
                <input
                  :value="iconCustomColorValue"
                  type="color"
                  class="edit-card-color-input"
                  title="选择图标底色"
                  @input="
                    setCustomIconBackgroundColor(
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
              </div>
            </div>
          </div>

          <input
            ref="iconFileInput"
            type="file"
            accept="image/*"
            class="hidden"
            data-testid="edit-card-icon-file-input"
            @change="onIconFileChange"
          />
        </section>

        <section class="edit-card-section edit-card-section-background">
          <div class="edit-card-section-heading">
            <span class="edit-card-section-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16l5-5 4 4 3-3 4 4M5 5h14v14H5z"
                />
              </svg>
            </span>
            <span>卡片背景 <small>（可选）</small></span>
          </div>

          <div class="edit-card-background-uploader">
            <IconUploader
              v-model="form.backgroundImage"
              :crop="false"
              :uploadOnly="true"
              :previewStyle="{
                filter: `blur(${form.backgroundBlur ?? 6}px)`,
                transform: 'scale(1.1)',
              }"
              :overlayStyle="{
                backgroundColor: `rgba(0,0,0,${form.backgroundMask ?? 0.3})`,
              }"
            />
            <p>不上传则使用默认卡片样式</p>
          </div>

          <div
            v-if="form.backgroundImage"
            class="edit-card-background-controls"
          >
            <label>
              <span>模糊半径</span>
              <strong>{{ form.backgroundBlur }}px</strong>
              <input
                type="range"
                v-model.number="form.backgroundBlur"
                min="0"
                max="20"
                step="1"
                class="sd-range"
              />
            </label>
            <label>
              <span>遮罩浓度</span>
              <strong>
                {{ Math.round((form.backgroundMask || 0) * 100) }}%
              </strong>
              <input
                type="range"
                v-model.number="form.backgroundMask"
                min="0"
                max="1"
                step="0.1"
                class="sd-range"
              />
            </label>
            <button
              type="button"
              @click="
                form.backgroundImage = '';
                form.backgroundBlur = 6;
                form.backgroundMask = 0.3;
              "
            >
              移除背景
            </button>
          </div>
        </section>

        <section class="edit-card-section edit-card-section-advanced">
          <details class="edit-card-icon-url-details">
            <summary>分组与高级图标</summary>
            <div class="edit-card-field-grid edit-card-group-field">
              <label class="sd-label">分组</label>
              <GroupSelector v-model="localGroupId" />
            </div>
            <div class="edit-card-icon-url-row">
              <input
                v-model="form.icon"
                type="text"
                placeholder="图片 URL 地址..."
                class="sd-input text-sm edit-card-icon-url-input"
                @focus="iconInputFocused = true"
                @blur="onIconInputBlur"
              />
              <AppButton
                variant="secondary"
                size="sm"
                class="edit-card-icon-candidate-button"
                @click="openCandidateSelection"
              >
                查看候选图标
              </AppButton>
            </div>
          </details>
        </section>
      </section>
    </div>
    <template #footer>
      <AppButton variant="secondary" @click="close()">取消</AppButton>
      <AppButton variant="primary" :busy="isSaving" @click="submit">
        {{ isSaving ? "保存中..." : data ? "保存修改" : "确认添加" }}
      </AppButton>
    </template>

    <Transition
      enter-active-class="transition ease-out duration-150"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="smartMatchToast"
        class="pointer-events-none absolute bottom-20 left-1/2 z-20 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg bg-slate-950/90 px-3 py-2 text-center text-xs font-medium leading-5 text-white shadow-lg ring-1 ring-white/10"
      >
        {{ smartMatchToast }}
      </div>
    </Transition>
    <IconSelectionModal
      v-model:show="showIconSelection"
      :candidates="iconCandidates"
      :title="form.title"
      :source="searchSource"
      @select="onIconSelect"
      @cancel-link="showIconSelection = false"
    />
  </AppModalShell>

  <ConfirmDialog
    v-model:show="showDiscardConfirm"
    title="放弃未保存的修改？"
    message="当前表单存在未保存内容。关闭后本次修改将不会保留。"
    confirm-label="放弃修改"
    cancel-label="继续编辑"
    tone="danger"
    blocking
    @confirm="discardChanges"
    @cancel="showDiscardConfirm = false"
  />

  <!-- Icon Cropper Modal -->
  <AppModalShell
    :show="showIconCropper"
    :z-index="999"
    close-on-overlay
    overlay-class="sd-overlay-strong"
    panel-class="max-w-lg"
    surface-class="sd-compact-window"
    body-class="p-0"
    title="裁剪图标"
    @close="showIconCropper = false"
  >
    <div class="flex h-[500px] flex-col">
      <div class="relative flex-1 bg-gray-900">
        <VueCropper
          ref="iconCropperRef"
          :img="iconUploadImgUrl"
          :autoCrop="true"
          :autoCropWidth="216"
          :autoCropHeight="216"
          :fixed="true"
          :fixedNumber="[1, 1]"
          :centerBox="true"
          outputType="png"
          @img-load="onIconCropperLoad"
        ></VueCropper>
      </div>
      <div
        class="flex items-center gap-3 border-t border-gray-700 bg-gray-800 px-4 py-2"
      >
        <span class="text-xs text-gray-400">🔍</span>
        <input
          type="range"
          min="0.1"
          max="3"
          step="0.1"
          :value="iconZoom"
          @input="onIconZoomChange"
          class="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-600 accent-blue-400"
        />
        <span class="w-10 text-right text-xs font-mono text-gray-400"
          >{{ Math.round(iconZoom * 100) }}%</span
        >
      </div>
    </div>
    <template #footer>
      <AppButton variant="secondary" @click="showIconCropper = false"
        >取消</AppButton
      >
      <AppButton
        variant="primary"
        :disabled="!isIconCropperReady"
        @click="confirmIconCrop"
        >确认使用</AppButton
      >
    </template>
  </AppModalShell>
</template>

<style scoped>
:global(.edit-card-overlay) {
  background: var(--sd-shell-overlay);
  -webkit-backdrop-filter: var(--sd-shell-overlay-filter);
  backdrop-filter: var(--sd-shell-overlay-filter);
}

:global(.edit-card-panel) {
  width: min(1000px, calc(100vw - 32px));
}

:global(.edit-card-panel:focus),
:global(.edit-card-panel:focus-visible) {
  outline: none;
}

:global(.edit-card-surface) {
  overflow: hidden;
  border: 1px solid var(--sd-shell-border);
  border-radius: 18px;
  background: var(--sd-shell-surface);
  box-shadow: var(--sd-shadow-window);
  -webkit-backdrop-filter: var(--sd-shell-surface-filter);
  backdrop-filter: var(--sd-shell-surface-filter);
}

:global(.edit-card-surface > .sd-window-bar) {
  min-height: 56px;
  border-bottom-color: var(--sd-shell-border);
  background: var(--sd-shell-surface-muted);
  padding: 0.68rem 1rem;
}

:global(.edit-card-surface .sd-window-title-layer) {
  align-items: center;
  justify-content: flex-start;
  padding: 0 82px 0 1rem;
}

:global(.edit-card-surface .sd-window-title-stack) {
  width: 100%;
  max-width: 100%;
  text-align: left;
}

:global(.edit-card-surface .sd-window-title) {
  color: var(--sd-shell-text-primary);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0;
}

:global(.edit-card-surface .sd-window-subtitle) {
  overflow: hidden;
  color: var(--sd-shell-text-secondary);
  font-size: 12px;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.edit-card-body) {
  height: min(480px, calc(100dvh - 120px));
  max-height: min(480px, calc(100dvh - 120px));
  overflow: hidden;
  padding: 0;
  color: var(--sd-theme-edit-modal-text-01);
  overscroll-behavior: contain;
}

:global(.edit-card-footer) {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  border-top-color: var(--sd-theme-edit-modal-border-01);
  background: var(--sd-theme-edit-modal-surface-03);
  padding: 10px 18px;
}

.edit-card-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.edit-card-icon-editor {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  align-items: start;
  gap: 12px;
  margin-bottom: 12px;
}

.edit-card-icon-preview {
  display: flex;
  width: 68px;
  height: 68px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--sd-theme-edit-modal-border-02);
  border-radius: 14px;
  background: var(--sd-theme-edit-modal-surface-04);
  box-shadow: 0 6px 14px var(--sd-theme-edit-modal-shadow-01);
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    transform 0.16s ease;
}

.edit-card-icon-preview:hover,
.edit-card-icon-preview:focus-visible {
  border-color: var(--sd-theme-edit-modal-accent-border-01);
  background: var(--sd-theme-edit-modal-accent-surface-01);
  outline: none;
  transform: translateY(-1px);
}

.edit-card-icon-controls {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.edit-card-link-match-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.edit-card-smart-match-button {
  min-height: 36px;
  padding: 0 12px;
  white-space: nowrap;
}

.edit-card-icon-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.edit-card-icon-url-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.edit-card-icon-url-input {
  min-width: 0;
}

.edit-card-icon-candidate-button {
  min-width: 104px;
  white-space: nowrap;
}

.edit-card-header-actions :deep(button:not(.sd-window-control-dot)) {
  border-color: var(--sd-theme-edit-modal-border-03);
  background: var(--sd-theme-edit-modal-surface-05);
  color: var(--sd-theme-edit-modal-text-02);
}

.edit-card-header-actions :deep(button:not(.sd-window-control-dot):hover),
.edit-card-header-actions
  :deep(button:not(.sd-window-control-dot):focus-visible) {
  border-color: var(--sd-theme-edit-modal-accent-border-02);
  background: var(--sd-theme-edit-modal-surface-06);
  color: var(--sd-theme-edit-modal-text-01);
}

.edit-card-header-actions :deep(.bg-gray-50),
.edit-card-header-actions :deep(.bg-gray-100) {
  background: var(--sd-theme-edit-modal-surface-07);
}

.edit-card-header-actions :deep(.text-gray-600),
.edit-card-header-actions :deep(.text-gray-400) {
  color: var(--sd-theme-edit-modal-text-03);
}

:global(.edit-card-surface .sd-label) {
  display: block;
  margin-bottom: 5px;
  color: var(--sd-theme-edit-modal-text-04);
  font-size: 12px;
  font-weight: 800;
  line-height: 16px;
  letter-spacing: 0;
}

:global(.edit-card-surface .sd-input),
:global(.edit-card-surface .sd-textarea),
:global(.edit-card-surface .sd-select) {
  border-color: var(--sd-theme-edit-modal-border-03);
  background: var(--sd-theme-edit-modal-surface-04);
  color: var(--sd-theme-edit-modal-text-01);
  box-shadow: none;
}

:global(.edit-card-surface .sd-input::placeholder),
:global(.edit-card-surface .sd-textarea::placeholder) {
  color: var(--sd-theme-edit-modal-text-05);
}

:global(.edit-card-surface .sd-input:focus),
:global(.edit-card-surface .sd-textarea:focus),
:global(.edit-card-surface .sd-select:focus) {
  border-color: var(--sd-theme-edit-modal-accent-border-03);
  background: var(--sd-theme-edit-modal-surface-06);
  box-shadow: 0 0 0 3px var(--sd-theme-edit-modal-shadow-02);
}

:global(.edit-card-surface .sd-section),
:global(.edit-card-surface .bg-gray-50),
:global(.edit-card-surface [class~="bg-blue-50/70"]),
:global(.edit-card-surface .bg-white),
:global(.edit-card-surface [class~="bg-white/90"]) {
  border-color: var(--sd-theme-edit-modal-border-03);
  background-color: var(--sd-theme-edit-modal-surface-08);
  color: var(--sd-theme-edit-modal-text-01);
  box-shadow: none;
}

:global(.edit-card-surface .border-gray-100),
:global(.edit-card-surface .border-gray-200),
:global(.edit-card-surface .border-slate-200),
:global(.edit-card-surface .border-blue-100) {
  border-color: var(--sd-theme-edit-modal-border-03);
}

:global(.edit-card-surface .text-gray-900),
:global(.edit-card-surface .text-gray-700),
:global(.edit-card-surface .text-gray-600),
:global(.edit-card-surface .text-gray-500) {
  color: var(--sd-theme-edit-modal-text-04);
}

:global(.edit-card-surface .text-gray-400),
:global(.edit-card-surface .text-gray-300) {
  color: var(--sd-theme-edit-modal-text-06);
}

:global(.edit-card-surface .hover\\:text-gray-900:hover),
:global(.edit-card-surface .hover\\:text-gray-600:hover) {
  color: var(--sd-theme-edit-modal-text-01);
}

:global(.edit-card-surface .hover\\:text-red-500:hover),
:global(.edit-card-surface .text-red-500) {
  color: var(--sd-theme-edit-modal-accent-text-01);
}

:global(.edit-card-surface .bg-red-50) {
  background-color: var(--sd-theme-edit-modal-accent-surface-02);
}

:global(.edit-card-surface .border-red-300) {
  border-color: var(--sd-theme-edit-modal-accent-border-04);
}

:global(.edit-card-surface .bg-gray-900) {
  background-color: var(--sd-theme-edit-modal-accent-surface-03);
}

:global(.edit-card-surface .hover\\:bg-gray-50:hover),
:global(.edit-card-surface .hover\\:bg-blue-50:hover),
:global(.edit-card-surface .hover\\:bg-white:hover) {
  background-color: var(--sd-theme-edit-modal-surface-06);
}

:global(.edit-card-surface .hover\\:border-blue-200:hover),
:global(.edit-card-surface .hover\\:border-blue-400:hover) {
  border-color: var(--sd-theme-edit-modal-accent-border-05);
}

:global(.edit-card-surface .sd-range) {
  accent-color: var(--sd-theme-edit-modal-accent-01);
}

:global(.edit-card-surface input[type="color"]) {
  border-color: var(--sd-theme-edit-modal-border-04);
  background: transparent;
}

:global(.edit-card-surface .group:hover .group-hover\\:scale-110) {
  transform: scale(1.08);
}

.edit-card-layout {
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-columns: 340px minmax(0, 1fr);
}

.edit-card-preview-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  border-right: 1px solid var(--sd-theme-edit-modal-border-01);
  padding: 18px 18px 16px;
  background: color-mix(
    in srgb,
    var(--sd-shell-surface-muted) 42%,
    transparent
  );
}

.edit-card-preview-title,
.edit-card-metadata-header {
  color: var(--sd-theme-edit-modal-text-01);
  font-size: 14px;
  font-weight: 800;
  line-height: 20px;
}

.edit-card-preview-card {
  position: relative;
  min-height: 158px;
  overflow: hidden;
  border: 1px solid var(--sd-theme-edit-modal-border-03);
  border-radius: 10px;
  background:
    radial-gradient(
      circle at 70% 30%,
      color-mix(in srgb, var(--sd-state-info) 10%, transparent),
      transparent 34%
    ),
    linear-gradient(
      145deg,
      var(--sd-theme-edit-modal-surface-08),
      var(--sd-theme-edit-modal-surface-04)
    );
  box-shadow: 0 10px 24px color-mix(in srgb, black 9%, transparent);
}

.edit-card-preview-card::before,
.edit-card-preview-card::after {
  position: absolute;
  right: -18%;
  bottom: -38%;
  width: 86%;
  height: 74%;
  border-radius: 999px 0 0 0;
  background: color-mix(in srgb, var(--sd-state-info) 8%, transparent);
  content: "";
  transform: rotate(-10deg);
}

.edit-card-preview-card::after {
  right: -8%;
  bottom: -48%;
  background: color-mix(in srgb, white 42%, transparent);
}

.edit-card-preview-open {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  color: var(--sd-theme-edit-modal-text-03);
}

.edit-card-preview-open svg {
  width: 16px;
  height: 16px;
}

.edit-card-preview-main {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 32px 22px;
}

.edit-card-preview-icon {
  display: flex;
  width: 78px;
  height: 78px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--sd-theme-edit-modal-text-02);
  font-size: 30px;
  font-weight: 800;
}

.edit-card-preview-icon.is-empty {
  border: 1px solid color-mix(in srgb, var(--sd-shell-border) 70%, transparent);
  border-radius: 14px;
  background: var(--sd-theme-edit-modal-surface-08);
  box-shadow: 0 10px 24px color-mix(in srgb, black 10%, transparent);
}

.edit-card-preview-copy {
  min-width: 0;
}

.edit-card-preview-name {
  overflow: hidden;
  color: var(--sd-theme-edit-modal-text-01);
  font-size: 21px;
  font-weight: 800;
  line-height: 27px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-card-preview-public,
.edit-card-preview-url {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: var(--sd-theme-edit-modal-text-03);
  font-size: 12px;
  line-height: 17px;
}

.edit-card-preview-public {
  color: var(--sd-state-success);
  font-weight: 700;
}

.edit-card-preview-public svg {
  width: 14px;
  height: 14px;
}

.edit-card-preview-url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-card-metadata-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.edit-card-metadata-badge {
  max-width: 160px;
  overflow: hidden;
  border-radius: 7px;
  background: color-mix(in srgb, var(--sd-state-success) 14%, transparent);
  color: var(--sd-state-success);
  font-size: 11px;
  font-weight: 800;
  line-height: 20px;
  padding: 0 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-card-metadata-badge.is-muted {
  background: var(--sd-theme-edit-modal-surface-04);
  color: var(--sd-theme-edit-modal-text-03);
}

.edit-card-metadata-list {
  overflow: hidden;
  border: 1px solid var(--sd-theme-edit-modal-border-03);
  border-radius: 10px;
  background: var(--sd-theme-edit-modal-surface-08);
}

.edit-card-metadata-row {
  display: grid;
  grid-template-columns: 20px 44px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  min-height: 42px;
  border-bottom: 1px solid var(--sd-theme-edit-modal-border-03);
  padding: 7px 12px;
}

.edit-card-metadata-row:last-child {
  border-bottom: 0;
}

.edit-card-metadata-icon {
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  color: var(--sd-theme-edit-modal-text-03);
}

.edit-card-metadata-icon svg {
  width: 15px;
  height: 15px;
}

.edit-card-metadata-label {
  color: var(--sd-theme-edit-modal-text-03);
  font-size: 12px;
  font-weight: 800;
}

.edit-card-metadata-value {
  min-width: 0;
  overflow: hidden;
  color: var(--sd-theme-edit-modal-text-02);
  font-size: 12px;
  font-weight: 600;
  line-height: 17px;
  text-overflow: ellipsis;
}

.edit-card-metadata-note {
  margin-top: auto;
  color: var(--sd-theme-edit-modal-text-03);
  font-size: 11px;
  line-height: 18px;
}

.edit-card-form-pane {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
  padding: 14px 14px 18px;
  scrollbar-gutter: stable;
  scrollbar-color: var(--sd-scrollbar-thumb) var(--sd-scrollbar-track);
  scrollbar-width: thin;
}

.edit-card-form-pane::-webkit-scrollbar {
  width: var(--sd-scrollbar-size, 7px);
}

.edit-card-form-pane::-webkit-scrollbar-track {
  border-radius: 999px;
  background: var(--sd-scrollbar-track);
}

.edit-card-form-pane::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--sd-scrollbar-thumb);
}

.edit-card-section {
  border-bottom: 1px solid var(--sd-theme-edit-modal-border-01);
  padding: 14px 8px;
}

.edit-card-section:first-child {
  padding-top: 2px;
}

.edit-card-section:last-child {
  border-bottom: 0;
}

.edit-card-section-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: var(--sd-theme-edit-modal-text-01);
  font-size: 15px;
  font-weight: 800;
  line-height: 21px;
}

.edit-card-section-heading small {
  color: var(--sd-theme-edit-modal-text-03);
  font-size: 12px;
  font-weight: 700;
}

.edit-card-section-icon {
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  color: var(--sd-state-info);
}

.edit-card-section-icon svg {
  width: 17px;
  height: 17px;
}

.edit-card-field-grid {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.edit-card-field-grid + .edit-card-field-grid,
.edit-card-fetch-state + .edit-card-field-grid {
  margin-top: 10px;
}

.edit-card-field-grid.is-link-row {
  align-items: start;
}

.edit-card-fetch-state {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 7px 0 0 92px;
  color: var(--sd-state-success);
  font-size: 12px;
  font-weight: 800;
  line-height: 17px;
}

.edit-card-fetch-state.is-muted {
  color: var(--sd-theme-edit-modal-text-03);
  font-weight: 700;
}

.edit-card-fetch-dot {
  display: inline-flex;
  width: 14px;
  height: 14px;
  align-items: center;
  justify-content: center;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 10px;
  line-height: 1;
}

.edit-card-add-links-button {
  width: calc(100% - 92px);
  margin: 12px 0 0 92px;
  border-style: dashed;
  background: transparent;
}

.edit-card-extra-links {
  display: grid;
  gap: 10px;
  margin: 12px 0 0 92px;
  border: 1px solid var(--sd-theme-edit-modal-border-03);
  border-radius: 10px;
  background: var(--sd-theme-edit-modal-surface-08);
  padding: 10px;
}

.edit-card-extra-links-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--sd-theme-edit-modal-text-03);
  font-size: 12px;
  line-height: 18px;
}

.edit-card-extra-links-head span:first-child,
.edit-card-extra-links-title span {
  color: var(--sd-theme-edit-modal-text-01);
  font-weight: 800;
}

.edit-card-extra-links-block {
  display: grid;
  gap: 8px;
}

.edit-card-extra-links-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.edit-card-extra-links-title button,
.edit-card-remove-link,
.edit-card-smart-candidates-head button,
.edit-card-background-controls button {
  color: var(--sd-theme-edit-modal-text-03);
  font-size: 12px;
  font-weight: 800;
  transition: color 0.16s ease;
}

.edit-card-extra-links-title button:hover,
.edit-card-smart-candidates-head button:hover {
  color: var(--sd-theme-edit-modal-text-01);
}

.edit-card-backup-list {
  display: grid;
  gap: 7px;
}

.edit-card-backup-row {
  display: grid;
  grid-template-columns: minmax(110px, 0.45fr) minmax(0, 1fr) 30px;
  gap: 8px;
  align-items: center;
}

.edit-card-remove-link {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  color: var(--sd-theme-edit-modal-text-06);
  font-size: 22px;
  line-height: 1;
}

.edit-card-remove-link:hover {
  color: var(--sd-theme-edit-modal-accent-text-01);
}

.edit-card-basic-row {
  display: grid;
  grid-template-columns: minmax(0, 390px) minmax(116px, 1fr);
  align-items: end;
  gap: 12px;
}

.edit-card-basic-row .edit-card-field-grid {
  grid-template-columns: 48px minmax(0, 1fr);
}

.edit-card-group-field {
  grid-template-columns: 44px minmax(0, 1fr) !important;
  margin-top: 12px;
}

.edit-card-public-control {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  color: var(--sd-theme-edit-modal-text-01);
  font-size: 13px;
  font-weight: 800;
}

.edit-card-description-details,
.edit-card-icon-url-details {
  margin-top: 10px;
  color: var(--sd-theme-edit-modal-text-03);
  font-size: 12px;
}

.edit-card-description-details summary,
.edit-card-icon-url-details summary {
  cursor: pointer;
  font-weight: 800;
}

.edit-card-description-details .sd-textarea,
.edit-card-icon-url-row {
  margin-top: 8px;
}

.edit-card-icon-appearance-grid {
  display: grid;
  grid-template-columns: 116px 158px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.edit-card-upload-stack,
.edit-card-icon-scale,
.edit-card-icon-bg-control {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.edit-card-control-label {
  color: var(--sd-theme-edit-modal-text-01);
  font-size: 12px;
  font-weight: 800;
}

.edit-card-icon-scale .sd-range {
  width: 100%;
}

.edit-card-percent {
  width: fit-content;
  min-width: 52px;
  border: 1px solid var(--sd-theme-edit-modal-border-03);
  border-radius: 7px;
  background: var(--sd-theme-edit-modal-surface-08);
  color: var(--sd-theme-edit-modal-text-01);
  font-size: 12px;
  font-weight: 800;
  line-height: 28px;
  padding: 0 8px;
  text-align: center;
}

.edit-card-background-mode {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 158px;
  border: 1px solid var(--sd-theme-edit-modal-border-03);
  border-radius: 7px;
  background: var(--sd-theme-edit-modal-surface-04);
  padding: 2px;
}

.edit-card-background-mode button {
  min-height: 28px;
  border-radius: 6px;
  color: var(--sd-theme-edit-modal-text-03);
  font-size: 12px;
  font-weight: 800;
}

.edit-card-background-mode button.is-active {
  border: 1px solid var(--sd-theme-edit-modal-accent-border-03);
  background: color-mix(in srgb, var(--sd-state-info) 12%, transparent);
  color: var(--sd-state-info);
}

.edit-card-color-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.edit-card-color-swatch,
.edit-card-color-input {
  width: 24px;
  height: 24px;
  border: 1px solid var(--sd-theme-edit-modal-border-03);
  border-radius: 6px;
}

.edit-card-color-swatch.is-active {
  box-shadow:
    0 0 0 2px var(--sd-shell-surface),
    0 0 0 4px var(--sd-state-info);
}

.edit-card-color-input {
  overflow: hidden;
  padding: 0;
}

.edit-card-icon-url-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  margin-top: 8px;
}

.edit-card-icon-url-input {
  min-width: 0;
}

.edit-card-icon-candidate-button {
  white-space: nowrap;
}

.edit-card-background-uploader {
  border: 1px dashed var(--sd-theme-edit-modal-border-03);
  border-radius: 10px;
  background: var(--sd-theme-edit-modal-surface-08);
  padding: 6px 8px;
  text-align: center;
}

.edit-card-background-uploader :deep(.h-32) {
  height: 36px;
  border-width: 1px;
  border-radius: 8px;
}

.edit-card-background-uploader :deep(.text-2xl) {
  margin-bottom: 0;
  font-size: 18px;
  line-height: 18px;
}

.edit-card-background-uploader :deep(.text-xs) {
  font-size: 11px;
  line-height: 15px;
}

.edit-card-background-uploader p {
  margin: 3px 0 0;
  color: var(--sd-theme-edit-modal-text-03);
  font-size: 11px;
  font-weight: 700;
}

.edit-card-background-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
  align-items: end;
  gap: 10px;
  margin-top: 10px;
  border: 1px solid var(--sd-theme-edit-modal-border-03);
  border-radius: 10px;
  background: var(--sd-theme-edit-modal-surface-08);
  padding: 10px;
}

.edit-card-background-controls label {
  display: grid;
  gap: 6px;
  color: var(--sd-theme-edit-modal-text-03);
  font-size: 12px;
  font-weight: 800;
}

.edit-card-background-controls label strong {
  color: var(--sd-theme-edit-modal-text-01);
  font-size: 12px;
}

.edit-card-background-controls button {
  color: var(--sd-theme-edit-modal-accent-text-01);
  white-space: nowrap;
}

:global(.edit-card-surface .edit-card-form-pane .sd-label) {
  margin-bottom: 0;
  font-size: 12px;
  line-height: 36px;
}

:global(.edit-card-surface .sd-input),
:global(.edit-card-surface .sd-textarea),
:global(.edit-card-surface .sd-select) {
  min-height: 36px;
}

@media (max-width: 767px) {
  :global(.edit-card-panel) {
    width: min(100vw, calc(100vw - 16px));
  }

  :global(.edit-card-surface) {
    border-radius: 18px;
  }

  :global(.edit-card-surface > .sd-window-bar) {
    align-items: flex-start;
    min-height: 60px;
    padding: 10px 12px 8px;
  }

  :global(.edit-card-surface .sd-window-title-layer) {
    align-items: flex-start;
    justify-content: flex-start;
    padding: 8px 72px 0 12px;
  }

  :global(.edit-card-surface .sd-window-title-stack) {
    align-items: flex-start;
    text-align: left;
  }

  :global(.edit-card-surface .sd-window-subtitle) {
    white-space: normal;
  }

  .edit-card-header-actions {
    justify-content: flex-end;
    gap: 8px;
  }

  .edit-card-icon-editor {
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 10px;
    margin-bottom: 12px;
  }

  .edit-card-icon-preview {
    width: 64px;
    height: 64px;
    border-radius: 13px;
  }

  .edit-card-icon-toolbar {
    gap: 8px;
  }

  .edit-card-link-match-row {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .edit-card-smart-match-button {
    width: 100%;
  }

  .edit-card-icon-url-row {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .edit-card-icon-candidate-button {
    width: 100%;
  }

  .edit-card-window-controls {
    position: absolute;
    top: 14px;
    right: 12px;
  }

  .edit-card-window-controls :deep(.sd-window-control-dot) {
    width: 14px;
    height: 14px;
  }

  :global(.edit-card-body) {
    height: min(560px, calc(100dvh - 164px));
    max-height: min(560px, calc(100dvh - 164px));
  }

  .edit-card-layout {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .edit-card-preview-pane {
    order: 2;
    border-right: 0;
    border-bottom: 1px solid var(--sd-theme-edit-modal-border-01);
    padding: 14px 12px;
  }

  .edit-card-preview-card {
    min-height: 148px;
  }

  .edit-card-preview-main {
    gap: 14px;
    padding: 24px 16px;
  }

  .edit-card-preview-icon {
    width: 68px;
    height: 68px;
    border-radius: 14px;
  }

  .edit-card-preview-name {
    font-size: 19px;
    line-height: 25px;
  }

  .edit-card-form-pane {
    order: 1;
    overflow: visible;
    padding: 10px 10px 14px;
  }

  .edit-card-section {
    padding: 12px 4px;
  }

  .edit-card-field-grid,
  .edit-card-basic-row,
  .edit-card-icon-appearance-grid,
  .edit-card-background-controls {
    grid-template-columns: 1fr;
  }

  .edit-card-basic-row {
    gap: 12px;
  }

  .edit-card-basic-row .edit-card-field-grid,
  .edit-card-group-field {
    grid-template-columns: 1fr !important;
  }

  :global(.edit-card-surface .edit-card-form-pane .sd-label) {
    line-height: 20px;
  }

  .edit-card-fetch-state,
  .edit-card-add-links-button,
  .edit-card-extra-links {
    width: 100%;
    margin-left: 0;
  }

  .edit-card-backup-row {
    grid-template-columns: 1fr 1fr 32px;
  }

  .edit-card-public-control {
    justify-content: space-between;
  }

  :global(.edit-card-footer) {
    flex-direction: row;
    align-items: center;
    padding: 10px 14px;
  }

  :global(.edit-card-footer .sd-btn) {
    flex: 1 1 0;
  }
}
</style>
