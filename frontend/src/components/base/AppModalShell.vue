<script lang="ts">
let appModalShellId = 0;
</script>

<script setup lang="ts">
import { computed, useSlots } from "vue";
import OverlayMotion from "@/components/base/OverlayMotion.vue";
import AppWindowBar from "@/components/base/AppWindowBar.vue";

type CloseReason = "overlay" | "escape" | "programmatic";
type DismissAttemptReason = "overlay" | "escape";
type InitialFocusTarget = "panel" | "first" | "cancel" | string;

const props = withDefaults(
  defineProps<{
    show: boolean;
    title?: string;
    subtitle?: string;
    zIndex?: number | string;
    closeOnOverlay?: boolean;
    closeOnEscape?: boolean;
    trapFocus?: boolean;
    restoreFocus?: boolean;
    initialFocus?: InitialFocusTarget;
    role?: "dialog" | "alertdialog";
    blocking?: boolean;
    scheme?: "auto" | "light" | "dark";
    showClose?: boolean;
    showTrafficLights?: boolean;
    overlayClass?: string;
    panelClass?: string;
    surfaceClass?: string;
    bodyClass?: string;
    footerClass?: string;
    headerClass?: string;
    panelStyle?: string | Record<string, string | number>;
    variant?: "dialog" | "sheet" | "popover" | "context-menu";
    appear?: boolean;
    ariaLabel?: string;
    ariaLabelledby?: string;
    ariaDescribedby?: string;
    teleportTo?: string;
    teleportDisabled?: boolean;
  }>(),
  {
    title: "",
    subtitle: "",
    zIndex: 50,
    closeOnOverlay: true,
    closeOnEscape: true,
    trapFocus: true,
    restoreFocus: true,
    initialFocus: "panel",
    role: undefined,
    blocking: false,
    scheme: "auto",
    showClose: true,
    showTrafficLights: false,
    overlayClass: "sd-overlay",
    panelClass: "max-w-2xl",
    surfaceClass: "",
    bodyClass: "",
    footerClass: "",
    headerClass: "",
    panelStyle: undefined,
    variant: "dialog",
    appear: true,
    ariaLabel: undefined,
    ariaLabelledby: undefined,
    ariaDescribedby: undefined,
    teleportTo: "body",
    teleportDisabled: false,
  },
);

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "close", reason?: CloseReason): void;
  (e: "dismiss-attempt", reason: DismissAttemptReason): void;
}>();

const slots = useSlots();
const shellId = `app-modal-shell-${++appModalShellId}`;
const titleId = `${shellId}-title`;
const subtitleId = `${shellId}-subtitle`;

const resolvedRole = computed(
  () => props.role || (props.blocking ? "alertdialog" : "dialog"),
);
const resolvedShowClose = computed(() => props.showClose && !props.blocking);
const resolvedOverlayClose = computed(() =>
  props.blocking ? false : props.closeOnOverlay,
);
const resolvedEscapeClose = computed(() =>
  props.blocking ? false : props.closeOnEscape,
);
const resolvedLabelledby = computed(
  () => props.ariaLabelledby || (props.title ? titleId : undefined),
);
const resolvedDescribedby = computed(
  () => props.ariaDescribedby || (props.subtitle ? subtitleId : undefined),
);
const surfaceAttrs = computed(() =>
  props.scheme === "auto" ? {} : { "data-sd-scheme": props.scheme },
);

const close = (reason?: CloseReason) => {
  emit("close", reason);
  emit("update:show", false);
};
</script>

<template>
  <OverlayMotion
    :show="show"
    :z-index="zIndex"
    :close-on-overlay="resolvedOverlayClose"
    :close-on-escape="resolvedEscapeClose"
    :trap-focus="trapFocus"
    :restore-focus="restoreFocus"
    :initial-focus="initialFocus"
    :role="resolvedRole"
    :aria-label="ariaLabel"
    :aria-labelledby="resolvedLabelledby"
    :aria-describedby="resolvedDescribedby"
    :teleport-to="teleportTo"
    :teleport-disabled="teleportDisabled"
    :overlay-class="overlayClass"
    :panel-class="panelClass"
    :panel-style="panelStyle"
    :variant="variant"
    :appear="appear"
    @close="close"
    @dismiss-attempt="(reason) => emit('dismiss-attempt', reason)"
  >
    <div
      class="sd-modal-surface sd-surface-window"
      :class="surfaceClass"
      v-bind="surfaceAttrs"
    >
      <AppWindowBar
        :title="title"
        :subtitle="subtitle"
        :title-id="titleId"
        :subtitle-id="subtitleId"
        :header-class="headerClass"
        :show-traffic-lights="showTrafficLights"
        :show-close="resolvedShowClose"
        @close="close('programmatic')"
      >
        <template #leading>
          <slot name="headerLeading" />
        </template>
        <template #title>
          <slot name="title">
            <div v-if="title" :id="titleId" class="sd-window-title">
              {{ title }}
            </div>
          </slot>
        </template>
        <template #actions>
          <slot name="headerActions" />
        </template>
      </AppWindowBar>

      <div class="sd-modal-body" :class="bodyClass">
        <slot />
      </div>

      <div v-if="slots.footer" class="sd-modal-footer" :class="footerClass">
        <slot name="footer" />
      </div>
    </div>
  </OverlayMotion>
</template>
