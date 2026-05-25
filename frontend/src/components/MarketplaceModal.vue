<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useMainStore } from "../stores/main";
import type { MarketplaceItem } from "@/types";
import AppModalShell from "@/components/base/AppModalShell.vue";
import StatusBanner from "@/components/base/StatusBanner.vue";
import { useUiFeedbackStore } from "@/stores/uiFeedback";
import { getApiBaseUrl } from "@/utils/runtimeUrls";

const props = withDefaults(
  defineProps<{
    show: boolean;
    zIndex?: number | string;
  }>(),
  {
    zIndex: 50,
  },
);
const emit = defineEmits(["update:show"]);
const store = useMainStore();
const uiFeedback = useUiFeedbackStore();

const defaultUrl = "http://qdnas.icu:23111/";
const isLocalLikeHost = (hostname: string) => {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  );
};
const openUrl = computed(() => {
  const input = (store.appConfig.marketplaceListUrl || defaultUrl).trim();
  try {
    const parsed = new URL(input);
    return parsed.toString();
  } catch {
    return input;
  }
});
const isUpgradedToHttps = computed(() => {
  if (typeof window === "undefined") return false;
  try {
    const parsed = new URL(openUrl.value);
    return (
      window.location.protocol === "https:" &&
      parsed.protocol === "http:" &&
      !isLocalLikeHost(parsed.hostname)
    );
  } catch {
    return false;
  }
});
const iframeUrl = computed(() => {
  if (!isUpgradedToHttps.value) return openUrl.value;
  try {
    const parsed = new URL(openUrl.value);
    parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return openUrl.value;
  }
});
const iframeRef = ref<HTMLIFrameElement | null>(null);

const showConfirm = (title: string, message: string): Promise<boolean> => {
  return uiFeedback.confirm({
    title,
    message,
    confirmLabel: "确认安装",
    cancelLabel: "取消",
    blocking: true,
  });
};

const showSuccess = (title: string, message: string) => {
  uiFeedback.notify({ title, message, tone: "success" });
};

const showError = (title: string, message: string) => {
  void uiFeedback.alert({ title, message, tone: "danger" });
};

// ─── postMessage handshake ────────────────────────────────────────────────────
const onIframeLoad = () => {
  if (iframeRef.value?.contentWindow) {
    iframeRef.value.contentWindow.postMessage(
      {
        type: "STARTDECK_INFO",
        payload: {
          origin: window.location.origin,
          apiBase: getApiBaseUrl(),
          version: store.currentVersion || "unknown",
        },
      },
      new URL(iframeUrl.value).origin,
    );
  }
};

const handleMessage = async (event: MessageEvent) => {
  // Validate origin
  try {
    const allowedOrigin = new URL(iframeUrl.value).origin;
    if (event.origin !== allowedOrigin) return;
  } catch {
    return;
  }

  const { type, payload } = event.data as {
    type?: string;
    payload?: MarketplaceItem;
  };
  if (type !== "INSTALL_COMPONENT" || !payload) return;

  const item = payload;

  // JS disclaimer check — use component dialog instead of native confirm()
  if (item.js && !store.appConfig.customJsDisclaimerAgreed) {
    const ok = await showConfirm(
      "安全提示",
      `组件 "${item.name}" 包含自定义 JavaScript 脚本。\n自定义脚本具有较高权限，可能存在安全风险。\n\n请确认您信任该组件来源，是否继续安装？`,
    );
    if (!ok) return;
    store.appConfig.customJsDisclaimerAgreed = true;
  }

  try {
    store.applyMarketplaceItem(item);
    showSuccess("安装成功", `组件 "${item.name}" 已添加到仪表盘。`);
    if (event.source) {
      (event.source as Window).postMessage(
        { type: "INSTALL_SUCCESS", id: item.id },
        event.origin,
      );
    }
  } catch (e) {
    showError("安装失败", e instanceof Error ? e.message : String(e));
  }
};

onMounted(() => window.addEventListener("message", handleMessage));
onUnmounted(() => window.removeEventListener("message", handleMessage));
</script>

<template>
  <AppModalShell
    :show="props.show"
    :z-index="props.zIndex"
    close-on-overlay
    close-on-escape
    overlay-class="sd-overlay-strong p-3 md:p-4"
    panel-class="w-full max-w-5xl max-h-[85vh]"
    title="组件商城"
    body-class="flex min-h-0 flex-1 flex-col p-0"
    @update:show="emit('update:show', $event)"
  >
    <template #headerActions>
      <a
        :href="openUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-sm text-[var(--sd-color-accent-primary)] hover:text-[var(--sd-color-accent-primary-hover)]"
      >
        <span>在新窗口打开</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    </template>

    <StatusBanner
      v-if="isUpgradedToHttps"
      title="混合内容提醒"
      message="当前通过 HTTPS 访问。为避免浏览器拦截 HTTP 内嵌页面，已尝试用 HTTPS 加载组件商城；若页面空白或打不开，请改用右上角的新窗口打开。"
      tone="warning"
      class="mx-6 mt-6"
    />

    <div class="flex min-h-0 flex-1 bg-[var(--sd-color-surface-muted)]">
      <iframe
        ref="iframeRef"
        :src="iframeUrl"
        @load="onIframeLoad"
        class="min-h-[520px] w-full border-0 bg-[var(--sd-color-surface)]"
        allowfullscreen
        allow="clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
      ></iframe>
    </div>
  </AppModalShell>
</template>
