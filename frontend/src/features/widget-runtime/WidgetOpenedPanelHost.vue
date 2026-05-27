<script setup lang="ts">
import { computed } from "vue";
import AppWindowControls from "@/components/base/AppWindowControls.vue";
import OverlayMotion from "@/components/base/OverlayMotion.vue";
import type { WidgetConfig } from "@/types";
import {
  getWidgetRuntimeDefinition,
  type WidgetOpenedShellDefaults,
  type WidgetRuntimeData,
} from "./widgetRuntimeRegistry";

const props = defineProps<{
  widget?: WidgetConfig | null;
  shellOverride?: Partial<WidgetOpenedShellDefaults>;
}>();

const emit = defineEmits<{
  addData: [widget: WidgetConfig, data: WidgetRuntimeData];
  close: [];
  updateData: [widget: WidgetConfig, data: WidgetRuntimeData];
}>();

const definition = computed(() =>
  props.widget ? getWidgetRuntimeDefinition(props.widget.type) : undefined,
);
const shell = computed(() => {
  const base = definition.value?.openedShell;
  if (!base) return undefined;
  return {
    ...base,
    ...props.shellOverride,
  };
});
const panelStyle = computed(() => {
  const current = shell.value;
  if (!current) return {};
  return {
    width: `min(${current.width}px, calc(100vw - ${current.maxWidthInset}px))`,
    height: `min(${current.height}px, calc(100vh - ${current.maxHeightInset}px))`,
  };
});
const openedOverlayClass = computed(() => {
  const runtime = definition.value?.runtime;
  return [
    "sd-widget-opened-overlay",
    runtime ? `sd-widget-opened-overlay--${runtime}` : "",
  ]
    .filter(Boolean)
    .join(" ");
});
const openedPanelClass = computed(() => {
  const runtime = definition.value?.runtime;
  return [
    "sd-widget-opened-panel",
    runtime ? `sd-widget-opened-panel--${runtime}` : "",
  ]
    .filter(Boolean)
    .join(" ");
});
</script>

<template>
  <OverlayMotion
    :show="!!widget && !!definition && !!shell"
    z-index="70"
    close-on-overlay
    close-on-escape
    :panel-class="openedPanelClass"
    :overlay-class="openedOverlayClass"
    :panel-style="panelStyle"
    variant="dialog"
    role="dialog"
    aria-label="小组件面板"
    @close="emit('close')"
  >
    <section
      v-if="widget && definition && shell"
      class="sd-widget-opened-window"
      :class="[`opened-${definition.runtime}`]"
      data-widget-opened-host
      data-grid-drag-ignore="true"
    >
      <AppWindowControls
        v-if="shell.trafficVisible"
        class="sd-widget-opened-traffic"
        aria-label="小组件面板窗口控制"
        close-label="关闭弹窗"
        @close="emit('close')"
      />
      <component
        :is="definition.openedPanel"
        :widget="widget"
        @add-data="(data) => emit('addData', widget, data)"
        @close="emit('close')"
        @update-data="(data) => emit('updateData', widget, data)"
      />
    </section>
  </OverlayMotion>
</template>

<style scoped>
:global(.sd-widget-opened-overlay) {
  background: var(--sd-shell-overlay);
  -webkit-backdrop-filter: var(--sd-shell-overlay-filter);
  backdrop-filter: var(--sd-shell-overlay-filter);
}

:global(.sd-widget-opened-overlay.sd-widget-opened-overlay--itab-weather) {
  background: var(--sd-theme-runtime-widget-opened-panel-host-surface-03);
  backdrop-filter: none;
}

:global(.sd-widget-opened-panel) {
  overflow: hidden;
}

.sd-widget-opened-window {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--sd-shell-border);
  border-radius: 20px;
  background: var(--sd-shell-surface);
  color: var(--sd-shell-text-primary);
  box-shadow: var(--sd-shadow-window);
  -webkit-backdrop-filter: var(--sd-shell-surface-filter);
  backdrop-filter: var(--sd-shell-surface-filter);
}

