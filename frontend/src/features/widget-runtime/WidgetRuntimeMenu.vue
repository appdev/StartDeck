<script setup lang="ts">
import { computed } from "vue";
import ContextMenuSurface from "@/components/base/ContextMenuSurface.vue";
import type { WidgetConfig } from "@/types";
import {
  getWidgetRuntimeDefinition,
  resolveWidgetRuntimeSizeKey,
} from "./widgetRuntimeRegistry";
import type { RuntimeWidgetSizeKey } from "./widgetRuntimeSizes";

const props = defineProps<{
  show: boolean;
  x: number;
  y: number;
  widget?: WidgetConfig | null;
}>();

const emit = defineEmits<{
  close: [];
  refresh: [widget: WidgetConfig];
  editIcon: [widget: WidgetConfig];
  editHome: [widget: WidgetConfig];
  delete: [widget: WidgetConfig];
  selectSize: [widget: WidgetConfig, sizeKey: RuntimeWidgetSizeKey];
}>();

const definition = computed(() =>
  props.widget ? getWidgetRuntimeDefinition(props.widget.type) : undefined,
);
const currentSizeKey = computed(() =>
  props.widget ? resolveWidgetRuntimeSizeKey(props.widget) : undefined,
);
const panelStyle = computed(() => ({
  left: `${Math.max(8, props.x)}px`,
  top: `${Math.max(8, props.y)}px`,
}));

const runAction = (action: "refresh" | "editIcon" | "editHome" | "delete") => {
  const widget = props.widget;
  if (!widget) return;
  emit("close");
  if (action === "refresh") emit("refresh", widget);
  if (action === "editIcon") emit("editIcon", widget);
  if (action === "editHome") emit("editHome", widget);
  if (action === "delete") emit("delete", widget);
};

const selectSize = (sizeKey: RuntimeWidgetSizeKey) => {
  const widget = props.widget;
  if (!widget) return;
  emit("close");
  emit("selectSize", widget, sizeKey);
};
</script>

<template>
  <ContextMenuSurface
    :show="show && !!widget && !!definition"
    :panel-style="panelStyle"
    overlay-class="sd-runtime-menu-overlay"
    panel-class="sd-runtime-menu-panel"
    surface-class="sd-runtime-menu-surface"
    close-on-overlay
    close-on-escape
    scheme="dark"
    @close="emit('close')"
  >
    <div
      v-if="widget && definition"
      class="sd-runtime-menu"
      data-runtime-context-menu
      data-grid-drag-ignore="true"
      role="menu"
      :aria-label="`${definition.title}菜单`"
    >
      <section
        class="sd-runtime-menu-layout"
        aria-labelledby="runtime-menu-layout-title"
      >
        <div id="runtime-menu-layout-title" class="sd-runtime-menu-heading">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="3.5" width="17" height="17" rx="2.2" />
            <path d="M9 3.5v17M3.5 9h17M15 9v11.5" />
          </svg>
          <span>布局</span>
        </div>
        <div class="sd-runtime-menu-size-grid">
          <button
            v-for="size in definition.supportedSizes"
            :key="size.key"
            class="sd-runtime-menu-size-pill"
            type="button"
            role="menuitemradio"
            :aria-checked="size.key === currentSizeKey"
            :class="{ 'is-active': size.key === currentSizeKey }"
            @click="selectSize(size.key)"
          >
            {{ size.label }}
          </button>
        </div>
      </section>

      <section class="sd-runtime-menu-actions" aria-label="组件操作">
        <button type="button" role="menuitem" @click="runAction('refresh')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6v5h-5" />
            <path d="M4 18v-5h5" />
            <path d="M18.2 9A7 7 0 0 0 6.4 6.8L4 9" />
            <path d="M5.8 15A7 7 0 0 0 17.6 17.2L20 15" />
          </svg>
          <span>刷新</span>
        </button>
        <button type="button" role="menuitem" @click="runAction('editIcon')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5.8A1.8 1.8 0 0 1 5.8 4h9.4A1.8 1.8 0 0 1 17 5.8V11" />
            <path d="M7 8h7M7 11h5" />
            <path
              d="M14.4 18.8 19 14.2a1.85 1.85 0 0 1 2.6 2.62L17 21.4l-3.5.7.7-3.3Z"
            />
          </svg>
          <span>编辑图标</span>
        </button>
        <button type="button" role="menuitem" @click="runAction('editHome')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5.8A1.8 1.8 0 0 1 5.8 4h9.4A1.8 1.8 0 0 1 17 5.8V11" />
            <path d="M7 8h7M7 11h5" />
            <path
              d="M14.4 18.8 19 14.2a1.85 1.85 0 0 1 2.6 2.62L17 21.4l-3.5.7.7-3.3Z"
            />
          </svg>
          <span>编辑主页</span>
        </button>
        <button type="button" role="menuitem" @click="runAction('delete')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16" />
            <path
              d="M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7"
            />
            <path
              d="m6.5 7 .8 12A2.2 2.2 0 0 0 9.5 21h5a2.2 2.2 0 0 0 2.2-2l.8-12"
            />
            <path d="M10 11v6M14 11v6" />
          </svg>
          <span>删除</span>
        </button>
      </section>
    </div>
  </ContextMenuSurface>
</template>

<style scoped>
:global(.sd-runtime-menu-panel) {
  position: fixed;
  transform: none !important;
  will-change: auto !important;
}

:global(.sd-runtime-menu-overlay) {
  isolation: auto;
}

:global(.sd-runtime-menu-surface) {
  width: 140px;
  min-width: 140px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 12px;
  background: var(--sd-theme-runtime-widget-runtime-menu-surface-01);
  background-image: none;
  color: var(--sd-theme-runtime-widget-runtime-menu-text-01);
  box-shadow: 0 10px 30px var(--sd-theme-runtime-widget-runtime-menu-shadow-01);
  -webkit-backdrop-filter: saturate(135%) blur(28px) brightness(0.62);
  backdrop-filter: saturate(135%) blur(28px) brightness(0.62);
}

.sd-runtime-menu {
  padding: 4px;
}

.sd-runtime-menu-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--sd-theme-runtime-widget-runtime-menu-text-02);
  font-size: 13px;
  line-height: 30px;
}

.sd-runtime-menu-heading svg,
.sd-runtime-menu-actions svg {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.sd-runtime-menu-size-grid {
  display: grid;
  grid-template-columns: repeat(3, 36px);
  gap: 4px;
  margin-top: 0;
}

.sd-runtime-menu-size-pill {
  display: flex;
  width: 36px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: var(--sd-theme-runtime-widget-runtime-menu-surface-02);
  color: inherit;
  font-size: 12px;
  line-height: 20px;
  cursor: pointer;
}

.sd-runtime-menu-size-pill:hover,
.sd-runtime-menu-size-pill:focus-visible,
.sd-runtime-menu-size-pill.is-active {
  background: var(--sd-theme-runtime-widget-runtime-menu-surface-03);
  outline: none;
}

.sd-runtime-menu-actions {
  display: grid;
  gap: 4px;
  margin-top: 4px;
}

.sd-runtime-menu-actions button {
  display: flex;
  width: 100%;
  min-height: 30px;
  align-items: center;
  gap: 7px;
  padding: 0 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 13px;
  line-height: 30px;
  text-align: left;
  cursor: pointer;
}

.sd-runtime-menu-actions button:hover,
.sd-runtime-menu-actions button:focus-visible {
  background: var(--sd-theme-runtime-widget-runtime-menu-surface-02);
  outline: none;
}
</style>
