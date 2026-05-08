<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import OverlayMotion from "@/components/base/OverlayMotion.vue";

const props = withDefaults(
  defineProps<{
    show: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "default" | "danger";
    zIndex?: number | string;
  }>(),
  {
    confirmLabel: "确认",
    cancelLabel: "取消",
    tone: "default",
    zIndex: 80,
  },
);

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

const cancelButtonRef = ref<HTMLButtonElement | null>(null);

const close = () => {
  emit("cancel");
  emit("update:show", false);
};

const confirm = () => {
  emit("confirm");
  emit("update:show", false);
};

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.show) return;
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  }
};

watch(
  () => props.show,
  (show) => {
    if (show) {
      window.addEventListener("keydown", handleKeydown);
      nextTick(() => cancelButtonRef.value?.focus());
    } else {
      window.removeEventListener("keydown", handleKeydown);
    }
  },
);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <OverlayMotion
    :show="show"
    :z-index="zIndex"
    close-on-overlay
    :overlay-class="tone === 'danger' ? 'sd-overlay-strong' : 'sd-overlay'"
    panel-class="max-w-sm"
    @close="close"
  >
    <div
      class="sd-modal-surface"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <div class="sd-modal-header">
        <h3 class="sd-modal-title text-base">{{ title }}</h3>
        <button type="button" class="sd-icon-button" aria-label="关闭" @click="close">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div class="sd-modal-body">
        <p class="text-sm leading-6 text-slate-600">{{ message }}</p>
      </div>

      <div class="sd-modal-footer">
        <button ref="cancelButtonRef" type="button" class="sd-btn sd-btn-secondary" @click="close">
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          class="sd-btn"
          :class="tone === 'danger' ? 'sd-btn-danger' : 'sd-btn-primary'"
          @click="confirm"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </OverlayMotion>
</template>
