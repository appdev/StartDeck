<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { WidgetConfig } from "../types";
import { useMainStore } from "@/stores/main";
import { useUiFeedbackStore } from "@/stores/uiFeedback";
import { useLoginRequiredToast } from "@/composables/useRequireLogin";
import {
  normalizeCustomCssWidgetData,
  type CustomCssWidgetRuntimeData,
} from "@/features/widget-runtime/customCssRuntimeModel";

const props = withDefaults(
  defineProps<{
    widget: WidgetConfig;
    variant?: "card" | "opened";
    sizeKey?: string;
    refreshToken?: number;
  }>(),
  {
    variant: "card",
  },
);

defineOptions({ inheritAttrs: false });

const emit = defineEmits<{
  updateData: [data: CustomCssWidgetRuntimeData];
  "update-data": [data: CustomCssWidgetRuntimeData];
}>();

const store = useMainStore();
const uiFeedback = useUiFeedbackStore();
const { notifyLoginRequired } = useLoginRequiredToast();
const canEdit = computed(() => store.isLogged);
const activeTab = ref<"html" | "css" | "js">("html");
const isOpenedVariant = computed(() => props.variant === "opened");

const readData = () => normalizeCustomCssWidgetData(props.widget.data);
const initialData = readData();
const titleContent = ref(initialData.title);
const htmlContent = ref(initialData.html);
const cssContent = ref(initialData.css);
const jsContent = ref(initialData.js || "");

const syncFromWidget = () => {
  const next = readData();
  titleContent.value = next.title;
  htmlContent.value = next.html;
  cssContent.value = next.css;
  jsContent.value = next.js || "";
};

const scopeSuffix = computed(() => (isOpenedVariant.value ? "opened" : "card"));
const widgetDomId = computed(() =>
  isOpenedVariant.value
    ? `widget-${props.widget.id}-opened`
    : `widget-${props.widget.id}`,
);
const styleId = computed(() => `style-${props.widget.id}-${scopeSuffix.value}`);
const widgetScope = computed(() => `#${widgetDomId.value}`);

// ─── CSS Scoping ──────────────────────────────────────────────────────────────
const NESTED_AT = /^@(media|supports|layer|container)\b/i;

