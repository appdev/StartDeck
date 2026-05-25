<script lang="ts">
let confirmDialogId = 0;
</script>

<script setup lang="ts">
import { computed } from "vue";
import AppButton from "@/components/base/AppButton.vue";
import AppModalShell from "@/components/base/AppModalShell.vue";

const props = withDefaults(
  defineProps<{
    show: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "default" | "danger";
    zIndex?: number | string;
    blocking?: boolean;
  }>(),
  {
    confirmLabel: "确认",
    cancelLabel: "取消",
    tone: "default",
    zIndex: 80,
    blocking: true,
  },
);

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

const dialogId = `confirm-dialog-${++confirmDialogId}`;
const messageId = `${dialogId}-message`;
const isBlocking = computed(() => props.blocking);
const dialogRole = computed(() =>
  isBlocking.value || props.tone === "danger" ? "alertdialog" : "dialog",
);

const close = () => {
  emit("cancel");
  emit("update:show", false);
};

const confirm = () => {
  emit("confirm");
  emit("update:show", false);
};
</script>

<template>
  <AppModalShell
    :show="show"
    :z-index="zIndex"
    :title="title"
    :show-close="!isBlocking"
    :blocking="isBlocking"
    :close-on-overlay="!isBlocking"
    :close-on-escape="!isBlocking"
    initial-focus="cancel"
    :role="dialogRole"
    :aria-describedby="messageId"
    :overlay-class="tone === 'danger' ? 'sd-overlay-strong' : 'sd-overlay'"
    panel-class="w-full max-w-sm"
    surface-class="sd-confirm-dialog-surface sd-compact-window"
    @close="close"
  >
    <p
      :id="messageId"
      class="text-sm leading-6 text-[var(--sd-color-text-secondary)]"
    >
      {{ message }}
    </p>

    <template #footer>
      <AppButton variant="secondary" data-modal-cancel @click="close">
        {{ cancelLabel }}
      </AppButton>
      <AppButton
        :variant="tone === 'danger' ? 'danger' : 'primary'"
        @click="confirm"
      >
        {{ confirmLabel }}
      </AppButton>
    </template>
  </AppModalShell>
</template>
