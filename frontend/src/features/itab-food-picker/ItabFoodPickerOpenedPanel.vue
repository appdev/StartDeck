<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import { useItabFoodPickerRuntime } from "./useItabFoodPickerRuntime";
import type { ItabFoodPickerWidgetData } from "./itabFoodPickerTypes";

const props = defineProps<{
  widget: WidgetConfig;
}>();

const emit = defineEmits<{
  updateData: [data: ItabFoodPickerWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useItabFoodPickerRuntime(widgetRef, (data) =>
  emit("updateData", data),
);
const draftText = ref(runtime.draftText.value);

watch(
  () => runtime.draftText.value,
  (value) => {
    draftText.value = value;
  },
);
</script>

<template>
  <div
    class="opened-food-picker-panel"
    data-itab-food-picker-opened-panel
    data-grid-drag-ignore="true"
    :data-food-picker-current="runtime.currentItem.value"
  >
    <section class="food-picker-stage" aria-label="今天吃什么 面板">
      <h2>今天吃什么</h2>
      <div class="food-wheel" data-food-picker-wheel>
        <span
          v-for="item in runtime.wheelItems.value"
          :key="item"
          :title="item"
        >
          {{ item }}
        </span>
      </div>
      <button
        class="food-picker-primary"
        type="button"
        data-itab-action="food-picker-pick"
        @click.stop="runtime.pick"
      >
        {{ runtime.currentItem.value || "开始" }}
      </button>
    </section>

    <aside class="food-picker-menu-editor" aria-label="菜单编辑">
      <header>
        <strong>菜单</strong>
        <span>{{ runtime.menuItems.value.length }} 个候选</span>
      </header>
      <textarea
        v-model="draftText"
        rows="8"
        spellcheck="false"
        aria-label="候选菜单"
      ></textarea>
      <div class="food-picker-editor-actions">
        <button
          type="button"
          @click.stop="runtime.updateMenuFromText(draftText)"
        >
          保存菜单
        </button>
        <button type="button" @click.stop="runtime.resetMenu">重置</button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.opened-food-picker-panel {
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-columns: minmax(0, 1fr) 238px;
  overflow: hidden;
  background:
    radial-gradient(
      circle at 67% 23%,
      rgba(255, 225, 142, 0.84),
      transparent 24%
    ),
    #fff;
  color: #1f2937;
}

.food-picker-stage {
  position: relative;
  display: grid;
  min-width: 0;
  place-items: center;
  align-content: center;
  padding: 54px 42px 34px;
}

.food-picker-stage h2 {
  margin: 0 0 28px;
  color: #111827;
  font-size: 34px;
  font-weight: 700;
  line-height: 42px;
}

.food-wheel {
  position: relative;
  display: grid;
  width: 350px;
  height: 350px;
  place-items: center;
  border-radius: 50%;
  background: conic-gradient(
    #ffbd59 0 16.6%,
    #ff8d59 16.6% 33.2%,
    #ffd75e 33.2% 49.8%,
    #8adf89 49.8% 66.4%,
    #70c7ff 66.4% 83%,
    #b58cff 83% 100%
  );
  color: #fff;
}

.food-wheel::after {
  position: absolute;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background: #fff;
  content: "";
}

.food-wheel span {
  position: absolute;
  z-index: 1;
  max-width: 82px;
  overflow: hidden;
  color: #fff;
  font-size: 15px;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.food-wheel span:nth-child(1) {
  transform: translateY(-122px);
}

.food-wheel span:nth-child(2) {
  transform: translate(105px, -60px);
}

.food-wheel span:nth-child(3) {
  transform: translate(104px, 62px);
}

.food-wheel span:nth-child(4) {
  transform: translateY(123px);
}

.food-wheel span:nth-child(5) {
  transform: translate(-105px, 60px);
}

.food-wheel span:nth-child(6) {
  transform: translate(-105px, -60px);
}

.food-picker-primary {
  z-index: 1;
  width: 110px;
  height: 42px;
  max-width: 148px;
  margin-top: -196px;
  overflow: hidden;
  padding: 0 18px;
  border: 0;
  border-radius: 22px;
  background: #f39b2d;
  color: #fff;
  font-size: 18px;
  line-height: 42px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.food-picker-menu-editor {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 68px 24px 28px 0;
}

.food-picker-menu-editor header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.food-picker-menu-editor strong {
  color: #111827;
  font-size: 18px;
  line-height: 26px;
}

.food-picker-menu-editor span {
  color: rgba(31, 41, 55, 0.58);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.food-picker-menu-editor textarea {
  width: 100%;
  min-height: 238px;
  resize: none;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid rgba(31, 41, 55, 0.16);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  color: #1f2937;
  font:
    14px/22px "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  outline: none;
}

.food-picker-menu-editor textarea:focus {
  border-color: rgba(243, 155, 45, 0.72);
  box-shadow: 0 0 0 3px rgba(243, 155, 45, 0.16);
}

.food-picker-editor-actions {
  display: flex;
  gap: 10px;
}

.food-picker-editor-actions button {
  flex: 1;
  height: 34px;
  border: 0;
  border-radius: 17px;
  background: rgba(31, 41, 55, 0.08);
  color: #1f2937;
  font-size: 13px;
  line-height: 34px;
  cursor: pointer;
}

.food-picker-editor-actions button:first-child {
  background: #f39b2d;
  color: #fff;
}

@media (max-width: 760px) {
  .opened-food-picker-panel {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .food-picker-stage {
    padding: 54px 20px 24px;
  }

  .food-picker-menu-editor {
    padding: 0 20px 24px;
  }

  .food-wheel {
    width: min(350px, calc(100vw - 72px));
    height: min(350px, calc(100vw - 72px));
  }
}
</style>
