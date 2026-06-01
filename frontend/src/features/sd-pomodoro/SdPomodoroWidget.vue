<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";
import {
  pomodoroImageUrl,
  pomodoroProgressCenterX,
  pomodoroProgressCenterY,
  pomodoroProgressDashArray,
  pomodoroProgressRadius,
  pomodoroProgressTransform,
  pomodoroThemes,
  pomodoroTickPaths,
  useSdPomodoroRuntime,
} from "./useSdPomodoroRuntime";
import type { SdPomodoroWidgetData } from "./sdPomodoroTypes";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: SdWidgetSizeKey;
  refreshToken?: number;
}>();

const emit = defineEmits<{
  updateData: [data: SdPomodoroWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useSdPomodoroRuntime(widgetRef, (data) =>
  emit("updateData", data),
);
const lastRefreshToken = ref(props.refreshToken ?? 0);

const outerTime = computed(() =>
  props.sizeKey === "2x1"
    ? runtime.displayText.value.replace(":", " ")
    : runtime.displayText.value,
);

watch(
  () => props.refreshToken,
  (value) => {
    const token = value ?? 0;
    if (token === lastRefreshToken.value) return;
    lastRefreshToken.value = token;
    runtime.ensureHydrated(true);
  },
);
</script>

<template>
  <span
    class="sd-pomodoro-widget"
    data-sd-pomodoro-widget
    :data-sd-pomodoro-size="sizeKey"
    :data-tomato-phase="runtime.phase.value"
    :data-tomato-running="String(runtime.running.value)"
    :data-tomato-remaining="String(runtime.remainingSeconds.value)"
    :data-tomato-sessions="String(runtime.sessions.value)"
  >
    <span class="tomato-icon-wrap" :class="`iconsize-${sizeKey}`">
      <span class="tomato-bg-carousel" aria-hidden="true">
        <span
          v-for="(theme, themeIndex) in pomodoroThemes"
          :key="`tomato-outer-${sizeKey}-${theme.path}`"
          class="tomato-bg-item"
          :class="{
            active: themeIndex === runtime.state.value.themeIndex.value,
          }"
          :style="{
            transform: `translateX(${(themeIndex - runtime.state.value.themeIndex.value) * 100}%)`,
          }"
        >
          <span class="tomato-bg-dim"></span>
          <img alt="bg" :src="pomodoroImageUrl(theme.path, sizeKey)" />
        </span>
      </span>
      <span v-if="sizeKey === '2x4'" class="tomato-switch-btn">
        <button
          class="tomato-switch-action"
          type="button"
          data-grid-drag-ignore="true"
          aria-label="上一个番茄背景"
          @click.stop="runtime.switchTheme(-1)"
        >
          <svg viewBox="0 0 512 512" aria-hidden="true">
            <path
              d="M217.9,256L345,129c9.4-9.4,9.4-24.6,0-33.9c-9.4-9.4-24.6-9.3-34,0L167,239c-9.1,9.1-9.3,23.7-0.7,33.1L310.9,417c4.7,4.7,10.9,7,17,7c6.1,0,12.3-2.3,17-7c9.4-9.4,9.4-24.6,0-33.9L217.9,256z"
            />
          </svg>
        </button>
        <span class="tomato-theme-name">{{
          runtime.activeTheme.value.name
        }}</span>
        <button
          class="tomato-switch-action"
          type="button"
          data-grid-drag-ignore="true"
          aria-label="下一个番茄背景"
          @click.stop="runtime.switchTheme(1)"
        >
          <svg viewBox="0 0 512 512" aria-hidden="true">
            <path
              d="M294.1,256L167,129c-9.4-9.4-9.4-24.6,0-33.9c9.4-9.4,24.6-9.3,34,0L345,239c9.1,9.1,9.3,23.7,0.7,33.1L201.1,417c-4.7,4.7-10.9,7-17,7c-6.1,0-12.3-2.3-17-7c-9.4-9.4-9.4-24.6,0-33.9L294.1,256z"
            />
          </svg>
        </button>
      </span>
      <span v-if="sizeKey === '2x4'" class="tomato-text-separator">{{
        " "
      }}</span>
      <span class="tomato-progress-box">
        <svg
          v-if="sizeKey === '2x2' || sizeKey === '2x4'"
          class="tomato-progress-ring"
          viewBox="0 0 450 450"
          fill="none"
          aria-hidden="true"
          :data-tomato-progress="runtime.progressValue.value"
        >
          <circle
            class="tomato-progress-track"
            :cx="pomodoroProgressCenterX"
            :cy="pomodoroProgressCenterY"
            :r="pomodoroProgressRadius"
          />
          <circle
            class="tomato-progress-fill"
            :cx="pomodoroProgressCenterX"
            :cy="pomodoroProgressCenterY"
            :r="pomodoroProgressRadius"
            :stroke-dasharray="pomodoroProgressDashArray"
            :stroke-dashoffset="runtime.progressDashOffset.value"
            :transform="pomodoroProgressTransform"
            stroke-linecap="butt"
          />
          <path
            v-for="(tickPath, tickIndex) in pomodoroTickPaths"
            :key="`tomato-ring-${sizeKey}-${tickIndex}`"
            :d="tickPath"
            stroke="currentColor"
            stroke-width="4"
            stroke-miterlimit="10"
            stroke-linecap="round"
          />
        </svg>
        <span class="tomato-time-grid">
          <p class="b time">
            <template v-if="sizeKey === '2x1'">
              <time>{{ runtime.displayText.value.slice(0, 2) }}</time>
              <time>{{ runtime.displayText.value.slice(3) }}</time>
            </template>
            <time v-else>{{ outerTime }}</time>
          </p>
        </span>
        <span
          class="tomato-outer-controls"
          :data-tomato-control-state="runtime.primaryControlState.value"
        >
          <button
            class="tomato-outer-control tomato-outer-control-primary"
            type="button"
            data-grid-drag-ignore="true"
            :aria-label="runtime.primaryControlLabel.value"
            @click.stop="runtime.toggle"
          >
            <svg
              v-if="runtime.running.value"
              class="tomato-control-pause-icon"
              viewBox="0 0 512 512"
              aria-hidden="true"
            >
              <path
                d="M208 432h-48a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v320a16 16 0 0 1-16 16z"
              />
              <path
                d="M352 432h-48a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v320a16 16 0 0 1-16 16z"
              />
            </svg>
            <svg
              v-else
              class="tomato-control-play-icon"
              viewBox="0 0 512 512"
              aria-hidden="true"
            >
              <path
                d="M133 440a35.37 35.37 0 0 1-17.5-4.67c-12-6.8-19.46-20-19.46-34.33V111c0-14.37 7.46-27.53 19.46-34.33a35.13 35.13 0 0 1 35.77.45l247.85 148.36a36 36 0 0 1 0 61l-247.89 148.4A35.5 35.5 0 0 1 133 440z"
              />
            </svg>
          </button>
          <button
            v-if="runtime.secondaryControlVisible.value"
            class="tomato-outer-control tomato-outer-control-stop"
            type="button"
            data-grid-drag-ignore="true"
            aria-label="停止"
            @click.stop="runtime.stop"
          >
            <svg viewBox="0 0 512 512" aria-hidden="true">
              <path
                d="M392 432H120a40 40 0 0 1-40-40V120a40 40 0 0 1 40-40h272a40 40 0 0 1 40 40v272a40 40 0 0 1-40 40z"
              />
            </svg>
          </button>
        </span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.sd-pomodoro-widget,
