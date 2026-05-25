<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import type { WidgetConfig } from "@/types";
import { useItabNumberUppercaseRuntime } from "./useItabNumberUppercaseRuntime";
import type { ItabNumberUppercaseWidgetData } from "./itabNumberUppercaseTypes";

const props = defineProps<{
  widget: WidgetConfig;
}>();

const emit = defineEmits<{
  updateData: [data: ItabNumberUppercaseWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useItabNumberUppercaseRuntime(widgetRef, (data) =>
  emit("updateData", data),
);
const inputRef = ref<HTMLInputElement | null>(null);
const resultActive = computed(() => !!runtime.uppercaseResult.value);
const digitReferenceItems = [
  ["零", "0"],
  ["壹", "1"],
  ["贰", "2"],
  ["叁", "3"],
  ["肆", "4"],
  ["伍", "5"],
  ["陆", "6"],
  ["柒", "7"],
  ["捌", "8"],
  ["玖", "9"],
] as const;
const unitReferenceItems = [
  ["拾", "十"],
  ["佰", "百"],
  ["仟", "千"],
  ["万", "万"],
  ["亿", "亿"],
  ["兆", "兆"],
  ["元", "元"],
  ["角", "角"],
  ["分", "分"],
  ["整", "正"],
] as const;

const onInput = (event: Event) => {
  runtime.updateInput((event.target as HTMLInputElement).value);
};

onMounted(() => {
  void nextTick(() => inputRef.value?.focus());
});
</script>

<template>
  <section
    class="itab-number-uppercase-opened-panel"
    data-itab-number-uppercase-panel
    :data-itab-number-uppercase-input="runtime.inputNumber.value"
    :data-itab-number-uppercase-result="runtime.uppercaseResult.value"
    :data-itab-number-uppercase-format="runtime.state.value.formatMode"
  >
    <div class="amount-conversion-container">
      <div class="amount-conversion-input-group">
        <div class="amount-conversion-input-wrapper">
          <input
            ref="inputRef"
            class="amount-conversion-input noMove"
            :class="{
              'amount-conversion-input--active': !!runtime.inputNumber.value,
            }"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            maxlength="19"
            placeholder="请输入金额数值"
            data-itab-inner-control
            data-grid-drag-ignore="true"
            :value="runtime.inputNumber.value"
            aria-label="请输入金额数值"
            @input="onInput"
          />
        </div>
      </div>

      <output
        class="amount-conversion-result-container"
        :class="{ 'amount-conversion-active': resultActive }"
        aria-live="polite"
      >
        <span class="amount-conversion-result noMove">
          {{ runtime.resultDisplay.value }}
        </span>
      </output>

      <section
        class="amount-conversion-example"
        aria-label="大写数字与单位参考"
      >
        <h2 class="amount-conversion-example-title">大写数字与单位参考</h2>
        <div class="amount-conversion-character-grid">
          <span
            v-for="[upper, lower] in digitReferenceItems"
            :key="upper"
            class="amount-conversion-character-item"
          >
            <strong>{{ upper }}</strong>
            <small>{{ lower }}</small>
          </span>
        </div>
        <div class="amount-conversion-character-grid">
          <span
            v-for="[upper, lower] in unitReferenceItems"
            :key="upper"
            class="amount-conversion-character-item"
          >
            <strong>{{ upper }}</strong>
            <small>{{ lower }}</small>
          </span>
        </div>
      </section>

      <div class="amount-conversion-bottom-border" aria-hidden="true"></div>
    </div>
  </section>
</template>

<style scoped>
.itab-number-uppercase-opened-panel {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: linear-gradient(135deg, #111827, #1f2937 48%, #000);
  color: #cbd5e1;
  font-family:
    -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC",
    "Microsoft YaHei", sans-serif;
}

.amount-conversion-container {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 47px 40px 40px;
  background: linear-gradient(135deg, #111827, #1f2937 48%, #000);
}

.amount-conversion-input-group {
  margin: 0 0 30px;
}

.amount-conversion-input-wrapper {
  position: relative;
  display: flex;
}

.amount-conversion-input {
  box-sizing: border-box;
  width: 100%;
  height: 59px;
  padding: 15px;
  border: 1px solid #4a5568;
  border-radius: 12px;
  outline: none;
  background: #1a202c;
  color: #facc15;
  font-size: 18px;
  line-height: 27px;
  text-align: center;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease;
}

.amount-conversion-input::placeholder {
  color: rgba(203, 213, 224, 0.58);
}

.amount-conversion-input:focus,
.amount-conversion-input--active {
  border-color: #facc15;
  background: rgba(250, 204, 21, 0.05);
  box-shadow: rgba(250, 204, 21, 0.19) 0 0 3px 0;
}

.amount-conversion-result-container {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  min-height: 80px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 20px;
  border: 1px solid #4a5568;
  border-radius: 12px;
  background: #1a202c;
  color: #a0aec0;
  font-size: 18px;
  line-height: 28px;
  text-align: center;
}

.amount-conversion-result {
  display: block;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.amount-conversion-active .amount-conversion-result {
  color: #facc15;
  font-size: 22px;
  font-weight: 500;
  line-height: 33px;
}

.amount-conversion-example {
  box-sizing: border-box;
  width: 100%;
  margin: 25px 0 0;
  padding: 20px;
  border: 1px solid #4a5568;
  border-radius: 10px;
  background: #2d3748;
  color: #cbd5e0;
}

.amount-conversion-example-title {
  display: flex;
  margin: 0 0 20px;
  color: #e2e8f0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 24px;
}

.amount-conversion-character-grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 12px;
  margin: 0 0 15px;
}

.amount-conversion-character-grid:last-child {
  margin-bottom: 0;
}

.amount-conversion-character-item {
  display: flex;
  min-width: 0;
  min-height: 75px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 1px solid #4a5568;
  border-radius: 8px;
  background: #1a202c;
  color: #a0aec0;
  text-align: center;
}

.amount-conversion-character-item strong {
  color: #aeb8c7;
  font-size: 20px;
  font-weight: 600;
  line-height: 30px;
}

.amount-conversion-character-item small {
  color: #cbd5e0;
  font-size: 12px;
  line-height: 18px;
}

.amount-conversion-bottom-border {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #eab308, transparent);
}

@media (max-width: 760px) {
  .amount-conversion-container {
    padding: 48px 20px 28px;
  }

  .amount-conversion-character-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .amount-conversion-character-item {
    min-height: 62px;
    padding: 8px;
  }
}
</style>
