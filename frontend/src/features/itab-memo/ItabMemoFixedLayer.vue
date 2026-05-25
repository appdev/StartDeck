<script setup lang="ts">
import { computed } from "vue";
import type { WidgetConfig } from "@/types";
import { MEMO_SVG_PATHS, useItabMemoRuntime } from "./useItabMemoRuntime";
import type { ItabMemoNote, ItabMemoWidgetData } from "./itabMemoTypes";

const props = withDefaults(
  defineProps<{
    widget?: WidgetConfig | null;
    authRequired?: boolean;
  }>(),
  {
    authRequired: true,
  },
);

const emit = defineEmits<{
  updateData: [widget: WidgetConfig, data: ItabMemoWidgetData];
}>();

const fallbackWidget = computed<WidgetConfig>(
  () =>
    props.widget || {
      id: "memo",
      type: "itab-memo-04",
      enable: false,
      isPublic: true,
    },
);
const runtime = useItabMemoRuntime(
  fallbackWidget,
  (data) => {
    if (props.widget) emit("updateData", props.widget, data);
  },
  { authRequired: props.authRequired },
);

const fixedMemoBody = (note: ItabMemoNote) => note.body.trim() || "无内容";
</script>

<template>
  <div
    v-if="widget && runtime.fixedNotes.value.length"
    class="itab-memo-fixed-layer"
    data-itab-memo-fixed-layer
    data-grid-drag-ignore="true"
  >
    <article
      v-for="note in runtime.fixedNotes.value"
      :key="note.id"
      class="notes-fixed-item"
    >
      <div class="notes-fixed-content">
        <span class="text-bold">{{ note.title || "未命名备忘录" }}</span>
        <span class="el-textarea">
          <textarea readonly :value="fixedMemoBody(note)"></textarea>
        </span>
        <span v-if="!note.body.trim()" class="notes-fixed-empty">无内容</span>
        <time>{{ note.listTime || "a few seconds ago" }}</time>
      </div>
      <button
        class="notes-fixed-cancel"
        title="取消固定"
        type="button"
        @click.stop="runtime.togglePin(note.id)"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path :d="MEMO_SVG_PATHS.unpin"></path>
        </svg>
      </button>
    </article>
  </div>
</template>

<style scoped>
.itab-memo-fixed-layer {
  position: fixed;
  top: 90px;
  left: 90px;
  z-index: 45;
  width: 300px;
  height: 141px;
  margin: 0;
  padding: 0;
  overflow-x: auto;
  color: rgba(0, 0, 0, 0.9);
  font-size: 13px;
  line-height: 19.5px;
  list-style: none;
}

.notes-fixed-item {
  position: relative;
  width: 300px;
  height: 131px;
  margin: 0 0 10px;
  padding: 8px 12px;
  overflow: hidden;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.3);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(10px) saturate(116%);
  -webkit-backdrop-filter: blur(10px) saturate(116%);
  box-sizing: border-box;
  color: rgba(0, 0, 0, 0.9);
}

.notes-fixed-content {
  width: 276px;
  height: 95.5px;
}

.notes-fixed-content .text-bold {
  display: block;
  width: 276px;
  height: 19.5px;
  margin: 0 0 4px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notes-fixed-content .el-textarea {
  position: relative;
  display: inline-block;
  width: 276px;
  height: 72px;
}

.notes-fixed-content textarea {
  width: 276px;
  height: 72px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: rgba(0, 0, 0, 0.9);
  font-size: 12px;
  line-height: 18px;
  resize: none;
}

.notes-fixed-empty {
  display: none;
}

.notes-fixed-content time {
  display: inline;
  color: rgba(0, 0, 0, 0.36);
  font-size: 12px;
  line-height: 16px;
}

.notes-fixed-cancel {
  position: absolute;
  top: 6px;
  right: 10px;
  display: block;
  width: 18px;
  height: 23px;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(0, 0, 0, 0.9);
  cursor: pointer;
}

.notes-fixed-cancel svg {
  display: inline-flex;
  width: 18px;
  height: 18px;
  fill: currentColor;
}
</style>
