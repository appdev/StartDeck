<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    titleId?: string;
    subtitleId?: string;
    headerClass?: string;
    showTrafficLights?: boolean;
    showClose?: boolean;
    closeLabel?: string;
  }>(),
  {
    title: "",
    subtitle: "",
    titleId: undefined,
    subtitleId: undefined,
    headerClass: "",
    showTrafficLights: false,
    showClose: true,
    closeLabel: "关闭",
  },
);

const emit = defineEmits<{
  (e: "close"): void;
}>();

const showTrafficClose = computed(
  () => props.showTrafficLights && props.showClose,
);
const showTrailingClose = computed(
  () => !props.showTrafficLights && props.showClose,
);
</script>

<template>
  <div class="sd-window-bar" :class="headerClass">
    <div class="sd-window-bar-edge is-leading">
      <div v-if="showTrafficLights" class="sd-window-traffic">
        <button
          v-if="showTrafficClose"
          type="button"
          class="sd-window-traffic-button is-danger"
          :aria-label="closeLabel"
          @click="emit('close')"
        >
          <span class="sd-window-traffic-glyph" aria-hidden="true">×</span>
        </button>
        <span v-else class="sd-window-traffic-dot is-danger" aria-hidden="true">
          <span class="sd-window-traffic-glyph" aria-hidden="true">×</span>
        </span>
      </div>
      <slot name="leading" />
    </div>

    <div class="sd-window-title-layer">
      <div class="sd-window-title-stack">
        <slot name="title">
          <div v-if="title" :id="titleId" class="sd-window-title">
            {{ title }}
          </div>
        </slot>
        <div v-if="subtitle" :id="subtitleId" class="sd-window-subtitle">
          {{ subtitle }}
        </div>
      </div>
    </div>

    <div class="sd-window-bar-edge is-trailing">
      <slot name="actions" />
      <button
        v-if="showTrailingClose"
        type="button"
        class="sd-icon-button"
        :aria-label="closeLabel"
        @click="emit('close')"
      >
        <svg
          class="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 6l12 12M18 6L6 18"
          />
        </svg>
      </button>
    </div>
  </div>
</template>
