<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";
import { useItabMemoRuntime } from "./useItabMemoRuntime";
import type { ItabMemoWidgetData } from "./itabMemoTypes";

const props = withDefaults(
  defineProps<{
    widget: WidgetConfig;
    sizeKey: ItabWidgetSizeKey;
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
const rows = computed(() => {
  if (!runtime.canReadMemo.value) return [];
  return runtime.outerRows.value.length
    ? runtime.outerRows.value
    : ["暂无备忘录"];
});

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
    :class="{ 'is-compact-text-hidden': isCompactTextHidden }"
    data-itab-memo-widget
    :data-itab-memo-size="sizeKey"
  >
    <span class="memo-widget-top">备忘录</span>
    <ul class="memo-widget-content">
      <li v-if="!runtime.canReadMemo.value">
        <span>登录后使用备忘录</span>
      </li>
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
  background: linear-gradient(135deg, rgb(29, 101, 240), rgb(26, 209, 252));
  color: #222;
}

.memo-widget-top {
  display: flex;
  width: 100%;
  height: 25%;
  align-items: center;
  justify-content: center;
  background-image: linear-gradient(0deg, rgb(255, 201, 39), rgb(255, 164, 3));
  color: #fff;
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.itab-memo-widget[data-itab-memo-size="1x1"] .memo-widget-top,
.itab-memo-widget[data-itab-memo-size="1x2"] .memo-widget-top {
  height: 30%;
}

.memo-widget-content {
  display: block;
  width: 100%;
  height: 75%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background-color: #fff;
  list-style: none;
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
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 12px;
  line-height: 18px;
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
</style>
