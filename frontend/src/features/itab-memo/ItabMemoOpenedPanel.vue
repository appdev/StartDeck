<script setup lang="ts">
import { computed } from "vue";
import type { WidgetConfig } from "@/types";
import { formatItabMemoTime, useItabMemoRuntime } from "./useItabMemoRuntime";
import type { ItabMemoNote, ItabMemoWidgetData } from "./itabMemoTypes";

const memoSvgPaths = {
  add: "M8.5 2.75a.75.75 0 0 0-1.5 0V7H2.75a.75.75 0 0 0 0 1.5H7v4.25a.75.75 0 0 0 1.5 0V8.5h4.25a.75.75 0 0 0 0-1.5H8.5V2.75z",
  delete:
    "M6.5 7v4a.5.5 0 0 0 1 0V7a.5.5 0 0 0-1 0zM9 6.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V7a.5.5 0 0 1 .5-.5zM10 4h3a.5.5 0 0 1 0 1h-.553l-.752 6.776A2.5 2.5 0 0 1 9.21 14H6.79a2.5 2.5 0 0 1-2.485-2.224L3.552 5H3a.5.5 0 0 1 0-1h3a2 2 0 1 1 4 0zM8 3a1 1 0 0 0-1 1h2a1 1 0 0 0-1-1zM4.559 5l.74 6.666A1.5 1.5 0 0 0 6.79 13h2.42a1.5 1.5 0 0 0 1.49-1.334L11.442 5H4.56z",
  pin: "M10.059 2.445a1.5 1.5 0 0 0-2.386.354l-2.02 3.79l-2.811.937a.5.5 0 0 0-.196.828L4.793 10.5l-2.647 2.647L2 14l.854-.146L5.5 11.207l2.146 2.147a.5.5 0 0 0 .828-.196l.937-2.81l3.779-2.024a1.5 1.5 0 0 0 .354-2.38L10.06 2.444zm-1.504.824a.5.5 0 0 1 .796-.118l3.485 3.498a.5.5 0 0 1-.118.794L8.764 9.559a.5.5 0 0 0-.238.283l-.744 2.233l-3.856-3.856l2.232-.744a.5.5 0 0 0 .283-.24L8.555 3.27z",
  unpin:
    "M9.56 10.267l4.586 4.587a.5.5 0 0 0 .708-.708l-13-13a.5.5 0 1 0-.708.708l4.586 4.585l-.08.15l-2.81.937a.5.5 0 0 0-.196.828L4.793 10.5l-2.647 2.646L2 14l.854-.146L5.5 11.207l2.146 2.147a.5.5 0 0 0 .828-.196l.937-2.811l.15-.08zm-.739-.739l-.057.031a.5.5 0 0 0-.238.283l-.744 2.232L3.926 8.22l2.232-.745a.5.5 0 0 0 .283-.239l.03-.056l2.35 2.35zm3.897-2.085l-2.054 1.1l.738.738l1.788-.957a1.5 1.5 0 0 0 .354-2.381L10.06 2.445a1.5 1.5 0 0 0-2.386.353l-.957 1.796l.739.74l1.1-2.065a.5.5 0 0 1 .796-.118l3.485 3.498a.5.5 0 0 1-.118.794z",
};

const props = withDefaults(
  defineProps<{
    widget: WidgetConfig;
    authRequired?: boolean;
  }>(),
  {
    authRequired: true,
  },
);

