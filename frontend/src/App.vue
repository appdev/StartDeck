<script setup lang="ts">
import { onMounted, watch, computed, ref } from "vue";
import GridPanel from "./components/GridPanel.vue";
import WidgetCatalogPreviewFrame from "@/components/WidgetCatalogPreviewFrame.vue";
import NetworkIndicator from "./components/NetworkIndicator.vue";
import AppButton from "@/components/base/AppButton.vue";
import AppModalShell from "@/components/base/AppModalShell.vue";
import ConfirmDialog from "@/components/base/ConfirmDialog.vue";
import StatusBanner from "@/components/base/StatusBanner.vue";
import ToastHost from "@/components/base/ToastHost.vue";
import { useMainStore } from "./stores/main";
import { useUiFeedbackStore } from "./stores/uiFeedback";
import { useThemeMode } from "@/composables/useThemeMode";
import type { CustomScript } from "@/types";
import { useWindowScroll, useWindowSize } from "@vueuse/core";

const store = useMainStore();
const uiFeedback = useUiFeedbackStore();
useThemeMode(() => store.appConfig.themeMode);
const { y } = useWindowScroll();
const { width: windowWidth, height: windowHeight } = useWindowSize();
const GLOBAL_FEEDBACK_MODAL_Z_INDEX = 1000;

const showBackToTop = computed(() => y.value > windowHeight.value);
const saveErrorMessage = ref("");
const isWidgetPreviewRoute = computed(
  () =>
    typeof window !== "undefined" &&
    window.location.pathname === "/widget-preview",
);
const isStandaloneRoute = computed(() => isWidgetPreviewRoute.value);
let saveErrorTimer: number | null = null;

const pushSaveError = (message: string) => {
  saveErrorMessage.value = message;
  if (saveErrorTimer) {
    window.clearTimeout(saveErrorTimer);
  }
  saveErrorTimer = window.setTimeout(() => {
    saveErrorMessage.value = "";
    saveErrorTimer = null;
  }, 6000);
};
// Auto-detect ultrawide screen
const checkUltrawide = () => {
  if (!store.appConfig.autoUltrawide) {
    store.isExpandedMode = false;
    return;
  }

  const windowRatio = windowWidth.value / windowHeight.value;
  const screenRatio = window.screen.width / window.screen.height;
  // 21:9 ≈ 2.33, 32:9 ≈ 3.55
  // Consider ultrawide if either ratio > 2.3
  store.isExpandedMode = windowRatio > 2.3 || screenRatio > 2.3;
};

// Check on resize and config change
watch(
  [windowWidth, windowHeight, () => store.appConfig.autoUltrawide],
  () => {
    checkUltrawide();
  },
  { immediate: true },
);

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};

watch(
  () => store.appConfig.customTitle,
  (newTitle) => {
    document.title = newTitle || "StartDeck";
  },
  { immediate: true },
);

watch(
  () => store.appConfig.customCss,
  (newCss) => {
    const raw = String(newCss || "");
    const build = (input: string) => {
      const src = String(input || "");
      const re =
        /\/\*\s*@(?<tag>[a-zA-Z_-]+)\s*\*\/([\s\S]*?)\/\*\s*@end\s*\*\//g;
      const blocks: Array<{ tag: string; body: string }> = [];
      const base = src.replace(re, (...args) => {
        const groups = args[args.length - 1] as { tag?: string } | undefined;
        const tag = String(groups?.tag || "").toLowerCase();
        const body = String(args[1] || "");
        if (tag) blocks.push({ tag, body });
        return "";
      });

      const extra = blocks
        .map((b) => {
          const body = String(b.body || "").trim();
          if (!body) return "";
          if (b.tag === "mobile")
            return `@media (max-width: 768px) {\n${body}\n}`;
          if (b.tag === "desktop")
            return `@media (min-width: 769px) {\n${body}\n}`;
          if (b.tag === "dark")
            return `@media (prefers-color-scheme: dark) {\n${body}\n}`;
          if (b.tag === "light")
            return `@media (prefers-color-scheme: light) {\n${body}\n}`;
          return body;
        })
        .filter(Boolean)
        .join("\n\n");

      return [base.trim(), extra.trim()].filter(Boolean).join("\n\n");
    };

    const css = build(raw);
    let style = document.getElementById(
      "custom-css",
    ) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "custom-css";
      document.head.appendChild(style);
    }
    style.textContent = css;
  },
  { immediate: true },
);

