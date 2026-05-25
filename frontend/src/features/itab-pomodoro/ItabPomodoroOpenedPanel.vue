<script setup lang="ts">
import { computed } from "vue";
import type { WidgetConfig } from "@/types";
import {
  pomodoroImageUrl,
  pomodoroProgressCenterX,
  pomodoroProgressCenterY,
  pomodoroProgressDashArray,
  pomodoroProgressRadius,
  pomodoroProgressTransform,
  pomodoroThemes,
  pomodoroTickPaths,
  useItabPomodoroRuntime,
} from "./useItabPomodoroRuntime";
import type { ItabPomodoroWidgetData } from "./itabPomodoroTypes";

const props = defineProps<{
  widget: WidgetConfig;
}>();

const emit = defineEmits<{
  updateData: [data: ItabPomodoroWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useItabPomodoroRuntime(widgetRef, (data) =>
  emit("updateData", data),
);
</script>

<template>
  <div
    class="opened-tomato-body"
    data-itab-pomodoro-opened-panel
    data-grid-drag-ignore="true"
    :data-tomato-phase="runtime.phase.value"
    :data-tomato-running="String(runtime.running.value)"
    :data-tomato-remaining="String(runtime.remainingSeconds.value)"
    :data-tomato-sessions="String(runtime.sessions.value)"
    :data-tomato-audio-src="runtime.activeAudioUrl.value"
    :data-tomato-audio-enabled="String(runtime.audioEnabled.value)"
    :data-tomato-audio-blocked="String(runtime.audioBlocked.value)"
    :data-tomato-progress="runtime.progressValue.value"
  >
    <div class="opened-tomato-bg-stack" aria-hidden="true">
      <img
        v-for="(theme, themeIndex) in pomodoroThemes"
        :key="`opened-tomato-${theme.path}`"
        alt="bg"
        :class="{ active: themeIndex === runtime.state.value.themeIndex.value }"
        :src="pomodoroImageUrl(theme.path, 'opened')"
      />
    </div>
    <div class="opened-tomato-content">
      <div class="opened-tomato-theme">
        <button
          type="button"
          aria-label="上一个番茄背景"
          @click.stop="runtime.switchTheme(-1)"
        >
          <svg viewBox="0 0 512 512" aria-hidden="true">
            <path
              d="M217.9,256L345,129c9.4-9.4,9.4-24.6,0-33.9c-9.4-9.4-24.6-9.3-34,0L167,239c-9.1,9.1-9.3,23.7-0.7,33.1L310.9,417c4.7,4.7,10.9,7,17,7c6.1,0,12.3-2.3,17-7c9.4-9.4,9.4-24.6,0-33.9L217.9,256z"
            />
          </svg>
        </button>
        <span>{{ runtime.activeTheme.value.name }}</span>
        <button
          type="button"
          aria-label="下一个番茄背景"
          @click.stop="runtime.switchTheme(1)"
        >
          <svg viewBox="0 0 512 512" aria-hidden="true">
            <path
              d="M294.1,256L167,129c-9.4-9.4-9.4-24.6,0-33.9c9.4-9.4,24.6-9.3,34,0L345,239c9.1,9.1,9.3,23.7,0.7,33.1L201.1,417c-4.7,4.7-10.9,7-17,7c-6.1,0-12.3-2.3-17-7c-9.4-9.4-9.4-24.6,0-33.9L294.1,256z"
            />
          </svg>
        </button>
      </div>
      <div class="tomato-dial">
        <svg
          class="tomato-dial-ring"
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
            :key="`opened-tomato-ring-${tickIndex}`"
            :d="tickPath"
            stroke="currentColor"
            stroke-width="4"
            stroke-miterlimit="10"
            stroke-linecap="round"
          />
        </svg>
        <strong>{{ runtime.displayText.value }}</strong>
      </div>
      <div
        class="opened-tomato-controls"
        :data-tomato-control-state="runtime.primaryControlState.value"
      >
        <button
          type="button"
          class="opened-tomato-control opened-tomato-start"
          :class="`is-${runtime.primaryControlState.value}`"
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
          type="button"
          class="opened-tomato-control opened-tomato-stop"
          aria-label="停止"
          @click.stop="runtime.stop"
        >
          <svg viewBox="0 0 512 512" aria-hidden="true">
            <path
              d="M392 432H120a40 40 0 0 1-40-40V120a40 40 0 0 1 40-40h272a40 40 0 0 1 40 40v272a40 40 0 0 1-40 40z"
            />
          </svg>
        </button>
      </div>
      <button
        type="button"
        class="opened-tomato-audio"
        :class="{
          active: runtime.audioEnabled.value,
          muted: !runtime.audioEnabled.value,
          blocked: runtime.audioBlocked.value,
        }"
        aria-label="声音"
        :aria-pressed="runtime.audioEnabled.value"
        :data-tomato-audio-icon="runtime.audioIconState.value"
        :title="
          runtime.audioBlocked.value
            ? '浏览器阻止自动播放，点击开始后会重试'
            : runtime.activeTheme.value.name
        "
        @click.stop="runtime.toggleAudio"
      >
        <svg viewBox="0 0 512 512" aria-hidden="true">
          <path
            d="M96 192h86l112-96c20-17 50-3 50 23v274c0 26-30 40-50 23L182 320H96c-18 0-32-14-32-32v-64c0-18 14-32 32-32z"
          />
          <path
            d="M392 180c24 20 40 48 40 76s-16 56-40 76l-23-28c16-13 25-30 25-48s-9-35-25-48l23-28z"
          />
          <path
            d="M432 146c43 29 72 72 72 110s-29 81-72 110l-24-32c31-21 52-51 52-78s-21-57-52-78l24-32z"
          />
          <path class="tomato-sound-slash" d="M112 104l296 296" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.opened-tomato-body {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-text-01);
}

