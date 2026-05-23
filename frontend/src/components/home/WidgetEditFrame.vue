<script setup lang="ts">
withDefaults(
  defineProps<{
    editing?: boolean;
    selected?: boolean;
    resizeActive?: boolean;
    deleteLabel?: string;
    widgetType?: string;
    widgetSize?: string;
  }>(),
  {
    editing: false,
    selected: false,
    resizeActive: false,
    deleteLabel: "移除组件",
    widgetType: "",
    widgetSize: "",
  },
);

defineEmits<{
  select: [];
  delete: [];
  resizeStart: [event: PointerEvent];
}>();
</script>

<template>
  <div
    class="sd-home-widget-frame"
    :class="{
      'is-editing': editing,
      'is-selected': selected,
      'is-resizing': resizeActive,
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
        ×
      </button>
      <button
        type="button"
        class="sd-home-widget-resize-grip widget-resize-grip"
        data-grid-drag-ignore="true"
        aria-label="调整组件尺寸"
        title="调整组件尺寸"
        @pointerdown.stop="$emit('resizeStart', $event)"
        @click.stop
      />
    </template>
  </div>
</template>
