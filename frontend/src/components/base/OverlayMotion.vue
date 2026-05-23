<script lang="ts">
type CloseReason = "overlay" | "escape" | "programmatic";
type DismissAttemptReason = "overlay" | "escape";
type InitialFocusTarget = "panel" | "first" | "cancel" | string;

const overlayInstances = new Map<string, (event: KeyboardEvent) => void>();
let isGlobalKeydownBound = false;
let overlaySequence = 0;
const scrollLockedOverlays = new Set<string>();
let previousHtmlOverflow = "";
let previousBodyOverflow = "";
let previousBodyOverscrollBehavior = "";
let previousBodyTouchAction = "";

const handleGlobalKeydown = (event: KeyboardEvent) => {
  const roots = Array.from(
    document.querySelectorAll<HTMLElement>("[data-overlay-motion-id]"),
  );
  for (let index = roots.length - 1; index >= 0; index -= 1) {
    const id = roots[index]?.dataset.overlayMotionId;
    const handler = id ? overlayInstances.get(id) : undefined;
    if (handler) {
      handler(event);
      return;
    }
  }
  const handlers = Array.from(overlayInstances.values());
  const topmost = handlers[handlers.length - 1];
  topmost?.(event);
};

const ensureGlobalKeydown = () => {
  if (isGlobalKeydownBound) return;
  window.addEventListener("keydown", handleGlobalKeydown, true);
  isGlobalKeydownBound = true;
};

const releaseGlobalKeydown = () => {
  if (!isGlobalKeydownBound || overlayInstances.size > 0) return;
  window.removeEventListener("keydown", handleGlobalKeydown, true);
  isGlobalKeydownBound = false;
};

const lockDocumentScroll = (id: string) => {
  if (typeof document === "undefined") return;
  if (scrollLockedOverlays.has(id)) return;
  const html = document.documentElement;
  const body = document.body;
  if (scrollLockedOverlays.size === 0) {
    previousHtmlOverflow = html.style.overflow;
    previousBodyOverflow = body.style.overflow;
    previousBodyOverscrollBehavior = body.style.overscrollBehavior;
    previousBodyTouchAction = body.style.touchAction;
  }
  scrollLockedOverlays.add(id);
  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "none";
  body.style.touchAction = "none";
};

const unlockDocumentScroll = (id: string) => {
  if (typeof document === "undefined") return;
  if (!scrollLockedOverlays.has(id)) return;
  scrollLockedOverlays.delete(id);
  if (scrollLockedOverlays.size > 0) return;
  const html = document.documentElement;
  const body = document.body;
  html.style.overflow = previousHtmlOverflow;
  body.style.overflow = previousBodyOverflow;
  body.style.overscrollBehavior = previousBodyOverscrollBehavior;
  body.style.touchAction = previousBodyTouchAction;
};
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    show: boolean;
    zIndex?: number | string;
    closeOnOverlay?: boolean;
    closeOnEscape?: boolean;
    trapFocus?: boolean;
    restoreFocus?: boolean;
    initialFocus?: InitialFocusTarget;
    role?: "dialog" | "alertdialog";
    ariaModal?: boolean;
    ariaLabel?: string;
    ariaLabelledby?: string;
    ariaDescribedby?: string;
    teleportTo?: string;
    teleportDisabled?: boolean;
    overlayClass?: string;
    panelClass?: string;
    panelStyle?: string | Record<string, string | number>;
    variant?: "dialog" | "sheet" | "popover" | "context-menu";
    appear?: boolean;
    panelTag?: string;
  }>(),
  {
    zIndex: 50,
    closeOnOverlay: false,
    closeOnEscape: false,
    trapFocus: false,
    restoreFocus: false,
    initialFocus: undefined,
    role: undefined,
    ariaModal: true,
    ariaLabel: undefined,
    ariaLabelledby: undefined,
    ariaDescribedby: undefined,
    teleportTo: "body",
    teleportDisabled: false,
    overlayClass: "",
    panelClass: "",
    panelStyle: undefined,
    variant: "dialog",
    appear: true,
    panelTag: "div",
  },
);

const emit = defineEmits<{
  (e: "close", reason?: CloseReason): void;
  (e: "dismiss-attempt", reason: DismissAttemptReason): void;
  (e: "overlay-click", event: MouseEvent): void;
  (e: "overlay-mousedown", event: MouseEvent): void;
  (e: "overlay-mouseup", event: MouseEvent): void;
}>();

const panelRef = ref<HTMLElement | null>(null);
const overlayId = `overlay-motion-${++overlaySequence}`;
const elementBeforeOpen = ref<HTMLElement | null>(null);

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const registerOverlay = () => {
  overlayInstances.delete(overlayId);
  overlayInstances.set(overlayId, handleKeydown);
  ensureGlobalKeydown();
};