function scopeCss(css: string, scope: string): string {
  const out: string[] = [];
  let i = 0;
  const n = css.length;

  while (i < n) {
    while (i < n && css.charCodeAt(i) <= 32) i++;
    if (i >= n) break;

    let selector = "";
    while (i < n && css[i] !== "{") selector += css[i++];
    if (i >= n) {
      out.push(selector);
      break;
    }
    i++;

    let block = "";
    let depth = 1;
    while (i < n && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      if (depth > 0) block += css[i];
      i++;
    }

    const sel = selector.trim();
    if (!sel) continue;

    if (sel.startsWith("@")) {
      if (NESTED_AT.test(sel)) {
        out.push(`${sel} {\n${scopeCss(block, scope)}\n}`);
      } else {
        out.push(`${sel} {\n${block}\n}`);
      }
    } else {
      const scoped = sel
        .split(",")
        .map((s) => {
          s = s.trim();
          if (!s) return "";
          if (s === ":root") return scope;
          if (/^:root[\s>+~([]/.test(s)) return scope + s.slice(5);
          return `${scope} ${s}`;
        })
        .filter(Boolean)
        .join(",\n");
      out.push(`${scoped} {\n${block}\n}`);
    }
  }
  return out.join("\n\n");
}

const applyStyles = () => {
  let el = document.getElementById(styleId.value) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = styleId.value;
    document.head.appendChild(el);
  }
  el.textContent = scopeCss(cssContent.value, widgetScope.value);
};

let cssDebounce: number | null = null;
watch(cssContent, () => {
  if (!isOpenedVariant.value) return;
  if (cssDebounce) clearTimeout(cssDebounce);
  cssDebounce = window.setTimeout(applyStyles, 300);
});

// ─── Widget-level JS ──────────────────────────────────────────────────────────
const jsScriptClass = computed(
  () => `widget-js-${props.widget.id}-${scopeSuffix.value}`,
);
const jsCleanupFns: Array<() => void> = [];

const removeWidgetScripts = () => {
  document
    .querySelectorAll(`.${jsScriptClass.value}`)
    .forEach((script) => script.remove());
};

const destroyWidgetJs = () => {
  while (jsCleanupFns.length) {
    try {
      jsCleanupFns.pop()?.();
    } catch {
      /* ignore */
    }
  }
  removeWidgetScripts();
};

const applyWidgetJs = () => {
  destroyWidgetJs();
  const src = jsContent.value?.trim();
  if (!src) return;

  const widgetEl = document.getElementById(widgetDomId.value);
  if (!widgetEl) return;

  const widgetCtx = {
    el: widgetEl,
    query: (sel: string) => widgetEl.querySelector(sel),
    queryAll: (sel: string) => Array.from(widgetEl.querySelectorAll(sel)),
    onCleanup: (fn: () => void) => {
      if (typeof fn === "function") jsCleanupFns.push(fn);
    },
    emit: (type: string, detail?: unknown) => {
      window.dispatchEvent(new CustomEvent(`startdeck:${type}`, { detail }));
    },
    on: (type: string, handler: (ev: CustomEvent) => void) => {
      const targetType = `startdeck:${type}`;
      const wrapped = (event: Event) => handler(event as CustomEvent);
      window.addEventListener(targetType, wrapped as EventListener);
      jsCleanupFns.push(() =>
        window.removeEventListener(targetType, wrapped as EventListener),
      );
    },
  };

  (window as unknown as Record<string, unknown>).StartDeckWidgetCtx = widgetCtx;

  const looksModule =
    /^\s*\/\/\s*@module\b/m.test(src) ||
    /(^|\n)\s*import\s.+from\s+["'][^"']+["']/m.test(src) ||
    /(^|\n)\s*export\s+/m.test(src);

  const script = document.createElement("script");
  script.className = jsScriptClass.value;

  if (looksModule) {
    script.type = "module";
    script.textContent = src;
  } else {
    const id = props.widget.id;
    script.textContent = `;(async (ctx) => {\ntry {\n${src}\n} catch (e) {\nconsole.error('[StartDeck Widget JS ${id}]', e);\n}\n})(window.StartDeckWidgetCtx);`;
  }

  script.onerror = (event) =>
    console.error(
      `[StartDeck Widget JS ${props.widget.id}] load error:`,
      event,
    );
  document.body.appendChild(script);
};

const applyRuntime = () => {
  applyStyles();
  applyWidgetJs();
};

const save = () => {
  if (!canEdit.value) {
    notifyLoginRequired("请先登录后再修改自定义组件。");
    return;
  }
  const current = readData();
  const next = normalizeCustomCssWidgetData({
    ...current,
    title: titleContent.value,
    html: htmlContent.value,
    css: cssContent.value,
    js: jsContent.value,
    sizeKey: props.sizeKey || current.sizeKey,
  });

  const target =
    store.widgets.find((widget) => widget.id === props.widget.id) ||
    props.widget;
  target.data = next;
  store.markDirty();
  emit("updateData", next);
  emit("update-data", next);
  applyRuntime();
  uiFeedback.notify({
    title: "自定义组件已更新",
    message: "卡片内容已保存。",
    tone: "success",
  });
};

const exportJson = () => {
  const data: Record<string, string> = {
    title: titleContent.value,
    html: htmlContent.value,
    css: cssContent.value,
  };
  if (jsContent.value.trim()) data.js = jsContent.value;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${(titleContent.value || "custom-widget").replace(/[^\w\u4e00-\u9fa5-]/g, "_")}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const copyPrompt = () => {
  const text = `请帮我写一个简洁的 HTML/CSS 卡片组件。
功能：[在此输入你的需求，如：显示当前日期和一句名言]
要求：
1. 容器宽高自适应，内容居中。
2. 风格现代简约，圆角设计。
3. 请分别提供 HTML 和 CSS 代码（可选 JS）。`;
  navigator.clipboard.writeText(text).then(() => {
    uiFeedback.notify({
      title: "已复制提示词",
      message: "提示词已复制到剪贴板。",
      tone: "success",
    });
  });
};

const handleFileUpload = (event: Event) => {
  if (!canEdit.value) return;
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const content = loadEvent.target?.result as string;
      try {
        const json = JSON.parse(content) as Record<string, unknown>;
        if (typeof json.html === "string") htmlContent.value = json.html;
        if (typeof json.css === "string") cssContent.value = json.css;
        if (typeof json.js === "string") jsContent.value = json.js;
        if (typeof json.title === "string") titleContent.value = json.title;
      } catch {
        htmlContent.value = content;
      }
    } catch (error) {
      console.error("Failed to read custom widget file", error);
    } finally {
      input.value = "";
    }
  };
  reader.readAsText(file);
};

