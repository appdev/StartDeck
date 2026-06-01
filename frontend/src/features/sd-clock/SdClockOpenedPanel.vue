<script setup lang="ts">
import { computed } from "vue";
import type { WidgetConfig } from "@/types";
import SdFlipCard from "./SdFlipCard.vue";
import { useSdClockRuntime } from "./useSdClockRuntime";
import type { SdClockWidgetData } from "./sdClockTypes";

const props = defineProps<{
  widget: WidgetConfig;
}>();

const emit = defineEmits<{
  close: [];
  updateData: [data: SdClockWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useSdClockRuntime(widgetRef, (data) =>
  emit("updateData", data),
);
</script>

<template>
  <div class="opened-clock-panel" data-grid-drag-ignore="true">
    <div class="d-dialog-header clock-source-header">
      <div class="d-dialog-tool is-mac">
        <span class="toggle-fullscreen" title="放大/缩小" aria-hidden="true">
          <svg viewBox="0 0 200 200">
            <path
              d="M153.131 37L76.1311 37.3443C70.623 37.3443 69.3607 40.5574 73.2623 44.3443L155.77 126.852C159.672 130.754 162.77 129.377 162.77 123.984L163 46.9836C163 41.4754 158.525 37 153.131 37ZM44.2295 73.2623C40.3279 69.3607 37.2295 70.7377 37.2295 76.1311L37 153.131C37 158.639 41.4754 163 46.8689 163L123.869 162.656C129.377 162.656 130.639 159.443 126.738 155.656L44.2295 73.2623Z"
            />
          </svg>
        </span>
        <button
          class="close-window"
          title="关闭"
          type="button"
          @click="emit('close')"
        >
          <svg viewBox="0 0 11 11" aria-hidden="true">
            <path
              d="M8.55 10.58L5.5 7.53L2.45 10.58C1.89 11.14 0.98 11.14 0.42 10.58C-0.14 10.02 -0.14 9.11 0.42 8.55L3.47 5.5L0.42 2.45C-0.14 1.89 -0.14 0.98 0.42 0.42C0.98 -0.14 1.89 -0.14 2.45 0.42L5.5 3.47L8.55 0.42C9.11 -0.14 10.02 -0.14 10.58 0.42C11.14 0.98 11.14 1.89 10.58 2.45L7.53 5.5L10.58 8.55C11.14 9.11 11.14 10.02 10.58 10.58C10.02 11.14 9.11 11.14 8.55 10.58Z"
            />
          </svg>
        </button>
      </div>
    </div>
    <div class="d-dialog-body clock-dialog-body">
      <div class="clock-dialog-root">
        <div class="clock-dialog-center">
          <div
            class="clock-flip-row"
            :class="{ 'is-seconds-hidden': !runtime.showSeconds.value }"
          >
            <template
              v-for="(digit, index) in runtime.flipDigits.value"
              :key="`clock-flip-${index}`"
            >
              <span
                v-if="index === 2 || index === 4"
                class="clock-flip-separator"
                aria-hidden="true"
                >:</span
              >
              <div class="clock-flip-slot">
                <SdFlipCard
                  class="scoreboard-digit"
                  :digit="digit"
                  :duration="420"
                  aria-hidden="true"
                />
                <span class="scoreboard-value">{{ digit }}</span>
              </div>
            </template>
          </div>
        </div>
        <div class="clock-bottom-controls">
          <button
            class="clock-control-button clock-sound-toggle"
            title="静音"
            type="button"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 9v6h4l5 4V5L8 9H4zm12.5.5 2 2 2-2 1 1-2 2 2 2-1 1-2-2-2 2-1-1 2-2-2-2 1-1z"
              />
            </svg>
          </button>
          <button
            class="clock-control-button clock-bottom-fullscreen"
            title="全屏"
            type="button"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 9V4h5v2H6v3H4zm14 0V6h-3V4h5v5h-2zM4 15h2v3h3v2H4v-5zm14 3v-3h2v5h-5v-2h3z"
              />
            </svg>
          </button>
          <div
            class="el-switch el-switch--small"
            :class="{ 'is-checked': runtime.showSeconds.value }"
            role="switch"
            tabindex="0"
            title="显示秒"
            aria-label="显示秒"
            :aria-checked="runtime.showSeconds.value"
            @click.stop="runtime.toggleSeconds()"
            @keydown.enter.prevent="runtime.toggleSeconds()"
            @keydown.space.prevent="runtime.toggleSeconds()"
          >
            <input
              class="el-switch__input"
              type="checkbox"
              role="switch"
              :checked="runtime.showSeconds.value"
              :aria-checked="runtime.showSeconds.value"
              aria-disabled="false"
              tabindex="-1"
              readonly
            />
            <span class="el-switch__core">
              <span class="el-switch__action"></span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.opened-clock-panel {
  position: relative;
  height: 100%;
  padding: 0;
  overflow: hidden;
}

.clock-source-header {
  position: absolute;
  inset: 0 0 auto;
  z-index: 12;
  height: 10px;
  padding: 5px;
}

.d-dialog-tool {
  position: absolute;
  top: 11px;
  right: 13px;
  display: flex;
  align-items: center;
  gap: 11px;
  color: var(--sd-theme-clock-clock-opened-panel-text-01);
}

.toggle-fullscreen,
.close-window {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
}

.toggle-fullscreen svg {
  width: 11px;
  height: 11px;
  fill: currentColor;
}

.close-window svg {
  width: 8px;
  height: 8px;
  fill: currentColor;
}

.clock-dialog-body {
  position: relative;
  z-index: 10;
  height: 100%;
  overflow: hidden;
}

.clock-dialog-root {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--sd-theme-clock-clock-opened-panel-surface-01);
}

.clock-dialog-center {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.clock-flip-row {
  display: flex;
  width: 868.5px;
  height: 196.953px;
  align-items: center;
  justify-content: center;
  margin-top: -53.227px;
  color: var(--sd-theme-clock-clock-opened-panel-text-02);
  font-size: 33.2667px;
  line-height: 49.9px;
}

.clock-flip-row.is-seconds-hidden {
  width: 569px;
}

.clock-flip-slot {
  width: 134.75px;
  height: 196.953px;
}

.clock-flip-separator {
  display: flex;
  width: 30px;
  height: 186.953px;
  align-items: center;
  justify-content: center;
  margin: 5px 0;
  color: var(--sd-theme-clock-clock-opened-panel-text-03);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 58px;
  font-weight: 700;
  line-height: 1;
  transform: translateY(-2px);
}

.scoreboard-digit {
  --flip-card-width: 124.75px;
  --flip-card-height: 186.953px;
  --flip-card-radius: 12.6413px;
  --flip-font-family: Arial, Helvetica, sans-serif;
  --flip-font-size: 166.333px;
  --flip-font-weight: 800;
  --flip-text-color: var(--sd-theme-clock-clock-opened-panel-text-04);
  --flip-bg-top: linear-gradient(
    180deg,
    var(--sd-theme-clock-clock-opened-panel-surface-02) 0%,
    var(--sd-theme-clock-clock-opened-panel-surface-03) 100%
  );
  --flip-bg-bottom: linear-gradient(
    180deg,
    var(--sd-theme-clock-clock-opened-panel-surface-04) 0%,
    var(--sd-theme-clock-clock-opened-panel-surface-05) 100%
  );
  --flip-border-color: var(--sd-theme-clock-clock-opened-panel-border-01);
  --flip-shadow: 0 1px 10px
    var(--sd-theme-clock-clock-opened-panel-shadow-01);
  --flip-perspective: 480px;
  --flip-timing-down: cubic-bezier(0.45, 0, 0.35, 1);
  --flip-timing-up: cubic-bezier(0.25, 0, 0.15, 1);
  --flip-center-line: var(--sd-theme-clock-clock-opened-panel-surface-06);
  --flip-center-line-shadow: 0 1px 0
    var(--sd-theme-clock-clock-opened-panel-shadow-02);
  display: block;
  margin: 5px;
}

.scoreboard-value {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.clock-bottom-controls {
  position: absolute;
  right: 17px;
  bottom: 22px;
  z-index: 13;
  display: flex;
  width: auto;
  height: 24px;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  color: var(--sd-theme-clock-clock-opened-panel-text-05);
}

.clock-control-button {
  display: grid;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
}

.clock-control-button svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.el-switch {
  position: relative;
  display: flex;
  width: 30px;
  height: 24px;
  flex: 0 0 auto;
  align-items: center;
  color: var(--sd-theme-clock-clock-opened-panel-text-06);
  cursor: pointer;
}

.el-switch__input {
  position: absolute;
  width: 0;
  height: 0;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}

.el-switch__core {
  position: relative;
  display: flex;
  width: 30px;
  height: 16px;
  align-items: center;
  border: 1px solid var(--sd-theme-clock-clock-opened-panel-border-02);
  border-radius: 8px;
  background: var(--sd-theme-clock-clock-opened-panel-surface-07);
  line-height: 16px;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.el-switch.is-checked .el-switch__core {
  border-color: var(--sd-theme-clock-clock-opened-panel-accent-border-01);
  background: var(--sd-theme-clock-clock-opened-panel-accent-surface-01);
}

.el-switch__action {
  position: absolute;
  top: 1px;
  left: 1px;
  display: flex;
  width: 12px;
  height: 12px;
  border-radius: 100%;
  background: var(--sd-theme-clock-clock-opened-panel-surface-08);
  transition: left 0.18s ease;
}

.el-switch.is-checked .el-switch__action {
  left: 15px;
}
</style>
