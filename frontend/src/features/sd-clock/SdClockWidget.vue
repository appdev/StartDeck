<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";
import { useSdClockRuntime } from "./useSdClockRuntime";
import type { SdClockWidgetData } from "./sdClockTypes";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: SdWidgetSizeKey;
  refreshToken?: number;
}>();

const emit = defineEmits<{
  updateData: [data: SdClockWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useSdClockRuntime(widgetRef, (data) =>
  emit("updateData", data),
);
const lastRefreshToken = ref(props.refreshToken ?? 0);
const normalizedSize = computed(() => props.sizeKey.replace("x", "-"));
const counterStyle = (value: string) =>
  ({ "--value": Number(value) }) as Record<string, number>;

watch(
  () => props.refreshToken,
  (value) => {
    const token = value ?? 0;
    if (token === lastRefreshToken.value) return;
    lastRefreshToken.value = token;
    runtime.updateTime();
  },
);
</script>

<template>
  <span
    class="sd-clock-widget is-clock"
    :class="`size-${normalizedSize}`"
    data-sd-clock-widget
    :data-sd-clock-size="sizeKey"
  >
    <span class="d-watch-resize" :class="`clock-size-${normalizedSize}`">
      <span class="clock-icon-wrap" :class="`iconsize-${sizeKey}`">
        <i
          class="d-icon fullsrceen-btn"
          title="快捷键F11可切换至全屏"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M18 4h2c1.1 0 2 .9 2 2v2c0 .55-.45 1-1 1s-1-.45-1-1V6h-2c-.55 0-1-.45-1-1s.45-1 1-1zM4 8V6h2c.55 0 1-.45 1-1s-.45-1-1-1H4c-1.1 0-2 .9-2 2v2c0 .55.45 1 1 1s1-.45 1-1zm16 8v2h-2c-.55 0-1 .45-1 1s.45 1 1 1h2c1.1 0 2-.9 2-2v-2c0-.55-.45-1-1-1s-1 .45-1 1zM6 18H4v-2c0-.55-.45-1-1-1s-1 .45-1 1v2c0 1.1.9 2 2 2h2c.55 0 1-.45 1-1s-.45-1-1-1zM16 8H8c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2z"
            />
          </svg>
        </i>
        <span
          class="clock-icon-center"
          :class="`clock-center-${normalizedSize}`"
        >
          <span v-if="sizeKey === '2x1'" class="clock-vertical-digits">
            <span class="clock-vertical-time">
              <time :style="counterStyle(runtime.hourText.value)"></time>
              <time :style="counterStyle(runtime.minuteText.value)"></time>
            </span>
            <span class="clock-vertical-date">
              <small>{{ runtime.shortDateText.value }}</small>
              <small>{{ runtime.shortWeekdayText.value }}</small>
            </span>
          </span>
          <p
            v-else-if="sizeKey === '1x1' || sizeKey === '1x2'"
            class="b time countdown"
          >
            <time :style="counterStyle(runtime.hourText.value)"></time>
            <em>:</em>
            <time :style="counterStyle(runtime.minuteText.value)"></time>
            <template v-if="sizeKey === '1x2'">
              <em>:</em>
              <time :style="counterStyle(runtime.secondText.value)"></time>
            </template>
          </p>
          <span v-else class="clock-large-stack">
            <span class="b time countdown">
              <time :style="counterStyle(runtime.hourText.value)"></time>
              <em>:</em>
              <time :style="counterStyle(runtime.minuteText.value)"></time>
              <template v-if="sizeKey === '2x4'">
                <em>:</em>
                <time :style="counterStyle(runtime.secondText.value)"></time>
              </template>
            </span>
            <p class="f16">{{ runtime.outerDateText.value }}</p>
          </span>
        </span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.sd-clock-widget,
.d-watch-resize,
.clock-icon-wrap {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.d-watch-resize {
  font-size: 21px;
}

.size-1-1 .d-watch-resize,
.size-1-2 .d-watch-resize,
.size-2-1 .d-watch-resize {
  font-size: 8px;
}

.clock-icon-wrap {
  background: var(--sd-theme-clock-clock-widget-surface-01);
  color: var(--sd-theme-clock-clock-widget-text-01);
  font-family: HarmonyOS_Sans, Arial, "PingFang SC", sans-serif;
}

.fullsrceen-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  width: 1em;
  height: 1em;
  opacity: 0.3;
}

.fullsrceen-btn svg {
  display: block;
  width: 100%;
  height: 100%;
  fill: currentColor;
}

.clock-icon-center {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.clock-icon-center > span {
  display: block;
}

time {
  counter-reset: clock-value var(--value);
}

time::before {
  content: counter(clock-value, decimal-leading-zero);
}

.time.countdown {
  display: inline-flex;
  color: var(--sd-theme-clock-clock-widget-text-01);
  font-size: 44.1px;
  font-weight: 700;
  line-height: 44.1px;
  margin: 0;
  padding: 0;
}

.time.countdown time {
  position: relative;
  z-index: 1;
  display: inline-block;
  width: 45px;
  height: 44.1px;
  text-align: left;
}

.time.countdown em {
  position: relative;
  z-index: 2;
  display: inline-block;
  width: 11px;
  height: 44.1px;
  color: var(--sd-theme-clock-clock-widget-text-01);
  font-style: normal;
  line-height: 44.1px;
  vertical-align: 0.08em;
}

.f16 {
  margin: 0;
  color: var(--sd-theme-clock-clock-widget-text-01);
  font-size: 16px;
  line-height: 24px;
}

.size-1-1 .time.countdown {
  display: flex;
  width: 85px;
  height: 24px;
  justify-content: center;
  font-size: 24px;
  line-height: 24px;
}

.size-1-1 .time.countdown time {
  width: auto;
  height: 24px;
}

.size-1-1 .time.countdown em {
  width: 6px;
  height: 24px;
  line-height: 24px;
}

.size-1-2 .time.countdown {
  display: flex;
  width: 129px;
  height: 24px;
  justify-content: center;
  font-size: 24px;
  line-height: 24px;
}

.size-1-2 .time.countdown time {
  width: auto;
  height: 24px;
}

.size-1-2 .time.countdown em {
  width: 6px;
  height: 24px;
  line-height: 24px;
}

.clock-center-2-1 {
  align-items: stretch;
}

.clock-vertical-digits {
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 20px;
  color: var(--sd-theme-clock-clock-widget-text-01);
}

.clock-icon-center > .clock-vertical-digits {
  display: flex;
}

.clock-vertical-time {
  display: block;
  width: 28px;
  height: 90px;
  color: var(--sd-theme-clock-clock-widget-text-01);
  font-family: cursive;
  font-style: normal;
}

.clock-vertical-digits time {
  display: block;
  width: 28px;
  height: 45px;
  font-size: 30px;
  font-weight: 400;
  line-height: 45px;
}

.clock-vertical-date {
  display: block;
  width: 33px;
  height: 36px;
}

.clock-vertical-digits small {
  display: block;
  width: 33px;
  height: 18px;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.clock-large-stack {
  display: block;
  width: 108px;
  height: 70px;
}

.clock-large-stack .time.countdown {
  width: 101px;
  height: 44.1px;
  margin-left: 3.5px;
}

.clock-large-stack .f16 {
  width: 108px;
  height: 24px;
}

.size-2-4 .time.countdown {
  width: 202px;
  height: 54.6px;
  margin-left: 0;
  font-size: 54.6px;
  line-height: 54.6px;
}

.size-2-4 .time.countdown time {
  width: 58px;
  height: 54.6px;
}

.size-2-4 .time.countdown em {
  width: 14px;
  height: 54.6px;
  line-height: 54.6px;
}

.size-2-4 .clock-large-stack {
  width: 202px;
  height: 79px;
}

.size-2-4 .f16 {
  width: 202px;
}
</style>