type CustomHooks = {
  init?: (ctx: CustomCtx) => void | Promise<void>;
  update?: (ctx: CustomCtx) => void | Promise<void>;
  destroy?: (ctx: CustomCtx) => void | Promise<void>;
};

// Readonly view of the store exposed to custom scripts.
// Only data properties are exposed — no mutation methods.
type ReadonlyCtxStore = {
  readonly widgets: ReturnType<typeof useMainStore>["widgets"];
  readonly groups: ReturnType<typeof useMainStore>["groups"];
  readonly appConfig: ReturnType<typeof useMainStore>["appConfig"];
  readonly isLogged: boolean;
  readonly currentVersion: string | undefined;
};

type CustomCtx = {
  store: ReadonlyCtxStore;
  root: HTMLElement | null;
  query: (selector: string) => Element | null;
  queryAll: (selector: string) => Element[];
  widgetEl: (id: string) => HTMLElement | null;
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onCleanup: (fn: () => void) => void;
  on: (type: string, handler: (ev: CustomEvent) => void) => () => void;
  emit: (type: string, detail?: unknown) => void;
};

// How long to wait (ms) before triggering the update() hook after a DOM mutation.
const UPDATE_DEBOUNCE_MS = 300;

const customJsRuntime = (() => {
  const scriptClass = "custom-js-injected";
  const cleanupFns: Array<() => void> = [];
  let hooks: CustomHooks | null = null;
  let observer: MutationObserver | null = null;
  let updateTimer: number | null = null;
  let pendingRegister: CustomHooks | null = null;
  let currentNonce = 0;

  const getRoot = () =>
    (document.getElementById("app") as HTMLElement | null) || null;
  const clearUpdateTimer = () => {
    if (updateTimer) window.clearTimeout(updateTimer);
    updateTimer = null;
  };

  // Read-only store proxy: exposes data but hides all action methods.
  const readonlyStore: ReadonlyCtxStore = {
    get widgets() {
      return store.widgets;
    },
    get groups() {
      return store.groups;
    },
    get appConfig() {
      return store.appConfig;
    },
    get isLogged() {
      return store.isLogged;
    },
    get currentVersion() {
      return store.currentVersion;
    },
  };

  // ctx.fetch: auto-proxies cross-origin requests through /proxy?url=
  const ctxFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    try {
      const urlStr =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      if (urlStr.startsWith("http")) {
        const parsed = new URL(urlStr);
        if (parsed.hostname !== window.location.hostname) {
          return await window.fetch(
            "/proxy?url=" + encodeURIComponent(urlStr),
            init,
          );
        }
      }
    } catch {
      /* fall through to normal fetch */
    }
    return window.fetch(input, init);
  };

  const ctx: CustomCtx = {
    store: readonlyStore,
    get root() {
      return getRoot();
    },
    query(selector: string) {
      return getRoot()?.querySelector(selector) || null;
    },
    queryAll(selector: string) {
      return Array.from(getRoot()?.querySelectorAll(selector) || []);
    },
    widgetEl(id: string) {
      return document.getElementById(`widget-${id}`) as HTMLElement | null;
    },
    fetch: ctxFetch,
    onCleanup(fn: () => void) {
      if (typeof fn === "function") cleanupFns.push(fn);
    },
    on(type: string, handler: (ev: CustomEvent) => void) {
      const t = `startdeck:${type}`;
      const wrapped = (e: Event) => handler(e as CustomEvent);
      window.addEventListener(t, wrapped as EventListener);
      const off = () => window.removeEventListener(t, wrapped as EventListener);
      cleanupFns.push(off);
      return off;
    },
    emit(type: string, detail?: unknown) {
      window.dispatchEvent(new CustomEvent(`startdeck:${type}`, { detail }));
    },
  };

  const removeScripts = () => {
    document.querySelectorAll(`.${scriptClass}`).forEach((el) => el.remove());
  };

  const doDestroy = async () => {
    clearUpdateTimer();
    if (observer) observer.disconnect();
    observer = null;
    try {
      await hooks?.destroy?.(ctx);
    } catch (e) {
      console.error("Custom JS destroy failed:", e);
    }
    hooks = null;
    while (cleanupFns.length) {
      const fn = cleanupFns.pop();
      try {
        fn?.();
      } catch {
        /* ignore cleanup errors */
      }
    }
    removeScripts();
  };

  const scheduleUpdate = () => {
    clearUpdateTimer();
    updateTimer = window.setTimeout(async () => {
      updateTimer = null;
      try {
        await hooks?.update?.(ctx);
      } catch (e) {
        console.error("Custom JS update failed:", e);
      }
    }, UPDATE_DEBOUNCE_MS);
  };

  const ensureObserver = () => {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (!hooks?.update) return;
      scheduleUpdate();
    });
    // Observe only childList + subtree to reduce noise; attribute changes excluded.
    observer.observe(getRoot() || document.body, {
      subtree: true,
      childList: true,
    });
    cleanupFns.push(() => observer?.disconnect());
  };

  const setRegister = () => {
    const w = window as unknown as Record<string, unknown>;
    if (typeof w.StartDeckCustomRegister === "function") return;
    w.StartDeckCustomRegister = (h: unknown) => {
      if (!h || typeof h !== "object") return;
      pendingRegister = h as CustomHooks;
    };
  };

  const adoptHooks = async (h: CustomHooks | null) => {
    hooks = h;
    if (!hooks) return;
    try {
      await hooks.init?.(ctx);
    } catch (e) {
      console.error("Custom JS init failed:", e);
    }
    ensureObserver();
    scheduleUpdate();
  };

  const apply = async (input: string | CustomScript[]) => {
    currentNonce++;
    const nonce = currentNonce;
    await doDestroy();
    setRegister();
    pendingRegister = null;

    const w = window as unknown as Record<string, unknown>;
    w.StartDeckCustomCtx = ctx;

    let scripts: CustomScript[] = [];
    if (Array.isArray(input)) {
      scripts = input.filter((s) => s.enable && s.content.trim());
    } else {
      const s = String(input || "").trim();
      if (s)
        scripts.push({
          id: "legacy",
          name: "Legacy Script",
          content: s,
          enable: true,
        });
    }

    if (scripts.length === 0) return;

    // Track how many async module scripts are still loading.
    // Non-module scripts execute synchronously on append so they count as 0 async.
    let pendingModuleCount = 0;
    let nonModuleScriptAppended = false;

    const tryAdopt = () => {
      if (nonce !== currentNonce) return;
      const fallback = (w.StartDeckCustom as CustomHooks | undefined) || null;
      const next = (pendingRegister || fallback) as CustomHooks | null;
      pendingRegister = null;
      void adoptHooks(next);
    };

    const onModuleLoaded = () => {
      pendingModuleCount--;
      if (pendingModuleCount === 0) tryAdopt();
    };

    scripts.forEach((item) => {
      const src = item.content;
      const looksModule =
        /^\s*\/\/\s*@module\b/m.test(src) ||
        /(^|\n)\s*import\s.+from\s+["'][^"']+["']/m.test(src) ||
        /(^|\n)\s*export\s+/m.test(src);

      const script = document.createElement("script");
      script.className = scriptClass;

      // Suffix lets module scripts self-register via StartDeckCustomRegister(StartDeckCustom).
      const suffix =
        "\n;globalThis.StartDeckCustomRegister?.(globalThis.StartDeckCustom);";

      if (looksModule) {
        script.type = "module";
        script.textContent = `${src}${suffix}`;
        // For module scripts, the `load` event fires after top-level execution — reliable timing.
        pendingModuleCount++;
        script.addEventListener("load", onModuleLoaded);
        script.addEventListener("error", onModuleLoaded);
      } else {
        // Build a local `fetch` override if useProxy is enabled.
        let proxyCode = "";
        if (item.useProxy) {
          proxyCode = `
const originalFetch = window.fetch;
const fetch = async (input, init) => {
  try {
    if (typeof input === 'string' && input.startsWith('http')) {
      const url = new URL(input);
      if (url.hostname !== window.location.hostname) {
        return await originalFetch('/proxy?url=' + encodeURIComponent(input), init);
      }
    }
  } catch (e) {}
  return originalFetch(input, init);
};`;
        }
        const wrapped = `;(async () => {\n${proxyCode}\ntry {\n${src}\n} catch (e) {\nconsole.error('[StartDeck Custom JS: ${item.name}]', e);\n}\n})();`;
        script.textContent = `${wrapped}${suffix}`;
        nonModuleScriptAppended = true;
      }

      script.onerror = (e) =>
        console.error(`[StartDeck Custom JS: ${item.name}] load error:`, e);
      document.body.appendChild(script);
    });

    if (pendingModuleCount === 0) {
      // No module scripts (or none at all) — non-module scripts ran synchronously.
      if (nonModuleScriptAppended || scripts.length === 0) {
        window.setTimeout(tryAdopt, 0);
      }
    }
    // If pendingModuleCount > 0, adoption is triggered by onModuleLoaded callbacks.
  };

  return { apply, destroy: doDestroy };
})();