watch(
  () => props.widget.data,
  () => {
    syncFromWidget();
    window.requestAnimationFrame(applyRuntime);
  },
  { deep: true },
);

watch(
  () => props.refreshToken,
  () => applyRuntime(),
);

onMounted(() => {
  applyRuntime();
});

onUnmounted(() => {
  destroyWidgetJs();
  const styleEl = document.getElementById(styleId.value);
  if (styleEl) styleEl.remove();
});
</script>

<template>
  <section
    v-if="isOpenedVariant"
    class="custom-css-workbench"
    data-custom-css-workbench
  >
    <header class="custom-css-workbench-header">
      <div>
        <span>自定义组件</span>
        <strong>{{ titleContent || "未命名组件" }}</strong>
      </div>
      <div class="custom-css-workbench-actions">
        <label>
          导入
          <input
            type="file"
            accept=".json,.txt,.html,.css"
            @change="handleFileUpload"
          />
        </label>
        <button type="button" @click="exportJson">导出</button>
        <button type="button" @click="copyPrompt">AI 提示词</button>
        <button
          type="button"
          class="is-primary"
          :disabled="!canEdit"
          @click="save"
        >
          保存
        </button>
      </div>
    </header>

    <div class="custom-css-workbench-body">
      <aside class="custom-css-preview-pane">
        <div class="custom-css-pane-title">
          <span>实时预览</span>
          <em>{{ props.sizeKey || readData().sizeKey }}</em>
        </div>
        <div :id="widgetDomId" class="custom-css-preview-frame">
          <div class="custom-css-content" v-html="htmlContent"></div>
        </div>
      </aside>

      <section class="custom-css-editor-pane">
        <label class="custom-css-field">
          <span>标题</span>
          <input
            v-model="titleContent"
            :disabled="!canEdit"
            placeholder="自定义组件"
          />
        </label>

        <nav class="custom-css-tabs" aria-label="编辑类型">
          <button
            v-for="tab in ['html', 'css', 'js'] as const"
            :key="tab"
            type="button"
            :class="{ 'is-active': activeTab === tab }"
            @click="activeTab = tab"
          >
            {{ tab.toUpperCase() }}
          </button>
        </nav>

        <label v-if="activeTab === 'html'" class="custom-css-code-field">
          <span>HTML 结构</span>
          <textarea
            v-model="htmlContent"
            :disabled="!canEdit"
            spellcheck="false"
            placeholder='<div class="my-widget">Hello World</div>'
          ></textarea>
        </label>

        <label v-else-if="activeTab === 'css'" class="custom-css-code-field">
          <span>CSS 样式（自动作用域隔离，实时预览）</span>
          <textarea
            v-model="cssContent"
            :disabled="!canEdit"
            spellcheck="false"
            placeholder=".my-widget { color: red; }"
          ></textarea>
        </label>

        <label v-else class="custom-css-code-field">
          <span>JavaScript（保存后重新执行）</span>
          <textarea
            v-model="jsContent"
            :disabled="!canEdit"
            spellcheck="false"
            placeholder="// ctx.el, ctx.query, ctx.onCleanup"
          ></textarea>
        </label>
      </section>
    </div>
  </section>

  <div
    v-else
    :id="widgetDomId"
    class="custom-css-widget-card"
    :data-widget-size="props.sizeKey || readData().sizeKey"
  >
    <div class="custom-css-content" v-html="htmlContent"></div>
  </div>
</template>

<style scoped>
.custom-css-widget-card {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: inherit;
  background: transparent;
}

.custom-css-content {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.custom-css-workbench {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(
    --sd-color-surface,
    var(--sd-theme-custom-css-widget-surface-01)
  );
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-custom-css-widget-accent-text-01)
  );
}

.custom-css-workbench-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
  border-bottom: 1px solid
    var(--sd-color-border-subtle, var(--sd-theme-custom-css-widget-border-01));
  padding: 1.35rem 1.55rem 1rem;
}

.custom-css-workbench-header div:first-child {
  display: grid;
  min-width: 0;
  gap: 0.24rem;
}