const unregisterOverlay = () => {
  overlayInstances.delete(overlayId);
  releaseGlobalKeydown();
};

const getFocusableElements = () => {
  const panel = panelRef.value;
  if (!panel) return [];
  return Array.from(
    panel.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter((el) => {
    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      !el.hasAttribute("disabled")
    );
  });
};

const focusInitialTarget = () => {
  const panel = panelRef.value;
  if (!panel) return;

  let target: HTMLElement | null = null;
  if (props.initialFocus === "cancel") {
    target = panel.querySelector<HTMLElement>("[data-modal-cancel]");
  } else if (props.initialFocus === "first") {
    target = getFocusableElements()[0] ?? null;
  } else if (props.initialFocus && props.initialFocus !== "panel") {
    try {
      target = panel.querySelector<HTMLElement>(props.initialFocus);
    } catch {
      target = null;
    }
  }

  if (!target && props.initialFocus === "panel") {
    target = panel;
  }
  if (!target && props.trapFocus) {
    target = getFocusableElements()[0] ?? panel;
  }

  target?.focus();
};

const restorePreviousFocus = () => {
  const target = elementBeforeOpen.value;
  if (target && document.contains(target)) {
    target.focus();
  }
  elementBeforeOpen.value = null;
};

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.show) return;

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    if (props.closeOnEscape) {
      emit("close", "escape");
    } else {
      emit("dismiss-attempt", "escape");
    }
    return;
  }

  if (event.key !== "Tab" || !props.trapFocus) return;

  const focusable = getFocusableElements();
  if (focusable.length === 0) {
    event.preventDefault();
    panelRef.value?.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first?.focus();
  }
};

const handleOverlayClick = (event: MouseEvent) => {
  if (event.target !== event.currentTarget) return;
  emit("overlay-click", event);
  if (props.closeOnOverlay) {
    emit("close", "overlay");
  } else {
    emit("dismiss-attempt", "overlay");
  }
};

const handleOverlayMouseDown = (event: MouseEvent) => {
  if (event.target !== event.currentTarget) return;
  emit("overlay-mousedown", event);
};

const handleOverlayMouseUp = (event: MouseEvent) => {
  if (event.target !== event.currentTarget) return;
  emit("overlay-mouseup", event);
};

const variantRootClass = computed(() => {
  if (props.variant === "popover" || props.variant === "context-menu") {
    return "items-start justify-start";
  }
  return "items-center justify-center";
});

const variantPanelClass = computed(() => {
  if (props.variant === "popover" || props.variant === "context-menu") {
    return "pointer-events-auto";
  }
  return "";
});

const panelAriaAttrs = computed(() => ({
  role: props.role,
  "aria-modal": props.role ? String(props.ariaModal) : undefined,
  "aria-label": props.ariaLabel,
  "aria-labelledby": props.ariaLabelledby,
  "aria-describedby": props.ariaDescribedby,
}));
const shouldLockDocumentScroll = computed(
  () => props.variant === "dialog" || props.variant === "sheet",
);

watch(
  () => props.show,
  (show) => {
    if (show) {
      elementBeforeOpen.value = document.activeElement as HTMLElement | null;
      registerOverlay();
      if (shouldLockDocumentScroll.value) {
        lockDocumentScroll(overlayId);
      }
      nextTick(focusInitialTarget);
    } else {
      unregisterOverlay();
      unlockDocumentScroll(overlayId);
      if (props.restoreFocus) {
        nextTick(restorePreviousFocus);
      }
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  unregisterOverlay();
  unlockDocumentScroll(overlayId);
  if (props.restoreFocus) {
    restorePreviousFocus();
  }
});
</script>

<template>
  <Teleport :to="teleportTo" :disabled="teleportDisabled">
    <Transition name="overlay-motion-root" :appear="appear">
      <div
        v-if="show"
        :style="{ zIndex }"
        :data-overlay-motion-id="overlayId"
        :data-motion-variant="variant"
        :class="[
          'overlay-motion-root fixed inset-0 flex',
          variantRootClass,
          overlayClass,
        ]"
        @click="handleOverlayClick"
        @mousedown="handleOverlayMouseDown"
        @mouseup="handleOverlayMouseUp"
      >
        <component
          :is="panelTag"
          ref="panelRef"
          v-bind="panelAriaAttrs"
          :tabindex="trapFocus || initialFocus === 'panel' ? -1 : undefined"
          :class="['overlay-motion-panel', variantPanelClass, panelClass]"
          :style="panelStyle"
          @click.stop
        >
          <slot />
        </component>
      </div>
    </Transition>
  </Teleport>
</template>
