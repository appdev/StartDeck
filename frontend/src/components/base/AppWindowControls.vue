<script setup lang="ts">
withDefaults(
  defineProps<{
    ariaLabel?: string;
    closeLabel?: string;
    closeTitle?: string;
    showAccent?: boolean;
  }>(),
  {
    ariaLabel: "窗口控制",
    closeLabel: "关闭",
    closeTitle: "",
    showAccent: true,
  },
);

const emit = defineEmits<{
  (e: "close"): void;
}>();
</script>

<template>
  <div class="sd-window-controls" :aria-label="ariaLabel" role="group">
    <span
      v-if="showAccent"
      class="sd-window-control-dot is-green"
      aria-hidden="true"
    ></span>
    <button
      type="button"
      class="sd-window-control-dot is-red"
      :aria-label="closeLabel"
      :title="closeTitle || closeLabel"
      @click="emit('close')"
    ></button>
  </div>
</template>