const emit = defineEmits<{
  updateData: [data: ItabMemoWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useItabMemoRuntime(
  widgetRef,
  (data) => emit("updateData", data),
  { authRequired: props.authRequired },
);

const activeNote = computed(() => runtime.activeNote.value);
const noteTitle = (note: ItabMemoNote) => note.title || "未命名备忘录";
const noteListTime = (note: ItabMemoNote) =>
  note.listTime ||
  formatItabMemoTime(note.updatedAt).slice(0, 16).replaceAll("-", "/");

const updateActiveTitle = (event: Event) => {
  if (!activeNote.value) return;
  runtime.updateNote(activeNote.value.id, {
    title: (event.target as HTMLInputElement).value,
  });
};

const updateActiveBody = (event: Event) => {
  if (!activeNote.value) return;
  runtime.updateNote(activeNote.value.id, {
    body: (event.target as HTMLTextAreaElement).value,
  });
};
</script>

<template>
  <div class="itab-memo-opened-panel" data-itab-memo-opened-panel>
    <aside class="memo-tabs">
      <h2>
        备忘录
        <span class="memo-sort" aria-hidden="true">
          <i class="memo-sort-caret desc"></i>
          <i class="memo-sort-caret asc"></i>
        </span>
      </h2>
      <label class="memo-search">
        <input
          v-model="runtime.searchText.value"
          :disabled="!runtime.canReadMemo.value"
          placeholder="search"
          type="search"
        />
      </label>

      <div v-if="!runtime.canReadMemo.value" class="memo-empty">
        登录后使用备忘录
      </div>
      <ul v-else class="memo-tabs-body">
        <li
          v-for="note in runtime.filteredNotes.value"
          :key="note.id"
          class="memo-tabs-item"
          :class="{ active: note.id === runtime.activeNoteId.value }"
          @click="runtime.selectNote(note.id)"
        >
          <span class="memo-item-copy">
            <h4>{{ noteTitle(note) }}</h4>
            <time>{{ noteListTime(note) }}</time>
          </span>
          <button
            v-if="runtime.canWriteMemo.value"
            class="memo-note-action delete"
            title="删除备忘录"
            type="button"
            @click.stop="runtime.removeNote(note.id)"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path :d="memoSvgPaths.delete"></path>
            </svg>
          </button>
          <button
            v-if="runtime.canWriteMemo.value"
            class="memo-note-action pin"
            :title="note.pinned ? '取消固定' : '固定到桌面'"
            type="button"
            @click.stop="runtime.togglePin(note.id)"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                :d="note.pinned ? memoSvgPaths.unpin : memoSvgPaths.pin"
              ></path>
            </svg>
          </button>
        </li>
        <li v-if="runtime.filteredNotes.value.length === 0" class="memo-empty">
          暂无备忘录
        </li>
      </ul>

      <button
        v-if="runtime.canWriteMemo.value"
        class="memo-add"
        title="新增备忘录"
        type="button"
        @click="runtime.createNote"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path :d="memoSvgPaths.add"></path>
        </svg>
      </button>
    </aside>

    <section class="memo-content">
      <div class="memo-content-inner">
        <template v-if="activeNote">
          <label class="memo-title-wrap">
            <input
              :value="activeNote.title"
              :readonly="!runtime.canWriteMemo.value"
              placeholder="请输入笔记标题"
              @input="updateActiveTitle"
            />
          </label>
          <label class="memo-textarea-wrap">
            <textarea
              :value="activeNote.body"
              :readonly="!runtime.canWriteMemo.value"
              placeholder="请输入笔记内容"
              @input="updateActiveBody"
            ></textarea>
          </label>
          <p class="memo-meta">
            最后编辑：{{ formatItabMemoTime(activeNote.updatedAt) }}，创建：{{
              formatItabMemoTime(activeNote.createdAt)
            }}
          </p>
        </template>
        <div v-else class="memo-content-empty">暂无备忘录</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.itab-memo-opened-panel {
  display: flex;
  width: 998px;
  height: 600px;
  overflow: hidden;
  background: #fff;
  color: #222;
  font-size: 14px;
  line-height: 21px;
}

.memo-tabs {
  position: relative;
  width: 200px;
  height: 600px;
  flex: 0 0 200px;
  overflow: auto;
  padding: 18px 8px 0;
}

.memo-tabs h2 {
  display: flex;
  width: 183px;
  height: 27px;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 12px;
  padding-left: 4px;
  color: rgb(34, 34, 34);
  font-size: 18px;
  font-weight: 700;
  line-height: 27px;
}

.memo-sort {
  display: inline-flex;
  width: 8px;
  height: 28px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.memo-sort-caret {
  width: 0;
  height: 0;
  border-right: 4px solid transparent;
  border-left: 4px solid transparent;
}

.memo-sort-caret.desc {
  border-top: 6px solid #1890ff;
}

.memo-sort-caret.asc {
  border-bottom: 6px solid #939393;
}

.memo-search {
  display: block;
  width: 179px;
  height: 24px;
  margin: 0 0 8px;
}

.memo-search input {
  width: 165px;
  height: 22px;
  border: 0;
  border-radius: 2px;
  background: transparent;
  color: rgb(34, 34, 34);
  font-size: 12px;
  line-height: 22px;
  outline: none;
}

.memo-tabs-body {
  width: 183px;
  height: 502px;
  margin: 0;
  padding: 0;
  overflow: hidden auto;
  list-style: none;
}

.memo-tabs-item {
  position: relative;
  display: flex;
  width: 183px;
  height: 64px;
  align-items: flex-start;
  border-radius: 8px;
  padding: 12px 34px 12px 8px;
  color: rgb(34, 34, 34);
  cursor: pointer;
}

.memo-tabs-item:hover {
  background: rgba(240, 241, 244, 0.72);
}

.memo-tabs-item.active {
  background: rgb(240, 241, 244);
  color: rgb(52, 120, 247);
}

.memo-item-copy {
  display: block;
  min-width: 0;
  flex: 1;
}

.memo-tabs-item h4 {
  margin: 0;
  overflow: hidden;
  color: currentColor;
  font-size: 14px;
  font-weight: 700;
  line-height: 21px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.memo-tabs-item time {
  display: block;
  overflow: hidden;
  color: rgb(147, 147, 147);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.memo-note-action {
  position: absolute;
  right: 14px;
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: rgb(52, 120, 247);
  cursor: pointer;
  opacity: 0;
}

.memo-note-action.delete {
  top: 8px;
}

.memo-note-action.pin {
  bottom: 8px;
}

.memo-tabs-item:hover .memo-note-action,
.memo-tabs-item.active:hover .memo-note-action,
.memo-note-action:focus-visible {
  opacity: 1;
}

.memo-note-action:focus-visible {
  outline: 2px solid rgba(24, 144, 255, 0.48);
  outline-offset: 1px;
}

.memo-note-action svg,
.memo-add svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.memo-add {
  position: absolute;
  right: 13px;
  bottom: 12px;
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: #1890ff;
  color: #fff;
  box-shadow: rgba(0, 0, 0, 0.12) 0 0 5px 2px;
  cursor: pointer;
}

.memo-content {
  width: 798px;
  height: 600px;
  padding: 10px;
}

.memo-content-inner {
  width: 778px;
  height: 580px;
}

.memo-title-wrap {
  display: block;
  width: 778px;
  height: 32px;
}

.memo-title-wrap input {
  width: 753px;
  height: 30px;
  border: 0;
  color: rgb(34, 34, 34);
  font-size: 16px;
  font-weight: 700;
  line-height: 30px;
  outline: none;
}

.memo-textarea-wrap {
  display: block;
  width: 778px;
  height: 528px;
  border-top: 1px solid #f2f2f2;
}

.memo-textarea-wrap textarea {
  display: block;
  width: 778px;
  height: 528px;
  resize: none;
  border: 0;
  padding: 5px 11px;
  color: rgb(34, 34, 34);
  font-size: 14px;
  line-height: 21px;
  outline: none;
}

.memo-meta {
  width: 778px;
  height: 18px;
  margin: 5px 0 0;
  color: rgb(147, 147, 147);
  font-size: 12px;
  line-height: 18px;
}

.memo-empty,
.memo-content-empty {
  color: rgb(147, 147, 147);
  font-size: 12px;
  line-height: 18px;
}

.memo-content-empty {
  display: grid;
  width: 778px;
  height: 580px;
  place-items: center;
}
</style>
