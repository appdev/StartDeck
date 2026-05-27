<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Trash2 } from "@lucide/vue";
import type { WidgetConfig } from "@/types";
import { useItabTodoRuntime } from "./useItabTodoRuntime";
import type { ItabTodoSizeKey, ItabTodoWidgetData } from "./itabTodoTypes";

const TODO_ICON_URL = "/itab/todo/todo.svg";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: ItabTodoSizeKey;
  refreshToken?: number;
}>();

const emit = defineEmits<{
  updateData: [data: ItabTodoWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useItabTodoRuntime(
  widgetRef,
  (data) => emit("updateData", data),
  { remoteSync: true },
);
const lastRefreshToken = ref(props.refreshToken ?? 0);

const isIconOnly = computed(() =>
  ["1x1", "1x2", "2x1"].includes(props.sizeKey),
);
const isFourByFour = computed(() => props.sizeKey === "4x4");
const isInteractiveList = computed(
  () => props.sizeKey === "2x4" || props.sizeKey === "4x4",
);
const visiblePendingRows = computed(() => {
  if (!runtime.canReadTodo.value) return [];
  return isFourByFour.value
    ? runtime.unfinishedTasks.value
    : runtime.unfinishedTasks.value.slice(0, 4);
});
const visibleCompletedRows = computed(() => {
  if (!runtime.canReadTodo.value || !isFourByFour.value) return [];
  return runtime.completedTasks.value;
});
const hasVisibleTasks = computed(
  () =>
    visiblePendingRows.value.length > 0 ||
    visibleCompletedRows.value.length > 0,
);

const toggleFromOuter = (taskId: string) => {
  runtime.toggleTask(taskId);
};

const removeFromOuter = (taskId: string) => {
  runtime.removeTask(taskId);
};

watch(
  () => props.refreshToken,
  (value) => {
    const token = value ?? 0;
    if (token === lastRefreshToken.value) return;
    lastRefreshToken.value = token;
    void runtime.pollRemote(true);
  },
);
</script>

<template>
  <span
    class="itab-todo-widget"
    data-itab-todo-widget
    :data-itab-todo-size="sizeKey"
  >
    <span v-if="isIconOnly" class="todo-icon-asset">
      <img alt="ToDo" :src="TODO_ICON_URL" />
    </span>
    <span
      v-else
      class="todo-icon-content"
      :class="{
        'is-wide': sizeKey === '2x4',
        'is-board': isFourByFour,
      }"
    >
      <span class="todo-icon-main">
        <strong class="todo-icon-title">
          <span>
            {{
              runtime.canReadTodo.value
                ? `待办事项(${runtime.unfinishedTasks.value.length})`
                : "待办事项"
            }}
          </span>
          <small v-if="isFourByFour && runtime.completedTasks.value.length > 0">
            已完成 {{ runtime.completedTasks.value.length }}
          </small>
        </strong>
        <span v-if="!runtime.canReadTodo.value" class="todo-icon-row">
          <i></i>
          <em>登录后使用待办</em>
        </span>
        <span
          v-for="task in visiblePendingRows"
          :key="task.id"
          class="todo-icon-row"
          :class="{ 'has-checkbox': isInteractiveList }"
        >
          <button
            v-if="isInteractiveList"
            class="todo-icon-check"
            type="button"
            data-grid-drag-ignore="true"
            data-itab-inner-control="true"
            :aria-label="`完成 ${task.text}`"
            @click.stop="toggleFromOuter(task.id)"
          ></button>
          <i v-else></i>
          <em>{{ task.text }}</em>
          <button
            v-if="isFourByFour"
            class="todo-icon-delete"
            type="button"
            data-grid-drag-ignore="true"
            data-itab-inner-control="true"
            :aria-label="`删除 ${task.text}`"
            @click.stop="removeFromOuter(task.id)"
          >
            <Trash2 :size="14" aria-hidden="true" />
          </button>
        </span>
        <template v-if="isFourByFour && visibleCompletedRows.length > 0">
          <span class="todo-icon-section">已完成</span>
          <span
            v-for="task in visibleCompletedRows"
            :key="`done-${task.id}`"
            class="todo-icon-row is-done has-checkbox"
          >
            <button
              class="todo-icon-check is-done"
              type="button"
              data-grid-drag-ignore="true"
              data-itab-inner-control="true"
              :aria-label="`恢复 ${task.text}`"
              @click.stop="toggleFromOuter(task.id)"
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path
                  d="M2.3 6.2 4.9 8.7 9.8 3.4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <em>{{ task.text }}</em>
            <button
              class="todo-icon-delete"
              type="button"
              data-grid-drag-ignore="true"
              data-itab-inner-control="true"
              :aria-label="`删除 ${task.text}`"
              @click.stop="removeFromOuter(task.id)"
            >
              <Trash2 :size="14" aria-hidden="true" />
            </button>
          </span>
        </template>
        <span
          v-if="runtime.canReadTodo.value && !hasVisibleTasks"
          class="todo-icon-row"
        >
          <i></i>
          <em>暂无待办事项</em>
        </span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.itab-todo-widget,
.todo-icon-asset,
.todo-icon-content {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.todo-icon-asset {
  position: relative;
  background: var(--sd-theme-itab-todo-todo-widget-surface-01);
}

.todo-icon-asset img {
  display: block;
  width: 100%;
  height: 100%;
  background-color: var(--sd-theme-itab-todo-todo-widget-accent-surface-01);
  object-fit: contain;
}

.todo-icon-content {
  display: flex;
  overflow: hidden;
  background: var(--sd-theme-itab-todo-todo-widget-surface-01);
  color: var(--sd-theme-itab-todo-todo-widget-text-01);
}

.todo-icon-main {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden auto;
  scrollbar-width: none;
}

.todo-icon-main::-webkit-scrollbar {
  display: none;
}

.todo-icon-content.is-wide .todo-icon-main {
  width: 100%;
}

.todo-icon-title {
  display: flex;
  min-height: 24px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 8.4px;
  color: var(--sd-theme-itab-todo-todo-widget-accent-text-01);
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
}

.todo-icon-title span,
.todo-icon-title small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-icon-title small {
  flex: 0 0 auto;
  color: var(--sd-theme-itab-todo-todo-widget-text-01);
  font-size: 10px;
  font-weight: 500;
  opacity: 0.62;
}

.todo-icon-row {
  display: flex;
  height: 30px;
  align-items: center;
  padding: 0 10.416px;
  color: var(--sd-theme-itab-todo-todo-widget-text-01);
  font-size: 13.02px;
  line-height: 19.53px;
}

.todo-icon-row.has-checkbox {
  padding: 0 14px;
}

.todo-icon-row i {
  display: block;
  width: 3px;
  height: 12px;
  flex: 0 0 3px;
  margin-right: 7px;
  border-radius: 3px;
  background: var(--sd-theme-itab-todo-todo-widget-surface-02);
}

.todo-icon-check {
  display: block;
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  margin-right: 10px;
  padding: 0;
  border: 2px solid var(--sd-theme-itab-todo-todo-widget-border-01);
  border-radius: 4px;
  background: var(--sd-theme-itab-todo-todo-widget-surface-01);
  cursor: pointer;
}

.todo-icon-check:hover {
  border-color: var(--sd-theme-itab-todo-todo-widget-accent-border-01);
}

.todo-icon-check.is-done {
  display: grid;
  place-items: center;
  border-color: var(--sd-theme-itab-todo-todo-widget-accent-border-01);
  background: var(--sd-theme-itab-todo-todo-widget-accent-surface-01);
  color: var(--sd-theme-itab-todo-todo-widget-surface-01);
}

.todo-icon-check svg {
  width: 11px;
  height: 11px;
}

.todo-icon-delete {
  display: none;
}

.todo-icon-row em {
  display: block;
  min-width: 0;
  overflow: hidden;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-icon-content.is-board .todo-icon-main {
  padding: 10px 0;
  scrollbar-width: thin;
  scrollbar-color: color-mix(
      in srgb,
      var(--sd-theme-itab-todo-todo-widget-text-01) 26%,
      transparent
    )
    transparent;
}

.todo-icon-content.is-board .todo-icon-main::-webkit-scrollbar {
  display: block;
  width: 6px;
}

.todo-icon-content.is-board .todo-icon-main::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(
    in srgb,
    var(--sd-theme-itab-todo-todo-widget-text-01) 26%,
    transparent
  );
}

.todo-icon-content.is-board .todo-icon-main::-webkit-scrollbar-track {
  background: transparent;
}

.todo-icon-content.is-board .todo-icon-title {
  min-height: 28px;
  padding: 0 18px 4px;
  font-size: 14px;
}

.todo-icon-content.is-board .todo-icon-row {
  min-height: 31px;
  height: auto;
  align-items: flex-start;
  padding: 6px 14px 6px 18px;
  font-size: 13px;
  line-height: 18px;
}

.todo-icon-content.is-board .todo-icon-check {
  margin-top: 1px;
}

.todo-icon-content.is-board .todo-icon-row em {
  flex: 1 1 auto;
  overflow: visible;
  white-space: normal;
  text-overflow: clip;
  overflow-wrap: anywhere;
}

.todo-icon-content.is-board .todo-icon-delete {
  display: grid;
  width: 24px;
  height: 24px;
  align-self: flex-start;
  flex: 0 0 24px;
  margin: -3px 0 -3px auto;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--sd-theme-itab-todo-todo-widget-text-01);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease;
}

.todo-icon-content.is-board .todo-icon-row:hover .todo-icon-delete,
.todo-icon-content.is-board .todo-icon-row:focus-within .todo-icon-delete {
  opacity: 0.72;
  pointer-events: auto;
}

.todo-icon-content.is-board .todo-icon-delete:hover,
.todo-icon-content.is-board .todo-icon-delete:focus-visible {
  background: color-mix(
    in srgb,
    var(--sd-theme-itab-todo-todo-widget-accent-surface-01) 16%,
    transparent
  );
  color: var(--sd-theme-itab-todo-todo-widget-accent-text-01);
  opacity: 1;
  outline: none;
}

.todo-icon-content.is-board .todo-icon-row.is-done {
  color: color-mix(
    in srgb,
    var(--sd-theme-itab-todo-todo-widget-text-01) 62%,
    transparent
  );
}

.todo-icon-content.is-board .todo-icon-row.is-done em {
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

.todo-icon-section,
.todo-icon-more {
  display: block;
  overflow: hidden;
  padding: 8px 18px 3px;
  color: var(--sd-theme-itab-todo-todo-widget-text-01);
  font-size: 11px;
  line-height: 14px;
  opacity: 0.58;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-icon-more {
  padding-top: 6px;
}
</style>
