<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";
import { useItabTodoRuntime } from "./useItabTodoRuntime";
import type { ItabTodoWidgetData } from "./itabTodoTypes";

const TODO_ICON_URL = "/itab/todo/todo.svg";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: ItabWidgetSizeKey;
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
const visibleRows = computed(() => {
  if (!runtime.canReadTodo.value) return [];
  return runtime.outerRows.value;
});

const toggleFromOuter = (taskId: string) => {
  runtime.toggleTask(taskId);
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
      :class="{ 'is-wide': sizeKey === '2x4' }"
    >
      <span class="todo-icon-main">
        <strong>
          {{
            runtime.canReadTodo.value
              ? `待办事项(${runtime.unfinishedTasks.value.length})`
              : "待办事项"
          }}
        </strong>
        <span v-if="!runtime.canReadTodo.value" class="todo-icon-row">
          <i></i>
          <em>登录后使用待办</em>
        </span>
        <span
          v-for="task in visibleRows"
          :key="task.id"
          class="todo-icon-row"
          :class="{ 'has-checkbox': sizeKey === '2x4' }"
        >
          <button
            v-if="sizeKey === '2x4'"
            class="todo-icon-check"
            type="button"
            :aria-label="`完成 ${task.text}`"
            @click.stop="toggleFromOuter(task.id)"
          ></button>
          <i v-else></i>
          <em>{{ task.text }}</em>
        </span>
        <span
          v-if="runtime.canReadTodo.value && visibleRows.length === 0"
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

.todo-icon-main strong {
  display: flex;
  height: 24px;
  align-items: center;
  padding: 0 8.4px;
  color: var(--sd-theme-itab-todo-todo-widget-accent-text-01);
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
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

.todo-icon-row em {
  display: block;
  min-width: 0;
  overflow: hidden;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
