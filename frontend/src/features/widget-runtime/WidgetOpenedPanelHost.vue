<script setup lang="ts">
import { computed } from "vue";
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
</script>

<template>
  <OverlayMotion
    :show="!!widget && !!definition && !!shell"
    z-index="70"
    close-on-overlay
    close-on-escape
    panel-class="sd-widget-opened-panel"
    overlay-class="sd-widget-opened-overlay"
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
      <div v-if="shell.trafficVisible" class="sd-widget-opened-traffic">
        <button class="yellow" type="button" aria-label="minimize"></button>
        <button class="green" type="button" aria-label="maximize"></button>
        <button
          class="red"
          type="button"
          aria-label="close"
          @click="emit('close')"
        ></button>
      </div>
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
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
}

:global(.sd-widget-opened-panel) {
  overflow: hidden;
}

.sd-widget-opened-window {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 20px;
  background: linear-gradient(45deg, rgb(33, 30, 34) 20%, rgb(56, 58, 62));
  color: #fff;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
}

.sd-widget-opened-window.opened-itab-todo {
  border: 1px solid rgba(0, 0, 0, 0.13);
  background: #fff;
  color: #222;
  font-size: 14px;
  line-height: 21px;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-memo {
  border: 1px solid rgba(0, 0, 0, 0.13);
  background: #fff;
  color: #222;
  font-size: 14px;
  line-height: 21px;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-clock {
  overflow: auto;
  border: 1px solid rgba(0, 0, 0, 0.13);
  background: transparent;
  color: #222;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-daily-english {
  border: 0;
  background: transparent;
  color: #fff;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-poem {
  border: 1px solid rgba(255, 255, 255, 0.13);
  background: #eee;
  color: #333;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  backdrop-filter: none;
  overflow: auto;
}

.sd-widget-opened-window.opened-itab-pomodoro {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
  color: #fff;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  backdrop-filter: none;
}

.sd-widget-opened-window.opened-itab-anniversary {
  border: 1px solid rgba(255, 255, 255, 0.13);
  background: rgb(17, 17, 21);
  color: #fff;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  backdrop-filter: none;
}

.sd-widget-opened-traffic {
  position: absolute;
  top: 11px;
  right: 17px;
  z-index: 3;
  display: flex;
  gap: 12px;
}

.sd-widget-opened-traffic button {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 999px;
}

.sd-widget-opened-traffic .yellow {
  display: none;
  background: #ffbf2f;
}

.sd-widget-opened-traffic .green {
  background: #1bd228;
}

.sd-widget-opened-traffic .red {
  background: #ff5c59;
}
</style>
