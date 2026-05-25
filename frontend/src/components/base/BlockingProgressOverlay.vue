<script setup lang="ts">
import { computed } from "vue";
import AppModalShell from "@/components/base/AppModalShell.vue";

const props = withDefaults(
  defineProps<{
    show: boolean;
    title: string;
    message?: string;
    progress?: number;
    total?: number;
    progressLabel?: string;
    zIndex?: number | string;
  }>(),
  {
    message: "",
    progress: 0,
    total: 0,
    progressLabel: "",
    zIndex: 90,
  },
);

const progressPercent = computed(() => {
  if (!props.total || props.total <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((props.progress / props.total) * 100)),
  );
});
</script>

<template>
  <AppModalShell
    :show="show"
    :z-index="zIndex"
    :title="title"
    :subtitle="message"
    blocking
    :show-close="false"
    overlay-class="sd-overlay-strong"
    panel-class="w-full max-w-sm"
    surface-class="max-w-sm sd-compact-window"
    body-class="pt-4"
  >
    <div class="sd-progress-stack">
      <div class="flex justify-center">
        <div class="sd-progress-spinner" aria-hidden="true" />
      </div>

      <div
        v-if="total > 0"
        class="grid gap-2 text-center text-sm text-[var(--sd-color-text-secondary)]"
      >
        <div class="sd-progress-bar" aria-hidden="true">
          <div
            class="sd-progress-bar-fill"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
        <div>
          {{ progressLabel || `${progress} / ${total}` }}
        </div>
      </div>
    </div>
  </AppModalShell>
</template>
