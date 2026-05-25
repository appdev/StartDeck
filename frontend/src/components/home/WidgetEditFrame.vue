<script setup lang="ts">
import { X as XIcon } from "@lucide/vue";

withDefaults(
  defineProps<{
    editing?: boolean;
    selected?: boolean;
    deleteLabel?: string;
    widgetType?: string;
    widgetSize?: string;
  }>(),
  {
    editing: false,
    selected: false,
    deleteLabel: "移除组件",
    widgetType: "",
    widgetSize: "",
  },
);

defineEmits<{
  select: [];
  delete: [];
}>();
</script>

<template>
  <div
    class="sd-home-widget-frame"
    :class="{
      'is-editing': editing,
      'is-selected': selected,
    }"
    :data-widget-type="widgetType || null"
    :data-widget-size="widgetSize || null"
    @click.capture="$emit('select')"
  >
    <div class="sd-home-widget-content">
      <slot />
    </div>

    <slot name="overlay" />

    <template v-if="editing">
      <button
        type="button"
        class="sd-home-widget-delete"
        data-grid-drag-ignore="true"
        :aria-label="deleteLabel"
        :title="deleteLabel"
        @click.stop="$emit('delete')"
      >
        <XIcon :size="15" :stroke-width="3" aria-hidden="true" />
      </button>
    </template>
  </div>
</template>