watch(
  [() => store.appConfig.customJs, () => store.appConfig.customJsList],
  ([newJs, newList]) => {
    if (newList && newList.length > 0) {
      void customJsRuntime.apply(newList);
    } else {
      void customJsRuntime.apply(String(newJs || ""));
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (isStandaloneRoute.value) {
    return;
  }

  store.initGlobalDrag();
  const win = window as Window & { __startdeckSaveFetchWrapped?: boolean };
  if (!win.__startdeckSaveFetchWrapped) {
    const originalFetch = window.fetch.bind(window);
    win.__startdeckSaveFetchWrapped = true;
    window.fetch = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const resolveUrl = () => {
        if (typeof input === "string") return input;
        if (input instanceof URL) return input.href;
        return input.url;
      };
      const rawUrl = resolveUrl();
      let isSaveRequest = false;
      try {
        const url = rawUrl.startsWith("http")
          ? new URL(rawUrl)
          : new URL(rawUrl, window.location.origin);
        isSaveRequest = url.pathname === "/api/save";
      } catch {
        isSaveRequest = rawUrl.includes("/api/save");
      }
      try {
        const res = await originalFetch(input, init);
        if (
          isSaveRequest &&
          !res.ok &&
          res.status !== 401 &&
          res.status !== 409
        ) {
          if (res.status === 413) {
            pushSaveError("实时保存失败：请求体过大，当前修改未成功写入。");
          } else {
            pushSaveError(`实时保存失败：服务器返回 ${res.status}。`);
          }
        }
        return res;
      } catch (e) {
        if (isSaveRequest) {
          const msg = e instanceof Error ? e.message : String(e);
          pushSaveError(`实时保存失败：${msg || "网络异常"}`);
        }
        throw e;
      }
    };
  }
  const style = document.createElement("style");
  style.id = "devtools-hider";
  style.innerHTML = `
    #vue-devtools-anchor,
    .vue-devtools__anchor,
    .vue-devtools__trigger,
    [data-v-inspector-toggle] {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  // Poll for updates every 18 hours
  setInterval(
    () => {
      store.fetchData();
    },
    18 * 60 * 60 * 1000,
  );
});
</script>

<template>
  <div
    class="startdeck-handshake-signal"
    style="display: none !important"
  ></div>

  <!-- Network Status Indicator -->
  <NetworkIndicator
    v-if="!isStandaloneRoute"
    class="network-indicator-wrapper"
  />

  <WidgetCatalogPreviewFrame v-if="isWidgetPreviewRoute" />
  <GridPanel v-else />

  <!-- 冲突提示：居中模态框 -->
  <Transition name="fade">
    <AppModalShell
      v-if="!isStandaloneRoute && store.conflictState.show"
      title="版本冲突"
      subtitle="其他设备或标签页已更新配置，请选择解决方式。"
      :show="store.conflictState.show"
      :z-index="130"
      blocking
      :show-close="false"
      overlay-class="sd-overlay-strong"
      panel-class="w-full max-w-md"
      surface-class="max-w-md"
    >
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="sd-value-badge"
          >服务端 V{{ store.conflictState.serverVersion }}</span
        >
        <span class="text-[var(--sd-color-text-tertiary)]">/</span>
        <span class="sd-value-badge"
          >本地 V{{ store.conflictState.clientVersion }}</span
        >
      </div>

      <template #footer>
        <AppButton
          variant="secondary"
          @click.stop.prevent="store.resolveConflict('remote')"
        >
          采用服务端
        </AppButton>
        <AppButton
          variant="danger"
          @click.stop.prevent="store.resolveConflict('local')"
        >
          强制本端
        </AppButton>
      </template>
    </AppModalShell>
  </Transition>
  <!-- 心跳断过后再次激活且服务端版本不同时，确认是否同步 -->
  <Transition name="fade">
    <AppModalShell
      v-if="!isStandaloneRoute && store.syncConfirmModal.show"
      title="服务端配置已更新"
      :subtitle="`检测到服务端配置版本 (V${store.syncConfirmModal.serverVersion}) 与当前不同，是否同步为服务端配置？`"
      :show="store.syncConfirmModal.show"
      :z-index="130"
      blocking
      :show-close="false"
      overlay-class="sd-overlay-strong"
      panel-class="w-full max-w-md"
      surface-class="max-w-md"
    >
      <template #footer>
        <AppButton
          variant="secondary"
          @click.stop.prevent="store.dismissSyncConfirm()"
        >
          保留本地
        </AppButton>
        <AppButton
          variant="primary"
          @click.stop.prevent="store.confirmSyncFromServer()"
        >
          同步
        </AppButton>
      </template>
    </AppModalShell>
  </Transition>
  <Transition name="slide-down">
    <div
      v-if="!isStandaloneRoute && saveErrorMessage && !store.conflictState.show"
      class="fixed top-0 inset-x-0 z-[111] px-4 pt-[env(safe-area-inset-top)]"
    >
      <div class="mx-auto max-w-5xl py-2">
        <StatusBanner
          title="实时保存异常"
          :message="saveErrorMessage"
          tone="warning"
        />
      </div>
    </div>
  </Transition>

  <div
    v-if="!isStandaloneRoute && !store.isClientReady"
    class="fixed inset-0 z-[120] bg-black/30 flex items-center justify-center text-white"
  >
    <div
      class="flex flex-col items-center gap-3 px-6 py-4 bg-black/60 rounded-2xl border border-white/10"
    >
      <div
        class="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"
      ></div>
      <div class="text-sm font-medium">正在同步服务端数据，请稍后...</div>
    </div>
  </div>

  <Transition name="fade-up">
    <button
      v-if="!isStandaloneRoute && showBackToTop"
      @click="scrollToTop"
      class="fixed bottom-6 right-6 z-[100] w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-lg flex items-center justify-center hover:bg-white/40 active:scale-95 transition-all cursor-pointer"
      title="返回首页"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-6 w-6 drop-shadow-md"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2.5"
          d="M5 10l7-7m0 0l7 7m-7-7v18"
        />
      </svg>
    </button>
  </Transition>

  <ToastHost :items="uiFeedback.toasts" @dismiss="uiFeedback.dismissToast" />

  <AppModalShell
    v-if="!isStandaloneRoute"
    :show="uiFeedback.alertDialog.show"
    :z-index="GLOBAL_FEEDBACK_MODAL_Z_INDEX"
    :title="uiFeedback.alertDialog.title"
    :blocking="uiFeedback.alertDialog.blocking"
    :show-close="!uiFeedback.alertDialog.blocking"
    :close-on-overlay="!uiFeedback.alertDialog.blocking"
    :close-on-escape="!uiFeedback.alertDialog.blocking"
    :overlay-class="
      uiFeedback.alertDialog.tone === 'danger'
        ? 'sd-overlay-strong'
        : 'sd-overlay'
    "
    panel-class="w-full max-w-sm"
    surface-class="sd-compact-window"
    @close="uiFeedback.closeAlert()"
  >
    <p
      class="whitespace-pre-line text-sm leading-6 text-[var(--sd-color-text-secondary)]"
    >
      {{ uiFeedback.alertDialog.message }}
    </p>

    <template #footer>
      <AppButton
        :variant="
          uiFeedback.alertDialog.tone === 'danger' ? 'danger' : 'primary'
        "
        @click="uiFeedback.closeAlert()"
      >
        {{ uiFeedback.alertDialog.actionLabel }}
      </AppButton>
    </template>
  </AppModalShell>

  <ConfirmDialog
    v-if="!isStandaloneRoute"
    :show="uiFeedback.confirmDialog.show"
    :z-index="GLOBAL_FEEDBACK_MODAL_Z_INDEX"
    :title="uiFeedback.confirmDialog.title"
    :message="uiFeedback.confirmDialog.message"
    :confirm-label="uiFeedback.confirmDialog.confirmLabel"
    :cancel-label="uiFeedback.confirmDialog.cancelLabel"
    :tone="uiFeedback.confirmDialog.tone"
    :blocking="uiFeedback.confirmDialog.blocking"
    @confirm="uiFeedback.resolveConfirm(true)"
    @cancel="uiFeedback.resolveConfirm(false)"
  />

  <!-- Global Audio Element for persistent playback across groups -->
  <audio
    id="startdeck-global-audio"
    style="display: none"
    crossorigin="anonymous"
  ></audio>
</template>

<style>
.network-indicator-wrapper {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 101;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-up-enter-active,
.fade-up-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
