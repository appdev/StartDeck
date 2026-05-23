<script setup lang="ts">
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";
import {
  shouldOpenItabPanel,
  type ItabOpenGuardOptions,
} from "@/features/itab-widgets/itabInteraction";

const props = defineProps<{
  type: string;
  widgetId?: string;
  title: string;
  captureIndex: number;
  sizeKey: ItabWidgetSizeKey;
  visualMode?: string;
  dataMode?: string;
  skinId?: string;
  isEditMode?: boolean;
  isDragging?: boolean;
  isResizing?: boolean;
}>();

const emit = defineEmits<{
  openPanel: [
    payload: {
      widgetId?: string;
      type: string;
      captureIndex: number;
      element: HTMLElement;
    },
  ];
}>();

const onRootClick = (event: MouseEvent) => {
  const guard: ItabOpenGuardOptions = {
    isEditMode: props.isEditMode,
    isDragging: props.isDragging,
    isResizing: props.isResizing,
  };
  if (!shouldOpenItabPanel(event, guard)) return;
  const element = event.currentTarget;
  if (!(element instanceof HTMLElement)) return;
  emit("openPanel", {
    type: props.type,
    widgetId: props.widgetId,
    captureIndex: props.captureIndex,
    element,
  });
};

const onRootKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  const element = event.currentTarget;
  if (!(element instanceof HTMLElement)) return;
  emit("openPanel", {
    type: props.type,
    widgetId: props.widgetId,
    captureIndex: props.captureIndex,
    element,
  });
};
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="itab-widget-shell"
    :class="[
      `is-itab-size-${sizeKey}`,
      visualMode === 'clone-skin'
        ? 'is-visual-clone-skin'
        : 'is-visual-dom-native',
    ]"
    :data-itab-widget-root="type"
    :data-itab-component-id="type"
    :data-capture-index="captureIndex"
    :data-itab-capture-index="captureIndex"
    :data-size-key="sizeKey"
    :data-itab-size-key="sizeKey"
    data-itab-state="body"
    :data-itab-visual-mode="visualMode || 'clone-skin'"
    :data-itab-data-mode="dataMode || 'live'"
    :data-itab-skin-id="skinId"
    data-itab-hotspot-id="root-open"
    data-itab-action="open-panel"
    :aria-label="`${title} iTab 组件`"
    @click="onRootClick"
    @keydown="onRootKeydown"
    @contextmenu.stop
  >
    <slot />
  </div>
</template>

<style scoped>
.itab-widget-shell {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  border: 0;
  border-radius: 18px;
  padding: 0;
  background: transparent;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
  overflow: hidden;
}

.itab-widget-shell.is-visual-clone-skin {
  overflow: visible;
}

.itab-widget-shell:focus-visible {
  outline: 3px solid rgba(59, 130, 246, 0.65);
  outline-offset: 2px;
}
</style>
