<script setup lang="ts">
import { computed } from "vue";
import type { WidgetConfig } from "@/types";
import MainWidgetShell from "@/components/home/MainWidgetShell.vue";
import {
  getWidgetRuntimeDefinition,
  resolveWidgetRuntimeSizeKey,
  type WidgetRuntimeData,
} from "./widgetRuntimeRegistry";

const props = defineProps<{
  widget: WidgetConfig;
  editing?: boolean;
  isDragging?: boolean;
  refreshToken?: number;
}>();

const emit = defineEmits<{
  open: [widget: WidgetConfig];
  contextmenu: [widget: WidgetConfig, event: MouseEvent];
  updateData: [widget: WidgetConfig, data: WidgetRuntimeData];
}>();

const definition = computed(() =>
  getWidgetRuntimeDefinition(props.widget.type),
);
const sizeKey = computed(
  () =>
    resolveWidgetRuntimeSizeKey(props.widget) ||
    definition.value?.defaultSizeKey ||
    "1x2",
);

const open = () => {
  if (props.editing || props.isDragging || !definition.value) return;
  emit("open", props.widget);
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  open();
};

const onContextMenu = (event: MouseEvent) => {
  if (!definition.value) return;
  event.preventDefault();
  event.stopPropagation();
  emit("contextmenu", props.widget, event);
};
</script>

<template>
  <div
    v-if="definition"
    class="sd-widget-runtime-frame"
    data-runtime-widget
    :data-runtime-widget-type="widget.type"
    :data-runtime-name="definition.runtime"
    :role="editing ? undefined : 'button'"
    :tabindex="editing ? undefined : 0"
    @click.stop="open"
    @keydown="onKeydown"
    @contextmenu="onContextMenu"
  >
    <MainWidgetShell
      :widget-type="widget.type"
      :widget-size="sizeKey"
      :title="definition.title"
    >
      <component
        :is="definition.component"
        :widget="widget"
        :size-key="sizeKey"
        :refresh-token="refreshToken"
        @update-data="(data) => emit('updateData', widget, data)"
      />
    </MainWidgetShell>
  </div>
</template>

<style scoped>
.sd-widget-runtime-frame {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  outline: none;
}

.sd-widget-runtime-frame:focus-visible {
  border-radius: 18px;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.42);
}
</style>