.opened-tomato-bg-stack,
.opened-tomato-bg-stack img {
  position: absolute;
  inset: 0;
}

.opened-tomato-bg-stack img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.28s ease;
}

.opened-tomato-bg-stack img.active {
  opacity: 1;
}

.opened-tomato-body::after {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: var(
    --sd-theme-itab-pomodoro-pomodoro-opened-panel-accent-surface-01
  );
  content: "";
}

.opened-tomato-content {
  position: relative;
  z-index: 2;
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: translateY(11px);
}

.opened-tomato-theme {
  display: flex;
  height: 24px;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
  color: var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-text-02);
  font-family: Arial, sans-serif;
}

.opened-tomato-theme button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
}

.opened-tomato-theme svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

.opened-tomato-theme span {
  display: block;
  margin: 0 16px;
  font-size: 16px;
  line-height: 24px;
}

.tomato-dial {
  position: relative;
  display: grid;
  width: 360px;
  height: 360px;
  place-items: center;
  color: var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-text-03);
}

.tomato-dial-ring {
  position: absolute;
  inset: 0;
  width: 360px;
  height: 360px;
  color: var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-text-04);
}

.tomato-dial-ring circle,
.tomato-dial-ring path {
  stroke: currentColor;
  stroke-linecap: round;
}

.tomato-dial-ring .tomato-progress-track,
.tomato-dial-ring .tomato-progress-fill {
  fill: none;
  stroke-width: 18;
}

.tomato-dial-ring .tomato-progress-track {
  stroke: var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-surface-01);
}

.tomato-dial-ring .tomato-progress-fill {
  stroke: var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-surface-02);
  stroke-linecap: butt;
  transition:
    stroke-dashoffset 0.6s ease 0s,
    stroke 0.6s ease 0s,
    opacity 0.6s ease 0s;
}

.tomato-dial-ring path {
  fill: none;
  stroke-width: 4;
}

.tomato-dial strong {
  position: relative;
  z-index: 1;
  color: var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-text-03);
  font-family: Arial, sans-serif;
  font-size: 70px;
  font-weight: 700;
  line-height: 105px;
}

.opened-tomato-controls {
  display: flex;
  height: 40px;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin: 16px 0 20px;
}

.opened-tomato-control {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  padding: 0;
  overflow: hidden;
  border: 2px solid
    var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-border-01);
  border-radius: 999px;
  background: var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-surface-03);
  color: var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-text-02);
  backdrop-filter: blur(10px);
}

.opened-tomato-start {
  border-color: var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-border-02);
  background: var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-surface-04);
}

.opened-tomato-stop {
  color: var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-text-05);
}

.opened-tomato-control svg {
  width: 19px;
  height: 19px;
  fill: currentColor;
}

.opened-tomato-start .tomato-control-play-icon {
  transform: translateX(1px);
}

.opened-tomato-audio {
  position: absolute;
  left: 18px;
  bottom: 14px;
  z-index: 3;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-text-06);
}

.opened-tomato-audio.active {
  color: var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-text-02);
}

.opened-tomato-audio:not(.active) {
  opacity: 0.48;
}

.opened-tomato-audio.blocked {
  color: var(--sd-theme-itab-pomodoro-pomodoro-opened-panel-accent-text-01);
}

.opened-tomato-audio svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.opened-tomato-audio .tomato-sound-slash {
  display: none;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 46;
}

.opened-tomato-audio.muted .tomato-sound-slash {
  display: block;
}
</style>
