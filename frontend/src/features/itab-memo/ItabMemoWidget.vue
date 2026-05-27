<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import { useItabMemoRuntime } from "./useItabMemoRuntime";
import type { ItabMemoSizeKey, ItabMemoWidgetData } from "./itabMemoTypes";

const props = withDefaults(
  defineProps<{
    widget: WidgetConfig;
    sizeKey: ItabMemoSizeKey;
    refreshToken?: number;
    authRequired?: boolean;
    remoteSync?: boolean;
  }>(),
  {
    authRequired: true,
    remoteSync: true,
  },
);

const emit = defineEmits<{
  updateData: [data: ItabMemoWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useItabMemoRuntime(
  widgetRef,
  (data) => emit("updateData", data),
  { remoteSync: props.remoteSync, authRequired: props.authRequired },
);
const lastRefreshToken = ref(props.refreshToken ?? 0);

const isCompactTextHidden = computed(() =>
  ["1x1", "1x2"].includes(props.sizeKey),
);
const isFourByFour = computed(() => props.sizeKey === "4x4");
const rows = computed(() => {
  if (!runtime.canReadMemo.value) return [];
  return runtime.outerRows.value.length
    ? runtime.outerRows.value
    : ["暂无备忘录"];
});
const boardNotes = computed(() =>
  runtime.canReadMemo.value ? runtime.orderedNotes.value : [],
);

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
    class="itab-memo-widget"
    :class="{
      'is-compact-text-hidden': isCompactTextHidden,
      'is-board': isFourByFour,
    }"
    data-itab-memo-widget
    :data-itab-memo-size="sizeKey"
  >
    <span class="memo-widget-top">
      <strong>备忘录</strong>
      <small v-if="isFourByFour && runtime.canReadMemo.value">
        {{ boardNotes.length }} 条
      </small>
    </span>
    <ul class="memo-widget-content">
      <li v-if="!runtime.canReadMemo.value">
        <span>登录后使用备忘录</span>
      </li>
      <template v-else-if="isFourByFour">
        <li
          v-for="note in boardNotes"
          :key="note.id"
          class="memo-widget-note"
          :class="{ 'is-pinned': note.pinned }"
        >
          <span class="memo-widget-note-copy">
            <strong>{{ note.title || "未命名备忘录" }}</strong>
            <em v-if="note.body">{{ note.body }}</em>
            <small v-if="note.pinned">置顶</small>
          </span>
        </li>
        <li v-if="boardNotes.length === 0" class="memo-widget-empty">
          <span>暂无备忘录</span>
        </li>
      </template>
      <template v-else>
        <li v-for="(row, index) in rows" :key="`${index}-${row}`">
          <span>{{ row }}</span>
        </li>
      </template>
    </ul>
  </span>
</template>

<style scoped>
.itab-memo-widget {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: linear-gradient(
    135deg,
    var(--sd-theme-itab-memo-memo-widget-accent-surface-01),
    var(--sd-theme-itab-memo-memo-widget-accent-surface-02)
  );
  color: var(--sd-theme-itab-memo-memo-widget-text-01);
}

.memo-widget-top {
  display: flex;
  width: 100%;
  height: 25%;
  align-items: center;
  justify-content: center;
  background-image: linear-gradient(
    0deg,
    var(--sd-theme-itab-memo-memo-widget-accent-surface-03),
    var(--sd-theme-itab-memo-memo-widget-accent-surface-04)
  );
  color: var(--sd-theme-itab-memo-memo-widget-text-02);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.memo-widget-top strong {
  font: inherit;
  font-weight: 400;
}

.memo-widget-top small {
  display: none;
}

.itab-memo-widget[data-itab-memo-size="1x1"] .memo-widget-top,
.itab-memo-widget[data-itab-memo-size="1x2"] .memo-widget-top {
  height: 30%;
}

.itab-memo-widget.is-board .memo-widget-top {
  height: 38px;
  justify-content: space-between;
  padding: 0 14px;
  font-size: 13px;
  text-align: left;
}

.itab-memo-widget.is-board .memo-widget-top small {
  display: block;
  color: var(--sd-theme-itab-memo-memo-widget-text-02);
  font-size: 11px;
  line-height: 16px;
  opacity: 0.78;
}

.memo-widget-content {
  display: block;
  width: 100%;
  height: 75%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background-color: var(--sd-theme-itab-memo-memo-widget-surface-01);
  list-style: none;
}

.itab-memo-widget.is-board .memo-widget-content {
  height: calc(100% - 38px);
  overflow: hidden auto;
  scrollbar-width: thin;
  scrollbar-color: color-mix(
      in srgb,
      var(--sd-theme-itab-memo-memo-widget-text-01) 26%,
      transparent
    )
    transparent;
}

.itab-memo-widget.is-board .memo-widget-content::-webkit-scrollbar {
  width: 6px;
}

.itab-memo-widget.is-board .memo-widget-content::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(
    in srgb,
    var(--sd-theme-itab-memo-memo-widget-text-01) 26%,
    transparent
  );
}

.itab-memo-widget.is-board .memo-widget-content::-webkit-scrollbar-track {
  background: transparent;
}

.itab-memo-widget[data-itab-memo-size="1x1"] .memo-widget-content,
.itab-memo-widget[data-itab-memo-size="1x2"] .memo-widget-content {
  height: 70%;
}

.memo-widget-content li {
  display: flex;
  height: 33.333%;
  min-height: 0;
  align-items: center;
  padding: 0 6.51px;
  border-bottom: 1px solid var(--sd-theme-itab-memo-memo-widget-border-01);
  font-size: 12px;
  line-height: 18px;
}

.itab-memo-widget.is-board .memo-widget-content li {
  position: relative;
  height: auto;
  min-height: 58px;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 10px 10px 14px;
  font-size: 12px;
  line-height: 17px;
}

.memo-widget-note-copy {
  display: block;
  min-width: 0;
  flex: 1 1 auto;
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
}

.memo-widget-note-copy strong,
.memo-widget-note-copy em,
.memo-widget-note-copy small {
  display: block;
  min-width: 0;
  overflow: visible;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  text-overflow: clip;
}

.memo-widget-note-copy strong {
  color: var(--sd-theme-itab-memo-memo-widget-text-01);
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
}

.memo-widget-note-copy em {
  margin-top: 4px;
  color: var(--sd-theme-itab-memo-memo-widget-text-01);
  font-style: normal;
  opacity: 0.72;
}

.memo-widget-note-copy small {
  margin-top: 6px;
  color: var(--sd-theme-itab-memo-memo-widget-text-01);
  font-size: 11px;
  line-height: 14px;
  opacity: 0.56;
}

.memo-widget-content span {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.itab-memo-widget.is-compact-text-hidden .memo-widget-content span {
  display: none;
}

.itab-memo-widget.is-board .memo-widget-content span {
  display: block;
}
</style>