.tomato-icon-wrap {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.tomato-icon-wrap {
  position: relative;
  overflow: visible;
  background: var(--sd-theme-pomodoro-pomodoro-widget-surface-01);
  color: var(--sd-theme-pomodoro-pomodoro-widget-text-01);
  font-family: Arial, sans-serif;
  text-align: center;
}

.tomato-bg-carousel,
.tomato-bg-item {
  position: absolute;
  inset: 0;
}

.tomato-bg-carousel {
  overflow: visible;
}

.tomato-bg-item {
  transition: transform 0.28s ease;
}

.tomato-bg-dim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: var(--sd-theme-pomodoro-pomodoro-widget-accent-surface-01);
}

.tomato-bg-item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tomato-switch-btn {
  position: absolute;
  top: 50%;
  right: 0;
  left: 46%;
  z-index: 20;
  display: flex;
  height: 24px;
  align-items: center;
  justify-content: center;
  margin-top: -11px;
  color: var(--sd-theme-pomodoro-pomodoro-widget-text-01);
}

.tomato-switch-btn svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

.tomato-switch-action {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: currentColor;
  cursor: pointer;
}

.tomato-theme-name {
  display: block;
  margin: 0 16px;
  font-size: 16px;
  line-height: 24px;
}

.tomato-text-separator {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  white-space: pre;
}

.tomato-progress-box {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: var(--sd-theme-pomodoro-pomodoro-widget-text-01);
}

.iconsize-2x4 .tomato-progress-box {
  right: auto;
  width: 70%;
}

