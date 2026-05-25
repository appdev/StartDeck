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
import { resolveManagedUrl, toAppUrl } from "@/utils/runtimeUrls";
import { getSiteIconUrl } from "@/utils/siteMetadata";
import {
  normalizeIconBackgroundColor,
  resolveIconBackground,
} from "@/utils/iconAppearance";
import { useUiFeedbackStore } from "@/stores/uiFeedback";
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
const editModalSubtitle = computed(() =>
  props.data ? "调整卡片信息、链接、图标和背景。" : "创建新的快捷卡片。",
);

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

// 辅助函数：从 URL 提取图标名称
const getIconNameFromUrl = (url: string): string => {
  try {
    const parts = url.split("/");
    const lastPart = parts[parts.length - 1];
    if (!lastPart) return url;
    const name = lastPart.split(".")[0] || "";
    return decodeURIComponent(name);
  } catch {
    return url;
  }
};

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
const isIconShapeNone = computed(() => effectiveIconShape.value === "none");
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

const resolveCandidateBackground = (backgroundColor?: string) =>
  resolveIconBackground(
    {
      iconBackgroundMode: "auto",
      iconAutoBackgroundColor: backgroundColor || "",
    },
    {
      fallback: "bg-gray-100",
      shape: effectiveIconShape.value,
    },
  ).color;

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
  selectedSmartMatchCandidateUrl,
  showSmartMatchModal,
  isSmartMatching,
  smartMatchIcons,
  selectSmartMatchCandidate,
  closeSmartMatchModal,
} = useSmartIconMatch({
  form,
  onSelect: onIconSelect,
  notify: showSmartMatchToast,
});

const openCandidateSelection = async () => {
  if (smartMatchCandidates.value.length === 0 && form.value.url) {
    await smartMatchIcons();
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
      nextTick(() => {
        initialFormSnapshot.value = serializeFormState();
      });
    } else {
      modalOpenedAt.value = 0;
      initialFormSnapshot.value = "";
      showDiscardConfirm.value = false;
      clearSmartMatchToast();
    }
  },
  { immediate: true },
);

const addBackupUrl = () => {
  if (!form.value.backupUrls) form.value.backupUrls = [];
  form.value.backupUrls.push({ name: "", url: "" });
};

const removeBackupUrl = (index: number) => {
  if (form.value.backupUrls) {
    form.value.backupUrls.splice(index, 1);
  }
};

const addBackupLanUrl = () => {
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

const handleIconError = () => {
  isImgError.value = true;
  // 如果正在输入，不要打断用户
  if (iconInputFocused.value) return;
  processIconError();
};

const onIconInputBlur = () => {
  iconInputFocused.value = false;
  // 失去焦点时，如果有错误，尝试修正
  if (isImgError.value) {
    processIconError();
  }
};

const onImgLoad = () => {
  isImgError.value = false;
};

const saveIconToLocal = ref(true);
const isSaving = ref(false);

// Icon upload embedded in preview
const iconFileInput = ref<HTMLInputElement | null>(null);
const showIconCropper = ref(false);
const iconUploadImgUrl = ref("");
const iconCropperRef = ref();
const iconZoom = ref(1);

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
    showIconCropper.value = true;
  };
  reader.readAsDataURL(file);
  if (iconFileInput.value) iconFileInput.value.value = "";
};

const onIconZoomChange = (e: Event) => {
  const newVal = parseFloat((e.target as HTMLInputElement).value);
  const diff = newVal - iconZoom.value;
  iconCropperRef.value?.changeScale(diff);
  iconZoom.value = newVal;
};