.custom-css-workbench-header span,
.custom-css-pane-title span,
.custom-css-field span,
.custom-css-code-field span {
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-custom-css-widget-accent-text-02)
  );
  font-size: 0.78rem;
  font-weight: 760;
}

.custom-css-workbench-header strong {
  overflow: hidden;
  font-size: 1.34rem;
  font-weight: 820;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-css-workbench-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.55rem;
}

.custom-css-workbench-actions button,
.custom-css-workbench-actions label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.2rem;
  border: 1px solid
    var(--sd-color-border-subtle, var(--sd-theme-custom-css-widget-border-01));
  border-radius: 999px;
  background: var(
    --sd-color-surface-muted,
    var(--sd-theme-custom-css-widget-surface-02)
  );
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-custom-css-widget-accent-text-01)
  );
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 780;
  line-height: 1;
  padding: 0 0.9rem;
}

.custom-css-workbench-actions .is-primary {
  border-color: var(--sd-theme-custom-css-widget-accent-border-01);
  background: var(--sd-theme-custom-css-widget-accent-surface-01);
  color: var(--sd-theme-custom-css-widget-text-01);
}

.custom-css-workbench-actions button:disabled {
  cursor: default;
  opacity: 0.5;
}

.custom-css-workbench-actions input {
  display: none;
}

.custom-css-workbench-body {
  display: grid;
  grid-template-columns: minmax(18rem, 0.92fr) minmax(24rem, 1.08fr);
  min-height: 0;
  gap: 1rem;
  padding: 1rem 1.55rem 1.55rem;
}

.custom-css-preview-pane,
.custom-css-editor-pane {
  display: grid;
  min-width: 0;
  min-height: 0;
  border: 1px solid
    var(--sd-color-border-subtle, var(--sd-theme-custom-css-widget-border-01));
  border-radius: 18px;
  background: var(
    --sd-color-surface-muted,
    var(--sd-theme-custom-css-widget-surface-02)
  );
}

.custom-css-preview-pane {
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.8rem;
  padding: 1rem;
}

.custom-css-pane-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.custom-css-pane-title em {
  border-radius: 999px;
  background: var(--sd-theme-custom-css-widget-surface-03);
  color: var(--sd-theme-custom-css-widget-accent-text-03);
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 780;
  padding: 0.22rem 0.52rem;
}

.custom-css-preview-frame {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid
    var(--sd-color-border-subtle, var(--sd-theme-custom-css-widget-border-01));
  border-radius: 16px;
  background: var(
    --sd-color-surface,
    var(--sd-theme-custom-css-widget-surface-01)
  );
}

.custom-css-editor-pane {
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 0.85rem;
  padding: 1rem;
}

.custom-css-field,
.custom-css-code-field {
  display: grid;
  min-width: 0;
  min-height: 0;
  gap: 0.45rem;
}

.custom-css-field input,
.custom-css-code-field textarea {
  min-width: 0;
  border: 1px solid
    var(--sd-color-border-subtle, var(--sd-theme-custom-css-widget-border-02));
  border-radius: 12px;
  background: var(
    --sd-color-surface,
    var(--sd-theme-custom-css-widget-surface-01)
  );
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-custom-css-widget-accent-text-01)
  );
  outline: none;
}

.custom-css-field input {
  height: 2.6rem;
  padding: 0 0.82rem;
}

.custom-css-code-field textarea {
  width: 100%;
  height: 100%;
  min-height: 0;
  resize: none;
  font-family:
    ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono",
    monospace;
  font-size: 0.76rem;
  line-height: 1.55;
  padding: 0.86rem;
}

.custom-css-tabs {
  display: inline-flex;
  width: fit-content;
  border-radius: 999px;
  background: var(
    --sd-color-surface,
    var(--sd-theme-custom-css-widget-surface-01)
  );
  padding: 0.25rem;
}

.custom-css-tabs button {
  min-width: 4.1rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-custom-css-widget-accent-text-02)
  );
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 820;
  padding: 0.48rem 0.75rem;
}

.custom-css-tabs button.is-active {
  background: var(--sd-theme-custom-css-widget-accent-surface-01);
  color: var(--sd-theme-custom-css-widget-text-01);
}

@media (max-width: 760px) {
  .custom-css-workbench-header {
    align-items: stretch;
    flex-direction: column;
  }

  .custom-css-workbench-body {
    grid-template-columns: 1fr;
  }
}
</style>