.sd-widget-opened-window.opened-itab-todo {
  border: 1px solid var(--sd-component-border);
  background: var(--sd-component-surface);
  color: var(--sd-component-text-primary);
  font-size: 14px;
  line-height: 21px;
  box-shadow: var(--sd-shadow-window);
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-memo {
  border: 1px solid var(--sd-component-border);
  background: var(--sd-component-surface);
  color: var(--sd-component-text-primary);
  font-size: 14px;
  line-height: 21px;
  box-shadow: var(--sd-shadow-window);
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-weather {
  border: 1px solid var(--sd-theme-runtime-widget-opened-panel-host-border-03);
  background: transparent;
  color: var(--sd-theme-runtime-widget-opened-panel-host-text-01);
  box-shadow: var(--sd-theme-runtime-widget-opened-panel-host-shadow-01) 0 12px
    32px 0;
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-clock {
  overflow: auto;
  border: 1px solid var(--sd-component-border);
  background: transparent;
  color: var(--sd-component-text-primary);
  box-shadow: var(--sd-shadow-window);
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-daily-english {
  border: 0;
  background: transparent;
  color: var(--sd-theme-runtime-widget-opened-panel-host-text-01);
  box-shadow: var(--sd-theme-runtime-widget-opened-panel-host-shadow-01) 0 12px
    32px 0;
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-poem {
  border: 1px solid var(--sd-theme-runtime-widget-opened-panel-host-border-01);
  background: var(--sd-theme-runtime-widget-opened-panel-host-surface-01);
  color: var(--sd-theme-runtime-widget-opened-panel-host-text-02);
  box-shadow: var(--sd-theme-runtime-widget-opened-panel-host-shadow-01) 0 12px
    32px 0;
  backdrop-filter: none;
  overflow: auto;
}

.sd-widget-opened-window.opened-itab-pomodoro {
  border: 1px solid var(--sd-theme-runtime-widget-opened-panel-host-border-02);
  background: transparent;
  color: var(--sd-theme-runtime-widget-opened-panel-host-text-01);
  box-shadow: var(--sd-theme-runtime-widget-opened-panel-host-shadow-01) 0 12px
    32px 0;
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-anniversary {
  border: 1px solid var(--sd-theme-runtime-widget-opened-panel-host-border-01);
  background: var(--sd-theme-runtime-widget-opened-panel-host-surface-02);
  color: var(--sd-theme-runtime-widget-opened-panel-host-text-01);
  box-shadow: var(--sd-theme-runtime-widget-opened-panel-host-shadow-01) 0 12px
    32px 0;
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-wallpaper {
  border: 1px solid var(--sd-component-border);
  background: var(--sd-component-surface-raised);
  color: var(--sd-component-text-primary);
  box-shadow: var(--sd-shadow-window);
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-movie-calendar {
  border: 1px solid var(--sd-theme-runtime-widget-opened-panel-host-border-01);
  background: transparent;
  color: var(--sd-theme-runtime-widget-opened-panel-host-accent-text-01);
  box-shadow: var(--sd-theme-runtime-widget-opened-panel-host-shadow-01) 0 12px
    32px 0;
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-ip {
  border: 1px solid var(--sd-component-border);
  background: var(--sd-component-surface);
  color: var(--sd-component-text-primary);
  font-size: 14px;
  line-height: 21px;
  box-shadow: var(--sd-shadow-window);
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-calendar {
  border: 1px solid var(--sd-component-border);
  background: var(--sd-component-surface);
  color: var(--sd-component-text-primary);
  font-size: 14px;
  line-height: 21px;
  box-shadow: var(--sd-shadow-window);
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-number-uppercase {
  border: 0;
  border-radius: 15px;
  background: transparent;
  color: var(--sd-theme-runtime-widget-opened-panel-host-accent-text-02);
  box-shadow: var(--sd-theme-runtime-widget-opened-panel-host-shadow-02) 0 0 2px
    0;
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-number-uppercase
  .sd-widget-opened-traffic {
  top: 15px;
  right: 15px;
  z-index: 5;
  gap: 10px;
}

.sd-widget-opened-window.opened-itab-number-uppercase
  .sd-widget-opened-traffic
  .sd-window-control-dot {
  display: block;
  width: 17px;
  height: 17px;
}

.sd-widget-opened-window.opened-itab-food-picker {
  border: 1px solid var(--sd-component-border);
  background: var(--sd-component-surface);
  color: var(--sd-component-text-primary);
  font-size: 14px;
  line-height: 21px;
  box-shadow: var(--sd-shadow-window);
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-docker {
  overflow: hidden;
  border: 1px solid var(--sd-component-border);
  border-radius: 20px;
  background: var(--sd-component-surface);
  color: var(--sd-component-text-primary);
  box-shadow: var(--sd-shadow-window);
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-system-status {
  overflow: hidden;
  border: 1px solid var(--sd-component-border);
  border-radius: 20px;
  background: var(--sd-component-surface);
  color: var(--sd-component-text-primary);
  box-shadow: var(--sd-shadow-window);
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-custom-css {
  overflow: hidden;
  border: 1px solid var(--sd-component-border);
  border-radius: 20px;
  background: var(--sd-component-surface);
  color: var(--sd-component-text-primary);
  box-shadow: var(--sd-shadow-window);
  backdrop-filter: none;
}

.sd-widget-opened-traffic {
  position: absolute;
  top: 11px;
  right: 17px;
  z-index: 20;
  gap: 9px;
}
</style>