const confirmIconCrop = () => {
  iconCropperRef.value?.getCropData((data: string) => {
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

type IconCacheErrorResponse = {
  error?: string | { code?: string; message?: string };
  success?: boolean;
  path?: string;
};

const extractIconCacheError = (data: IconCacheErrorResponse | null): string => {
  if (!data) return "图标缓存失败，请稍后重试";
  if (typeof data.error === "string") return data.error;
  if (data.error && typeof data.error.message === "string") {
    const code = typeof data.error.code === "string" ? data.error.code : "";
    const tips: Record<string, string> = {
      invalid_url: "请使用有效的 http/https 图标地址",
      blocked_host: "该地址属于受限内网地址，建议先上传图标再保存",
      icon_too_large: "图标超过 5MB，建议压缩后重试",
      unsupported_icon_type: "仅支持 png/jpg/webp/gif/svg/ico",
      unsafe_svg: "SVG 含高风险脚本内容，请换一个安全图标",
      fetch_failed: "远程图标拉取失败，请检查网络后重试",
    };
    const tip = code && tips[code] ? `（${tips[code]}）` : "";
    return `${data.error.message}${tip}`;
  }
  return "图标缓存失败，请稍后重试";
};

const cacheIconToLocal = async (
  icon: string,
): Promise<{ path: string | null; error: string | null }> => {
  const trimmed = icon.trim();
  if (!trimmed) return { path: null, error: null };
  if (trimmed.startsWith("/icon-cache/")) return { path: trimmed, error: null };

  const iconUrlToDataUrl = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // Support relative local icon paths (e.g. "icons/foo.png" from local matching).
  const normalizeIconUrl = (value: string) => {
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/api/site/icon")) {
      return new URL(
        resolveManagedUrl(value),
        window.location.origin,
      ).toString();
    }
    if (value.startsWith("/icons/"))
      return new URL(toAppUrl(value), window.location.origin).toString();
    if (value.startsWith("icons/"))
      return new URL(toAppUrl(`/${value}`), window.location.origin).toString();
    return "";
  };

  let payload: { dataUrl?: string; url?: string } | null = null;
  if (trimmed.startsWith("data:")) {
    payload = { dataUrl: trimmed };
  } else {
    const normalized = normalizeIconUrl(trimmed);
    if (normalized) {
      if (
        trimmed.startsWith("icons/") ||
        trimmed.startsWith("/icons/") ||
        trimmed.startsWith("/api/site/icon")
      ) {
        // 同源图标先转成 dataUrl，避免后端抓取本机地址时被拦截。
        const dataUrl = await iconUrlToDataUrl(normalized);
        payload = dataUrl ? { dataUrl } : null;
      } else {
        payload = { url: normalized };
      }
    }
  }

  if (!payload)
    return {
      path: null,
      error: "图标地址格式不支持本地缓存，请改为上传图片或使用 http/https 链接",
    };

  try {
    const res = await fetch("/api/icon-cache", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { path: null, error: extractIconCacheError(data) };
    if (data && data.success && typeof data.path === "string" && data.path) {
      return { path: data.path, error: null };
    }
    return { path: null, error: extractIconCacheError(data) };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "";
    return { path: null, error: message || "图标缓存请求失败，请稍后重试" };
  }
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
      if (icon && !icon.startsWith("/icon-cache/")) {
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
    :z-index="70"
    :close-on-overlay="!isDirty"
    :close-on-escape="!isDirty"
    overlay-class="edit-card-overlay"
    panel-class="edit-card-panel"
    surface-class="edit-card-surface"
    :title="editModalTitle"
    :subtitle="editModalSubtitle"
    scheme="auto"
    body-class="edit-card-body"
    footer-class="edit-card-footer"
    :show-close="false"
    @close="(reason) => close(reason || 'programmatic')"
    @dismiss-attempt="handleEditDismissAttempt"
  >
    <template #headerActions>
      <div class="edit-card-header-actions">
        <GroupSelector v-model="localGroupId" />
        <AppSwitch v-model="form.isPublic" label="公开" />
        <AppWindowControls
          class="edit-card-window-controls"
          aria-label="编辑卡片窗口控制"
          close-label="关闭编辑卡片"
          @close="close()"
        />
      </div>
    </template>

    <div class="flex gap-3">
      <div class="flex-1">
        <label class="sd-label">标题 <span class="text-red-500">*</span></label>
        <div class="relative">
          <input
            v-model="form.title"
            type="text"
            class="sd-input"
            placeholder="例如：我的博客"
          />
        </div>
      </div>
      <div>
        <label class="sd-label">标题颜色</label>
        <div
          class="flex items-center h-10 px-2 border border-slate-200 rounded-lg bg-white"
        >
          <input
            v-model="form.titleColor"
            type="color"
            class="w-8 h-8 rounded cursor-pointer border-none p-0 bg-transparent"
            title="选择标题颜色"
          />
          <button
            v-if="form.titleColor"
            @click="form.titleColor = ''"
            class="ml-2 text-xs text-gray-400 hover:text-red-500"
            title="清除颜色"
          >
            ✕
          </button>
        </div>
      </div>
    </div>

    <div v-if="!isVertical">
      <label class="sd-label">描述 (水平模式显示，每行对应一行文字)</label>
      <textarea
        v-model="mergedDescription"
        @input="autoResize"
        class="sd-textarea text-sm resize-none overflow-hidden"
        placeholder="第一行 (上)
第二行 (中)
第三行 (下)"
        rows="3"
      ></textarea>
    </div>

    <div>
      <label class="sd-label"
        >外网链接 <span class="text-red-500">*</span>
        <button
          @click="addBackupUrl"
          class="ml-2 text-xs text-gray-500 hover:text-gray-900 hover:underline"
          title="添加备用外网地址"
        >
          + 备用地址
        </button>
      </label>
      <div class="relative">
        <input
          v-model="form.url"
          type="text"
          class="sd-input"
          placeholder="https://example.com"
        />
      </div>
      <!-- Backup URLs -->
      <div
        v-if="form.backupUrls && form.backupUrls.length > 0"
        class="space-y-2 mt-2"
      >
        <div
          v-for="(item, index) in form.backupUrls"
          :key="'backup-wan-' + index"
          class="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-2 bg-gray-50 rounded-lg border border-gray-100"
        >
          <!-- Name Field -->
          <div class="relative flex-1 w-full sm:w-auto">
            <input
              v-model="item.name"
              type="text"
              maxlength="50"
              class="sd-input sd-input-action text-sm"
              :class="[
                form.backupUrls.filter(
                  (i, idx) => i.name && i.name === item.name && idx !== index,
                ).length > 0
                  ? 'border-red-300'
                  : 'border-gray-200',
              ]"
              placeholder="名称"
              @keydown.enter.prevent
              @keydown.tab="focusNextInput($event)"
            />
            <button
              v-if="item.name"
              @click="item.name = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 rounded-full p-0.5"
              title="清除"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="w-3 h-3"
              >
                <path
                  d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                />
              </svg>
            </button>
          </div>

          <!-- URL Field -->
          <div class="relative flex-[2] w-full sm:w-auto">
            <input
              v-model="item.url"
              type="text"
              maxlength="500"
              class="sd-input sd-input-action text-sm"
              :class="
                isValidUrl(item.url)
                  ? 'border-gray-200'
                  : 'border-red-300 bg-red-50'
              "
              placeholder="请输入完整URL地址"
              @keydown.enter.prevent
            />
            <button
              v-if="item.url"
              @click="item.url = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 rounded-full p-0.5"
              title="清除"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="w-3 h-3"
              >
                <path
                  d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                />
              </svg>
            </button>
          </div>

          <button
            @click="removeBackupUrl(index)"
            class="text-gray-400 hover:text-red-500 p-2 sm:p-1 self-end sm:self-center"
            title="删除"
          >
            ✕
          </button>
        </div>
      </div>
    </div>

    <div>
      <label class="sd-label"
        >内网链接
        <span class="text-gray-400 text-xs">(选填，内网访问时优先跳转)</span>
        <button
          @click="addBackupLanUrl"
          class="ml-2 text-xs text-gray-500 hover:text-gray-900 hover:underline"
          title="添加备用内网地址"
        >
          + 备用地址
        </button>
      </label>
      <input
        v-model="form.lanUrl"
        type="text"
        placeholder="http://192.168.1.x:8080"
        class="sd-input"
      />
      <!-- Backup LAN URLs -->
      <div
        v-if="form.backupLanUrls && form.backupLanUrls.length > 0"
        class="space-y-2 mt-2"
      >
        <div
          v-for="(item, index) in form.backupLanUrls"
          :key="'backup-lan-' + index"
          class="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-2 bg-gray-50 rounded-lg border border-gray-100"
        >
          <!-- Name Field -->
          <div class="relative flex-1 w-full sm:w-auto">
            <input
              v-model="item.name"
              type="text"
              maxlength="50"
              class="sd-input sd-input-action text-sm"
              :class="[
                form.backupLanUrls.filter(
                  (i, idx) => i.name && i.name === item.name && idx !== index,
                ).length > 0
                  ? 'border-red-300'
                  : 'border-gray-200',
              ]"
              placeholder="名称"
              @keydown.enter.prevent
              @keydown.tab="focusNextInput($event)"
            />
            <button
              v-if="item.name"
              @click="item.name = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 rounded-full p-0.5"
              title="清除"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="w-3 h-3"
              >
                <path
                  d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                />
              </svg>
            </button>
          </div>

          <!-- URL Field -->
          <div class="relative flex-[2] w-full sm:w-auto">
            <input
              v-model="item.url"
              type="text"
              maxlength="500"
              class="sd-input sd-input-action text-sm"
              :class="
                isValidUrl(item.url)
                  ? 'border-gray-200'
                  : 'border-red-300 bg-red-50'
              "
              placeholder="请输入完整URL地址"
              @keydown.enter.prevent
            />
            <button
              v-if="item.url"
              @click="item.url = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 rounded-full p-0.5"
              title="清除"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="w-3 h-3"
              >
                <path
                  d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                />
              </svg>
            </button>
          </div>

          <button
            @click="removeBackupLanUrl(index)"
            class="text-gray-400 hover:text-red-500 p-2 sm:p-1 self-end sm:self-center"
            title="删除"
          >
            ✕
          </button>
        </div>
      </div>
    </div>

    <div>
      <label class="sd-label mb-3">图标</label>

      <div class="edit-card-icon-editor">
        <!-- 预览框 -->
        <button
          type="button"
          class="edit-card-icon-preview"
          aria-label="上传图标"
          title="上传图标"
          @click="triggerIconUpload"
        >
          <IconShape
            v-if="form.icon && !isIconHidden"
            :shape="effectiveIconShape"
            :size="64"
            :imgScale="form.iconSize"
            :bgClass="iconBackgroundResolution.color"
            :icon="form.icon"
            class="transition-transform duration-200"
            @error="handleIconError"
            @load="onImgLoad"
          />
          <span v-else class="text-gray-300 text-xs">{{
            isIconHidden ? "隐藏" : "预览"
          }}</span>
        </button>

        <!-- 操作区 -->
        <div class="edit-card-icon-controls">
          <div class="edit-card-icon-toolbar">
            <button
              type="button"
              @click="saveIconToLocal = !saveIconToLocal"
              class="sd-btn min-h-0 px-3 py-1.5 text-xs"
              :class="saveIconToLocal ? 'sd-btn-primary' : 'sd-btn-secondary'"
            >
              {{ saveIconToLocal ? "已缓存" : "缓存到本地" }}
            </button>
            <button
              type="button"
              class="sd-btn sd-btn-secondary min-h-0 px-3 py-1.5 text-xs shrink-0"
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
                  d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                />
              </svg>
              上传图标
            </button>
            <button
              type="button"
              @click.prevent="smartMatchIcons"
              :disabled="isSmartMatching"
              class="sd-btn min-h-0 px-3 py-1.5 text-xs shrink-0"
              :class="isSmartMatching ? 'sd-btn-secondary' : 'sd-btn-primary'"
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
              {{ isSmartMatching ? "匹配中..." : "智能匹配" }}
            </button>
          </div>

          <div
            v-if="showSmartMatchModal"
            class="sd-section border-blue-100 bg-blue-50/70 px-3 py-2.5"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2 min-w-0">
                <span
                  v-if="isSmartMatching"
                  class="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0"
                ></span>
                <span class="text-xs text-gray-600 truncate">
                  {{
                    isSmartMatching
                      ? "正在抓取图标..."
                      : smartMatchCandidates.length
                        ? "选择一个图标即可应用"
                        : "未找到合适图标"
                  }}
                </span>
              </div>
              <button
                type="button"
                @click="closeSmartMatchModal"
                class="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                title="收起"
              >
                收起
              </button>
            </div>

            <div
              v-if="smartMatchCandidates.length > 0"
              class="mt-2 flex flex-wrap gap-2"
            >
              <button
                v-for="candidate in smartMatchCandidates"
                :key="candidate.url"
                type="button"
                @click="selectSmartMatchCandidate(candidate)"
                :title="candidate.label || getIconNameFromUrl(candidate.url)"
                class="group w-20 h-20 rounded-xl border-2 bg-white/90 hover:border-blue-200 hover:bg-white hover:shadow-sm flex items-center justify-center overflow-hidden transition-all"
                :class="
                  selectedSmartMatchCandidateUrl === candidate.url
                    ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm'
                    : 'border-transparent'
                "
              >
                <IconShape
                  :shape="effectiveIconShape"
                  :size="56"
                  :imgScale="86"
                  :bgClass="
                    resolveCandidateBackground(candidate.backgroundColor)
                  "
                  :icon="candidate.url"
                  class="transition-transform group-hover:scale-110"
                />
              </button>
            </div>

            <div
              v-else-if="!isSmartMatching"
              class="mt-2 text-xs text-gray-400"
            >
              请尝试修改标题、链接，或直接手动上传图标。
            </div>
          </div>

          <!-- 缩放滑块 -->
          <div
            class="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100"
          >
            <span class="text-xs text-gray-400 whitespace-nowrap">缩放</span>
            <input
              type="range"
              v-model.number="form.iconSize"
              min="20"
              max="200"
              step="5"
              class="sd-range flex-1"
            />
            <span class="text-xs text-gray-500 w-8 text-right"
              >{{ form.iconSize }}%</span
            >
          </div>

          <div v-if="!isIconHidden" class="sd-section space-y-2 px-3 py-2.5">
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs text-gray-400 whitespace-nowrap">背景</span>
              <div
                class="flex rounded-lg bg-white border border-gray-200 p-0.5"
              >
                <button
                  v-for="mode in iconBackgroundModes"
                  :key="mode.value"
                  type="button"
                  @click="setIconBackgroundMode(mode.value)"
                  class="px-2 py-1 text-xs rounded-md transition-colors"
                  :class="
                    (form.iconBackgroundMode || 'auto') === mode.value
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:text-gray-900'
                  "
                >
                  {{ mode.label }}
                </button>
              </div>
            </div>

            <div
              v-if="form.iconBackgroundMode === 'custom'"
              class="flex flex-col gap-2"
            >
              <div class="flex flex-wrap items-center gap-2">
                <button
                  v-for="color in iconBackgroundPresets"
                  :key="color"
                  type="button"
                  class="h-5 w-5 shrink-0 rounded-full border transition-all"
                  :class="
                    iconCustomColorValue === color
                      ? 'border-gray-900 ring-2 ring-gray-300'
                      : 'border-gray-200 hover:border-gray-400'
                  "
                  :style="{ backgroundColor: color }"
                  :title="color"
                  @click="setCustomIconBackgroundColor(color)"
                ></button>
              </div>
              <div
                class="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-2"
              >
                <input
                  :value="iconCustomColorValue"
                  type="color"
                  class="h-8 w-8 shrink-0 cursor-pointer rounded border border-gray-200 bg-transparent p-0"
                  title="选择图标背景色"
                  @input="
                    setCustomIconBackgroundColor(
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
                <input
                  :value="iconCustomColorValue"
                  type="text"
                  maxlength="7"
                  class="sd-input min-h-0 w-full min-w-0 px-2 py-1 text-xs"
                  placeholder="#111827"
                  @input="
                    setCustomIconBackgroundColor(
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
              </div>
            </div>

            <div class="text-[11px] leading-4 text-gray-400">
              <span v-if="isIconShapeNone"
                >当前形状不显示背景，颜色会保留供切换形状后使用。</span
              >
              <span v-else-if="iconBackgroundResolution.source === 'auto'"
                >已使用推荐背景色。</span
              >
              <span v-else-if="iconBackgroundResolution.source === 'legacy'"
                >正在读取旧图标背景配置。</span
              >
              <span v-else>未获取到推荐色时使用浅灰背景。</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 图标 URL 输入 -->
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

      <input
        ref="iconFileInput"
        type="file"
        accept="image/*"
        class="hidden"
        data-testid="edit-card-icon-file-input"
        @change="onIconFileChange"
      />
    </div>

    <div class="pt-4 border-t border-gray-100">
      <label class="sd-label"
        >卡片背景
        <span class="text-xs text-gray-400 font-normal"
          >(可选，支持模糊和遮罩效果)</span
        ></label
      >
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <input
            v-model="form.backgroundImage"
            type="text"
            placeholder="背景图 URL..."
            class="sd-input flex-1 text-sm"
          />
          <button
            v-if="form.backgroundImage"
            @click="form.backgroundImage = ''"
            class="text-gray-400 hover:text-red-500 px-2"
            title="清除背景"
          >
            ✕
          </button>
        </div>
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

        <div
          v-if="form.backgroundImage"
          class="sd-section grid grid-cols-2 gap-4 mt-2 p-3"
        >
          <div>
            <label
              class="block text-xs text-gray-500 mb-1 flex justify-between"
            >
              <span>模糊半径</span>
              <span>{{ form.backgroundBlur }}px</span>
            </label>
            <input
              type="range"
              v-model.number="form.backgroundBlur"
              min="0"
              max="20"
              step="1"
              class="sd-range"
            />
          </div>
          <div>
            <label
              class="block text-xs text-gray-500 mb-1 flex justify-between"
            >
              <span>遮罩浓度</span>
              <span>{{ Math.round((form.backgroundMask || 0) * 100) }}%</span>
            </label>
            <input
              type="range"
              v-model.number="form.backgroundMask"
              min="0"
              max="1"
              step="0.1"
              class="sd-range"
            />
          </div>
          <div class="col-span-2 text-right">
            <button
              @click="
                form.backgroundImage = '';
                form.backgroundBlur = 6;
                form.backgroundMask = 0.3;
              "
              class="text-xs text-red-500 hover:text-red-700 underline"
            >
              移除背景
            </button>
          </div>
        </div>
      </div>
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
    <div class="flex h-[500px] flex-col" @mousedown.stop @mouseup.stop>
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
      <AppButton variant="primary" @click="confirmIconCrop">确认使用</AppButton>
    </template>
  </AppModalShell>
</template>

<style scoped>
:global(.edit-card-overlay) {
  background: var(--sd-shell-overlay);
  -webkit-backdrop-filter: blur(10px) saturate(135%) brightness(0.7);
  backdrop-filter: blur(10px) saturate(135%) brightness(0.7);
}

:global(.edit-card-panel) {
  width: min(760px, calc(100vw - 32px));
}

:global(.edit-card-surface) {
  overflow: hidden;
  border: 1px solid var(--sd-shell-border);
  border-radius: 20px;
  background: var(--sd-shell-surface);
  box-shadow: var(--sd-shadow-window);
  -webkit-backdrop-filter: saturate(135%) blur(28px) brightness(0.62);
  backdrop-filter: saturate(135%) blur(28px) brightness(0.62);
}

:global(.edit-card-surface > .sd-window-bar) {
  min-height: 58px;
  border-bottom-color: var(--sd-shell-border);
  background: var(--sd-shell-surface-muted);
  padding: 0.8rem 1rem 0.75rem 1.15rem;
}

:global(.edit-card-surface .sd-window-title-layer) {
  align-items: center;
  justify-content: flex-start;
  padding: 0 320px 0 18px;
}

:global(.edit-card-surface .sd-window-title-stack) {
  width: 100%;
  max-width: 100%;
  text-align: left;
}

:global(.edit-card-surface .sd-window-title) {
  color: var(--sd-shell-text-primary);
  font-size: 15px;
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
  display: grid;
  max-height: min(660px, calc(100vh - 172px));
  gap: 17px;
  overflow-y: auto;
  padding: 18px;
  color: rgb(223, 221, 221);
  overscroll-behavior: contain;
}

:global(.edit-card-body::-webkit-scrollbar) {
  width: 8px;
}

:global(.edit-card-body::-webkit-scrollbar-track) {
  background: rgba(255, 255, 255, 0.04);
}

:global(.edit-card-body::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.24);
}

:global(.edit-card-footer) {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  border-top-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.055);
  padding: 12px 18px;
}

.edit-card-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.edit-card-icon-editor {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  align-items: start;
  gap: 16px;
  margin-bottom: 16px;
}

.edit-card-icon-preview {
  display: flex;
  width: 80px;
  height: 80px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18);
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    transform 0.16s ease;
}

.edit-card-icon-preview:hover,
.edit-card-icon-preview:focus-visible {
  border-color: rgba(24, 144, 255, 0.5);
  background: rgba(24, 144, 255, 0.14);
  outline: none;
  transform: translateY(-1px);
}

.edit-card-icon-controls {
  display: grid;
  min-width: 0;
  gap: 12px;
}

.edit-card-icon-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.edit-card-icon-url-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.edit-card-icon-url-input {
  min-width: 0;
}

.edit-card-icon-candidate-button {
  min-width: 118px;
  white-space: nowrap;
}

.edit-card-header-actions :deep(button) {
  border-color: rgba(255, 255, 255, 0.11);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(223, 221, 221, 0.8);
}

.edit-card-header-actions :deep(button:hover),
.edit-card-header-actions :deep(button:focus-visible) {
  border-color: rgba(24, 144, 255, 0.36);
  background: rgba(255, 255, 255, 0.14);
  color: rgb(223, 221, 221);
}

.edit-card-header-actions :deep(.bg-gray-50),
.edit-card-header-actions :deep(.bg-gray-100) {
  background: rgba(255, 255, 255, 0.12);
}

.edit-card-header-actions :deep(.text-gray-600),
.edit-card-header-actions :deep(.text-gray-400) {
  color: rgba(223, 221, 221, 0.68);
}

:global(.edit-card-surface .sd-label) {
  display: block;
  margin-bottom: 7px;
  color: rgba(223, 221, 221, 0.76);
  font-size: 12px;
  font-weight: 800;
  line-height: 16px;
  letter-spacing: 0;
}

:global(.edit-card-surface .sd-input),
:global(.edit-card-surface .sd-textarea),
:global(.edit-card-surface .sd-select) {
  border-color: rgba(255, 255, 255, 0.11);
  background: rgba(255, 255, 255, 0.1);
  color: rgb(223, 221, 221);
  box-shadow: none;
}

:global(.edit-card-surface .sd-input::placeholder),
:global(.edit-card-surface .sd-textarea::placeholder) {
  color: rgba(223, 221, 221, 0.4);
}

:global(.edit-card-surface .sd-input:focus),
:global(.edit-card-surface .sd-textarea:focus),
:global(.edit-card-surface .sd-select:focus) {
  border-color: rgba(24, 144, 255, 0.52);
  background: rgba(255, 255, 255, 0.14);
  box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.16);
}

:global(.edit-card-surface .sd-section),
:global(.edit-card-surface .bg-gray-50),
:global(.edit-card-surface [class~="bg-blue-50/70"]),
:global(.edit-card-surface .bg-white),
:global(.edit-card-surface [class~="bg-white/90"]) {
  border-color: rgba(255, 255, 255, 0.11);
  background-color: rgba(255, 255, 255, 0.075);
  color: rgb(223, 221, 221);
  box-shadow: none;
}

:global(.edit-card-surface .border-gray-100),
:global(.edit-card-surface .border-gray-200),
:global(.edit-card-surface .border-slate-200),
:global(.edit-card-surface .border-blue-100) {
  border-color: rgba(255, 255, 255, 0.11);
}

:global(.edit-card-surface .text-gray-900),
:global(.edit-card-surface .text-gray-700),
:global(.edit-card-surface .text-gray-600),
:global(.edit-card-surface .text-gray-500) {
  color: rgba(223, 221, 221, 0.76);
}

:global(.edit-card-surface .text-gray-400),
:global(.edit-card-surface .text-gray-300) {
  color: rgba(223, 221, 221, 0.5);
}

:global(.edit-card-surface .hover\\:text-gray-900:hover),
:global(.edit-card-surface .hover\\:text-gray-600:hover) {
  color: rgb(223, 221, 221);
}

:global(.edit-card-surface .hover\\:text-red-500:hover),
:global(.edit-card-surface .text-red-500) {
  color: rgb(255, 143, 151);
}

:global(.edit-card-surface .bg-red-50) {
  background-color: rgba(255, 70, 82, 0.1);
}

:global(.edit-card-surface .border-red-300) {
  border-color: rgba(255, 70, 82, 0.42);
}

:global(.edit-card-surface .bg-gray-900) {
  background-color: rgb(24, 144, 255);
}

:global(.edit-card-surface .hover\\:bg-gray-50:hover),
:global(.edit-card-surface .hover\\:bg-blue-50:hover),
:global(.edit-card-surface .hover\\:bg-white:hover) {
  background-color: rgba(255, 255, 255, 0.14);
}

:global(.edit-card-surface .hover\\:border-blue-200:hover),
:global(.edit-card-surface .hover\\:border-blue-400:hover) {
  border-color: rgba(24, 144, 255, 0.48);
}

:global(.edit-card-surface .sd-range) {
  accent-color: rgb(24, 144, 255);
}

:global(.edit-card-surface input[type="color"]) {
  border-color: rgba(255, 255, 255, 0.16);
  background: transparent;
}

:global(.edit-card-surface .group:hover .group-hover\\:scale-110) {
  transform: scale(1.08);
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
    min-height: 86px;
    padding: 13px 14px 10px;
  }

  :global(.edit-card-surface .sd-window-title-layer) {
    align-items: flex-start;
    justify-content: flex-start;
    padding: 12px 78px 0 0;
  }

  :global(.edit-card-surface .sd-window-title-stack) {
    align-items: flex-start;
    text-align: left;
  }

  :global(.edit-card-surface .sd-window-subtitle) {
    white-space: normal;
  }

  .edit-card-header-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .edit-card-icon-editor {
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 12px;
    margin-bottom: 14px;
  }

  .edit-card-icon-preview {
    width: 72px;
    height: 72px;
    border-radius: 15px;
  }

  .edit-card-icon-toolbar {
    gap: 8px;
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
    top: 16px;
    right: 14px;
  }

  .edit-card-window-controls :deep(.sd-window-control-dot) {
    width: 14px;
    height: 14px;
  }

  :global(.edit-card-body) {
    max-height: min(650px, calc(100dvh - 168px));
    gap: 14px;
    padding: 14px;
  }

  :global(.edit-card-footer) {
    padding: 10px 14px;
  }

  :global(.edit-card-footer .sd-btn) {
    flex: 1 1 0;
  }
}
</style>