.tomato-progress-ring {
  position: absolute;
  inset: 12px;
  z-index: 0;
  width: calc(100% - 24px);
  height: calc(100% - 24px);
  color: var(--sd-theme-pomodoro-pomodoro-widget-text-02);
  pointer-events: none;
}

.tomato-progress-ring circle,
.tomato-progress-ring path {
  stroke: currentColor;
  stroke-linecap: round;
}

.tomato-progress-ring .tomato-progress-track,
.tomato-progress-ring .tomato-progress-fill {
  fill: none;
  stroke-width: 18;
}

.tomato-progress-ring .tomato-progress-track {
  stroke: var(--sd-theme-pomodoro-pomodoro-widget-surface-02);
}

.tomato-progress-ring .tomato-progress-fill {
  stroke: var(--sd-theme-pomodoro-pomodoro-widget-surface-03);
  stroke-linecap: butt;
  transition:
    stroke-dashoffset 0.6s ease 0s,
    stroke 0.6s ease 0s,
    opacity 0.6s ease 0s;
}

.tomato-progress-ring path {
  fill: none;
  stroke-width: 4;
}

.tomato-time-grid {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  font-family: Arial, sans-serif;
}

.tomato-time-grid p {
  margin: 0;
  color: var(--sd-theme-pomodoro-pomodoro-widget-text-01);
  font-weight: 700;
}

.tomato-time-grid time {
  color: inherit;
  font-family: inherit;
  font-weight: inherit;
}

.tomato-outer-controls {
  position: absolute;
  bottom: 29px;
  left: 50%;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateX(-50%);
}

.iconsize-1x1 .tomato-outer-controls,
.iconsize-1x2 .tomato-outer-controls,
.iconsize-2x1 .tomato-outer-controls {
  inset: 0;
  display: none;
  margin-top: 0;
  background-color: var(--sd-theme-pomodoro-pomodoro-widget-surface-01);
  transform: none;
}

.iconsize-1x1:hover .tomato-outer-controls,
.iconsize-1x2:hover .tomato-outer-controls,
.iconsize-2x1:hover .tomato-outer-controls {
  display: flex;
}

.iconsize-2x1 .tomato-outer-controls {
  flex-direction: column;
}

.tomato-outer-control {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  margin: 0 2px;
  padding: 0;
  border: 2px solid var(--sd-theme-pomodoro-pomodoro-widget-border-01);
  border-radius: 999px;
  background: transparent;
  color: var(--sd-theme-pomodoro-pomodoro-widget-text-03);
  cursor: pointer;
}

.iconsize-1x1 .tomato-outer-control {
  width: 22px;
  height: 22px;
}

.iconsize-2x1 .tomato-outer-control {
  margin: 2px;
}

.tomato-outer-control-primary {
  border-color: var(--sd-theme-pomodoro-pomodoro-widget-border-01);
  background: transparent;
}

.tomato-outer-control:hover {
  border-color: var(--sd-theme-pomodoro-pomodoro-widget-border-02);
  background: var(--sd-theme-pomodoro-pomodoro-widget-surface-04);
  color: var(--sd-theme-pomodoro-pomodoro-widget-text-01);
}

.tomato-outer-control svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.tomato-outer-control-primary .tomato-control-play-icon {
  transform: translateX(1px);
}

.iconsize-1x1 .tomato-time-grid p,
.iconsize-1x1 .tomato-time-grid time {
  width: 43px;
  height: 24px;
  font-size: 16px;
  line-height: 24px;
}

.iconsize-1x2 .tomato-time-grid p,
.iconsize-1x2 .tomato-time-grid time {
  width: 86px;
  height: 48px;
  font-size: 32px;
  line-height: 48px;
}

.iconsize-2x1 .tomato-progress-box {
  padding: 20px 0;
}

.iconsize-2x1 .tomato-time-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
}

.iconsize-2x1 .tomato-time-grid p {
  display: grid;
  width: 36px;
  height: 90px;
  font-size: 30px;
  font-weight: 400;
  line-height: 45px;
}

.iconsize-2x1 .tomato-time-grid time {
  display: block;
  width: 36px;
  height: 45px;
  font-size: 30px;
  line-height: 45px;
}

.iconsize-2x2 .tomato-time-grid p,
.iconsize-2x4 .tomato-time-grid p {
  width: 100%;
  height: 50px;
  font-size: 21px;
  line-height: 31.5px;
}

.iconsize-2x2 .tomato-time-grid time,
.iconsize-2x4 .tomato-time-grid time {
  display: inline;
  width: 90px;
  height: 39px;
  font-size: 33.6px;
  line-height: 50.4px;
}
</style>
