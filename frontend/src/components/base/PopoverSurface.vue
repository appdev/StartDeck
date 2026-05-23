<script setup lang="ts">
import { computed } from "vue";
import OverlayMotion from "@/components/base/OverlayMotion.vue";

const props = withDefaults(
  defineProps<{
    show: boolean;
    zIndex?: number | string;
    closeOnOverlay?: boolean;
    closeOnEscape?: boolean;
    trapFocus?: boolean;
    restoreFocus?: boolean;
    initialFocus?: "panel" | "first" | "cancel" | string;
    overlayClass?: string;
    panelClass?: string;
    panelStyle?: string | Record<string, string | number>;
    surfaceClass?: string;
    scheme?: "auto" | "light" | "dark";
  }>(),
  {
    zIndex: 70,
    closeOnOverlay: true,
    closeOnEscape: true,
    trapFocus: false,
    restoreFocus: true,
    initialFocus: "panel",
    overlayClass: "",
    panelClass: "w-auto",
    panelStyle: undefined,
    surfaceClass: "",
    scheme: "auto",
  },
);

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "close", reason?: "overlay" | "escape" | "programmatic"): void;
}>();

const surfaceAttrs = computed(() =>
  props.scheme === "auto" ? {} : { "data-sd-scheme": props.scheme },
);

const close = (reason?: "overlay" | "escape" | "programmatic") => {
  emit("close", reason);
  emit("update:show", false);
};
</script>

<template>
  <OverlayMotion
    :show="show"
    :z-index="zIndex"
    :close-on-overlay="closeOnOverlay"
    :close-on-escape="closeOnEscape"
    :trap-focus="trapFocus"
    :restore-focus="restoreFocus"
    :initial-focus="initialFocus"
    :overlay-class="overlayClass"
    :panel-class="panelClass"
    :panel-style="panelStyle"
    variant="popover"
    @close="close"
  >
    <div class="sd-popover-surface" :class="surfaceClass" v-bind="surfaceAttrs">
      <slot />
    </div>
  </OverlayMotion>
</template>
