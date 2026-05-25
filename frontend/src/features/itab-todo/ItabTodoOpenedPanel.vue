<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from "vue";
import type { WidgetConfig } from "@/types";
import { useItabTodoRuntime } from "./useItabTodoRuntime";
import type { ItabTodoWidgetData } from "./itabTodoTypes";

const props = defineProps<{
  widget: WidgetConfig;
}>();

const emit = defineEmits<{
  updateData: [data: ItabTodoWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useItabTodoRuntime(widgetRef, (data) =>
  emit("updateData", data),
);

const panelRef = ref<HTMLElement | null>(null);
const scrollRef = ref<HTMLElement | null>(null);
const todoListScrolling = ref(false);
const todoScrollbar = reactive({
  visible: false,
  top: 0,
  height: 42,
});
let todoScrollHideTimer: number | null = null;

const resizeTodoTextarea = (textarea: HTMLTextAreaElement) => {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(31, textarea.scrollHeight)}px`;
};

const updateTodoScrollbar = (element?: HTMLElement | null) => {
  const scrollElement = element || scrollRef.value;
  if (!scrollElement) return;

  const { clientHeight, scrollHeight, scrollTop } = scrollElement;
  const canScroll = scrollHeight > clientHeight + 1;
  todoScrollbar.visible = canScroll;
  if (!canScroll) {
    todoScrollbar.top = 0;
    todoScrollbar.height = 42;
    return;
  }

  const thumbHeight = Math.max(
    42,
    (clientHeight / scrollHeight) * clientHeight,
  );
  const scrollRange = scrollHeight - clientHeight;
  const thumbRange = clientHeight - thumbHeight;
  todoScrollbar.height = thumbHeight;
  todoScrollbar.top =
    scrollRange > 0 ? (scrollTop / scrollRange) * thumbRange : 0;
};

const resizeTodoTextareas = () => {
  panelRef.value
    ?.querySelectorAll<HTMLTextAreaElement>(
      "[data-todo-textarea], [data-todo-draft-textarea]",
    )
    .forEach(resizeTodoTextarea);
  updateTodoScrollbar();
};

const scheduleTodoTextareaResize = () => {
  void nextTick(() => resizeTodoTextareas());
};

const todoScrollbarStyle = computed(() => ({
  height: `${todoScrollbar.height}px`,
  transform: `translateY(${todoScrollbar.top}px)`,
}));

const resizeTodoTextareaFromEvent = (event: Event) => {
  resizeTodoTextarea(event.target as HTMLTextAreaElement);
  updateTodoScrollbar();
};

const handleTodoListScroll = (event: Event) => {
  updateTodoScrollbar(event.currentTarget as HTMLElement);
  todoListScrolling.value = true;
  if (todoScrollHideTimer) {
    window.clearTimeout(todoScrollHideTimer);
  }
  todoScrollHideTimer = window.setTimeout(() => {
    todoListScrolling.value = false;
    todoScrollHideTimer = null;
  }, 900);
};

const createTask = () => {
  runtime.createTask();
  scheduleTodoTextareaResize();
};

const updateTaskTitle = (taskId: string, event: Event) => {
  const textarea = event.target as HTMLTextAreaElement;
  runtime.updateTaskText(taskId, textarea.value);
  resizeTodoTextarea(textarea);
  updateTodoScrollbar();
};

const toggleTask = (taskId: string) => {
  runtime.toggleTask(taskId);
  scheduleTodoTextareaResize();
};

const removeTask = (taskId: string) => {
  runtime.removeTask(taskId);
  scheduleTodoTextareaResize();
};

watch(
  [() => runtime.tasks.value, () => runtime.draft.value],
  scheduleTodoTextareaResize,
  { deep: true },
);

onMounted(scheduleTodoTextareaResize);
onUnmounted(() => {
  if (todoScrollHideTimer) {
    window.clearTimeout(todoScrollHideTimer);
    todoScrollHideTimer = null;
  }
});
</script>

<template>
  <div ref="panelRef" class="itab-todo-opened-panel is-basic">
    <main class="todo-main-pane">
      <h2>待办事项</h2>
      <div v-if="runtime.canWriteTodo.value" class="todo-add">
        <i aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <path
              d="M8.5 2.75a.75.75 0 0 0-1.5 0V7H2.75a.75.75 0 0 0 0 1.5H7v4.25a.75.75 0 0 0 1.5 0V8.5h4.25a.75.75 0 0 0 0-1.5H8.5V2.75z"
              fill="currentColor"
            />
          </svg>
        </i>
        <textarea
          id="todoAddInput"
          v-model="runtime.draft.value"
          data-todo-draft-textarea
          maxlength="200"
          placeholder="添加任务"
          rows="1"
          @input="resizeTodoTextareaFromEvent"
          @keydown.enter.prevent="createTask"
        ></textarea>
      </div>
      <section
        class="todo-content-frame"
        :class="{ 'is-scrolling': todoListScrolling }"
      >
        <div
          ref="scrollRef"
          class="todo-content-scroll"
          @scroll="handleTodoListScroll"
        >
          <div v-if="!runtime.canReadTodo.value" class="todo-empty">
            <svg viewBox="0 0 79 86" aria-hidden="true">
              <ellipse
                cx="39.5"
                cy="81.333"
                rx="39.5"
                ry="4.667"
                fill="var(--sd-itab-todo-empty-shadow)"
              />
              <path
                d="M18 8h38a6 6 0 0 1 6 6v45a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z"
                fill="var(--sd-itab-todo-empty-paper)"
              />
              <path
                d="M24 25h26M24 38h31M24 51h20"
                stroke="var(--sd-itab-todo-empty-line)"
                stroke-width="4"
                stroke-linecap="round"
              />
            </svg>
            <p>登录后使用待办</p>
          </div>
          <div v-else-if="!runtime.tasks.value.length" class="todo-empty">
            <svg viewBox="0 0 79 86" aria-hidden="true">
              <ellipse
                cx="39.5"
                cy="81.333"
                rx="39.5"
                ry="4.667"
                fill="var(--sd-itab-todo-empty-shadow)"
              />
              <path
                d="M18 8h38a6 6 0 0 1 6 6v45a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z"
                fill="var(--sd-itab-todo-empty-paper)"
              />
              <path
                d="M24 25h26M24 38h31M24 51h20"
                stroke="var(--sd-itab-todo-empty-line)"
                stroke-width="4"
                stroke-linecap="round"
              />
            </svg>
            <p>赶快添加您的待办吧</p>
          </div>
          <ul v-else class="todo-content-ul">
            <li
              v-for="task in runtime.unfinishedTasks.value"
              :key="task.id"
              class="todo-content-li"
            >
              <span class="todo-check-bg">
                <button
                  class="todo-check"
                  type="button"
                  :disabled="!runtime.canWriteTodo.value"
                  @click="toggleTask(task.id)"
                ></button>
              </span>
              <span class="todo-row-main">
                <textarea
                  :value="task.text"
                  data-todo-textarea
                  rows="1"
                  :readonly="!runtime.canWriteTodo.value"
                  @input="updateTaskTitle(task.id, $event)"
                ></textarea>
                <button
                  v-if="runtime.canWriteTodo.value"
                  class="todo-delete"
                  title="删除"
                  type="button"
                  @click="removeTask(task.id)"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M6.5 7v4a.5.5 0 0 0 1 0V7a.5.5 0 0 0-1 0zM9 6.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V7a.5.5 0 0 1 .5-.5zM10 4h3a.5.5 0 0 1 0 1h-.553l-.752 6.776A2.5 2.5 0 0 1 9.21 14H6.79a2.5 2.5 0 0 1-2.485-2.224L3.552 5H3a.5.5 0 0 1 0-1h3a2 2 0 1 1 4 0zM8 3a1 1 0 0 0-1 1h2a1 1 0 0 0-1-1zM4.559 5l.74 6.666A1.5 1.5 0 0 0 6.79 13h2.42a1.5 1.5 0 0 0 1.49-1.334L11.442 5H4.56z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </span>
            </li>
            <li
              v-if="runtime.completedTasks.value.length"
              class="todo-done-label"
            >
              已完成 {{ runtime.completedTasks.value.length }}
            </li>
            <li
              v-for="task in runtime.completedTasks.value"
              :key="task.id"
              class="todo-content-li done"
            >
              <span class="todo-check-bg">
                <button
                  class="todo-check done"
                  type="button"
                  :disabled="!runtime.canWriteTodo.value"
                  @click="toggleTask(task.id)"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M13.485 4.515a.75.75 0 0 1 0 1.06l-6.25 6.25a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.72-5.72a.75.75 0 0 1 1.06 0z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </span>
              <span class="todo-row-main">
                <textarea
                  :value="task.text"
                  data-todo-textarea
                  rows="1"
                  :readonly="!runtime.canWriteTodo.value"
                  @input="updateTaskTitle(task.id, $event)"
                ></textarea>
                <button
                  v-if="runtime.canWriteTodo.value"
                  class="todo-delete"
                  title="删除"
                  type="button"
                  @click="removeTask(task.id)"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M6.5 7v4a.5.5 0 0 0 1 0V7a.5.5 0 0 0-1 0zM9 6.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V7a.5.5 0 0 1 .5-.5zM10 4h3a.5.5 0 0 1 0 1h-.553l-.752 6.776A2.5 2.5 0 0 1 9.21 14H6.79a2.5 2.5 0 0 1-2.485-2.224L3.552 5H3a.5.5 0 0 1 0-1h3a2 2 0 1 1 4 0zM8 3a1 1 0 0 0-1 1h2a1 1 0 0 0-1-1zM4.559 5l.74 6.666A1.5 1.5 0 0 0 6.79 13h2.42a1.5 1.5 0 0 0 1.49-1.334L11.442 5H4.56z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </span>
            </li>
          </ul>
        </div>
        <span
          v-if="todoScrollbar.visible"
          class="todo-scrollbar-thumb"
          aria-hidden="true"
          :style="todoScrollbarStyle"
        ></span>
      </section>
    </main>
  </div>
</template>

<style scoped>
.itab-todo-opened-panel {
  display: block;
  width: 998px;
  height: 600px;
  background: var(--sd-theme-itab-todo-todo-opened-panel-surface-01);
  color: var(--sd-theme-itab-todo-todo-opened-panel-text-01);
  overflow: hidden;
}

.todo-main-pane {
  position: relative;
  display: flex;
  width: 998px;
  height: 600px;
  flex-direction: column;
  padding: 28px 22px;
  background: var(--sd-theme-itab-todo-todo-opened-panel-surface-01);
  color: var(--sd-theme-itab-todo-todo-opened-panel-text-01);
  overflow: hidden;
}

.todo-main-pane h2 {
  display: block;
  width: 954px;
  height: 34px;
  margin: 0 0 12px;
  color: var(--sd-theme-itab-todo-todo-opened-panel-text-01);
  font-size: 22px;
  font-weight: 700;
  line-height: 34px;
}

.todo-add {
  position: relative;
  width: 954px;
  height: auto;
  min-height: 42px;
  margin: 0 0 12px;
  border-radius: 8px;
  background: var(--sd-theme-itab-todo-todo-opened-panel-surface-02);
}

.todo-add > i {
  position: absolute;
  top: 12px;
  left: 8px;
  display: flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  color: var(--sd-theme-itab-todo-todo-opened-panel-text-02);
}

.todo-add > i svg {
  width: 16px;
  height: 16px;
}

.todo-add textarea {
  position: relative;
  z-index: 1;
  display: block;
  width: 954px;
  min-height: 42px;
  padding: 10px 16px 10px 32px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--sd-theme-itab-todo-todo-opened-panel-text-01);
  font: inherit;
  font-size: 14px;
  line-height: 21px;
  resize: none;
  overflow: hidden;
}

.todo-content-frame {
  position: relative;
  width: 954px;
  min-height: 0;
  flex: 1 1 auto;
}

.todo-content-scroll {
  width: 954px;
  height: 100%;
  overflow: hidden auto;
  scrollbar-width: none;
}

.todo-content-scroll::-webkit-scrollbar {
  display: none;
}

.todo-scrollbar-thumb {
  position: absolute;
  top: 0;
  right: 3px;
  z-index: 4;
  width: 7px;
  min-height: 42px;
  border-radius: 999px;
  background: var(--sd-theme-itab-todo-todo-opened-panel-surface-03);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.todo-content-frame:hover .todo-scrollbar-thumb,
.todo-content-frame.is-scrolling .todo-scrollbar-thumb {
  opacity: 1;
}

.todo-content-frame:hover .todo-scrollbar-thumb {
  background: var(--sd-theme-itab-todo-todo-opened-panel-surface-04);
}

.todo-content-ul {
  display: block;
  width: 954px;
  margin: 0;
  padding: 0;
  color: var(--sd-theme-itab-todo-todo-opened-panel-text-02);
  list-style: none;
}

.todo-content-li {
  position: relative;
  display: flex;
  width: 100%;
  height: auto;
  min-height: 63px;
  align-items: center;
  margin-bottom: 8px;
  padding: 8px 0 8px 12px;
  border-radius: 8px;
  background: var(--sd-theme-itab-todo-todo-opened-panel-surface-02);
  color: var(--sd-theme-itab-todo-todo-opened-panel-text-02);
  line-height: 21px;
}

.todo-check-bg {
  display: flex;
  width: 56px;
  min-height: 47px;
  flex: 0 0 56px;
  align-self: stretch;
  align-items: center;
  justify-content: center;
  margin-left: -16px;
}

.todo-check {
  position: relative;
  display: block;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 2px solid var(--sd-theme-itab-todo-todo-opened-panel-border-01);
  border-radius: 4px;
  background: transparent;
}

.todo-check:disabled {
  cursor: default;
}

.todo-check.done {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--sd-theme-itab-todo-todo-opened-panel-border-02);
  background: var(--sd-theme-itab-todo-todo-opened-panel-accent-surface-01);
  color: var(--sd-theme-itab-todo-todo-opened-panel-text-03);
}

.todo-check svg {
  width: 12px;
  height: 12px;
}

.todo-row-main {
  position: relative;
  display: flex;
  width: calc(100% - 36px);
  height: auto;
  min-height: 31px;
  align-items: center;
  margin-left: -16px;
}

.todo-row-main textarea {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-height: 31px;
  padding: 5px 11px;
  border: 0;
  border-radius: 12px;
  outline: 0;
  background: transparent;
  color: var(--sd-theme-itab-todo-todo-opened-panel-text-04);
  font: inherit;
  font-size: 14px;
  line-height: 21px;
  resize: none;
  overflow: hidden;
}

.todo-row-main textarea[readonly] {
  cursor: default;
}

.todo-content-li.done .todo-row-main {
  opacity: 1;
}

.todo-delete {
  position: absolute;
  right: 10px;
  top: 50%;
  display: none;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--sd-theme-itab-todo-todo-opened-panel-text-02);
  transform: translateY(-50%);
}

.todo-content-li:hover .todo-delete,
.todo-content-li.done .todo-delete {
  display: flex;
}

.todo-delete svg {
  width: 16px;
  height: 16px;
}

.todo-done-label {
  height: 28px;
  padding: 0 0 0 40px;
  color: var(--sd-theme-itab-todo-todo-opened-panel-text-02);
  font-size: 12px;
  line-height: 28px;
  list-style: none;
}

.todo-empty {
  display: flex;
  width: 954px;
  min-height: 292.84px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: var(--sd-theme-itab-todo-todo-opened-panel-text-01);
  font-size: 12px;
  line-height: 16px;
}

.todo-empty svg {
  width: 160px;
  height: 174.17px;
}

.todo-empty p {
  margin: 20px 0 0;
}
</style>
