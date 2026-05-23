<script setup lang="ts">
import { computed, useSlots } from "vue";
import AppModalShell from "@/components/base/AppModalShell.vue";

type InitialFocusTarget = "panel" | "first" | "cancel" | string;

const props = withDefaults(
  defineProps<{
    show: boolean;
    title?: string;
    subtitle?: string;
    zIndex?: number | string;
    closeOnOverlay?: boolean;
    closeOnEscape?: boolean;
    initialFocus?: InitialFocusTarget;
    scheme?: "auto" | "light" | "dark";
    showClose?: boolean;
    showInspector?: boolean;
    overlayClass?: string;
    panelClass?: string;
    surfaceClass?: string;
    bodyClass?: string;
    panelStyle?: string | Record<string, string | number>;
  }>(),
  {
    title: "",
    subtitle: "",
    zIndex: 50,
    closeOnOverlay: true,
    closeOnEscape: true,
    initialFocus: "panel",
    scheme: "auto",
    showClose: true,
    showInspector: true,
    overlayClass: "sd-overlay",
    panelClass: "w-full max-w-[1180px] max-h-[90vh]",
    surfaceClass: "",
    bodyClass: "sd-settings-shell-body p-0 flex-1 min-h-0",
    panelStyle: undefined,
  },
);

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "close", reason?: "overlay" | "escape" | "programmatic"): void;
  (e: "dismiss-attempt", reason: "overlay" | "escape"): void;
}>();

const slots = useSlots();
const hasInspector = computed(
  () => props.showInspector && Boolean(slots.inspector),
);
const resolvedPanelClass = computed(() =>
  ["sd-settings-shell-panel", props.panelClass].filter(Boolean).join(" "),
);
const resolvedSurfaceClass = computed(() =>
  ["sd-settings-shell-surface", props.surfaceClass].filter(Boolean).join(" "),
);
</script>

<template>
  <AppModalShell
    :show="show"
    :title="title"
    :subtitle="subtitle"
    :z-index="zIndex"
    :close-on-overlay="closeOnOverlay"
    :close-on-escape="closeOnEscape"
    :initial-focus="initialFocus"
    :scheme="scheme"
    :show-close="showClose"
    :overlay-class="overlayClass"
    :panel-class="resolvedPanelClass"
    :surface-class="resolvedSurfaceClass"
    :body-class="bodyClass"
    :panel-style="panelStyle"
    show-traffic-lights
    @update:show="emit('update:show', $event)"
    @close="emit('close', $event)"
    @dismiss-attempt="emit('dismiss-attempt', $event)"
  >
    <template #headerActions>
      <slot name="headerActions" />
    </template>

    <div class="sd-settings-layout" :class="{ 'has-inspector': hasInspector }">
      <aside class="sd-settings-sidebar">
        <slot name="sidebar" />
      </aside>
      <main class="sd-settings-main">
        <slot />
      </main>
      <aside v-if="hasInspector" class="sd-settings-inspector">
        <slot name="inspector" />
      </aside>
    </div>

    <template v-if="slots.footer" #footer>
      <slot name="footer" />
    </template>
  </AppModalShell>
</template>
