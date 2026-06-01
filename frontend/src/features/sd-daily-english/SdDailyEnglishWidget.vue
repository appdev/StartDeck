<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";
import {
  SD_DAILY_ENGLISH_API_REFERENCE,
  SD_DAILY_ENGLISH_PROVIDER_REFERENCE,
  useSdDailyEnglishRuntime,
} from "./useSdDailyEnglishRuntime";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: SdWidgetSizeKey;
  refreshToken?: number;
}>();

const runtime = useSdDailyEnglishRuntime();
const lastRefreshToken = ref(props.refreshToken ?? 0);
const isIconOnly = computed(() =>
  ["1x1", "1x2", "2x1"].includes(props.sizeKey),
);

onMounted(() => {
  void runtime.load();
});

watch(
  () => props.refreshToken,
  (value) => {
    const token = value ?? 0;
    if (token === lastRefreshToken.value) return;
    lastRefreshToken.value = token;
    void runtime.load(true);
  },
);
</script>

<template>
  <span
    class="sd-daily-english-widget"
    data-sd-daily-english-widget
    :data-sd-daily-english-size="sizeKey"
    :data-daily-english-api="SD_DAILY_ENGLISH_API_REFERENCE"
    :data-daily-english-provider="SD_DAILY_ENGLISH_PROVIDER_REFERENCE"
    :data-daily-english-dateline="runtime.entry.value.dateline"
    :data-daily-english-source-status="runtime.sourceStatus.value"
  >
    <span
      class="daily-english-card"
      :class="`daily-english-size-${sizeKey.replace('x', '-')}`"
      :style="runtime.entryStyle.value"
    >
      <span class="daily-english-bg" aria-hidden="true"></span>
      <span v-if="isIconOnly" class="daily-english-icon" aria-hidden="true">
        <svg viewBox="0 0 48 48">
          <g fill="none">
            <path
              d="M20 8c1.576 0 2.997.663 4 1.725A5.485 5.485 0 0 1 28 8h13a3 3 0 0 1 3 3v18a7 7 0 0 0-3-5.745V11H28a2.5 2.5 0 0 0-2.5 2.5v21c0 .593.206 1.137.551 1.566A9.45 9.45 0 0 0 27.168 40 5.488 5.488 0 0 1 24 38.275 5.485 5.485 0 0 1 20 40H7a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3h13zm2.5 26.5v-21A2.5 2.5 0 0 0 20 11H7v26h13a2.5 2.5 0 0 0 2.5-2.5zM34.5 26a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm-1.6 4.65a.75.75 0 0 0-1.15.635v7.43c0 .58.63.94 1.15.635l6.315-3.715a.75.75 0 0 0 0-1.27L32.9 30.65z"
              fill="currentColor"
            />
          </g>
        </svg>
      </span>
      <template v-else-if="runtime.hasContent.value">
        <span class="daily-english-follow">
          {{ runtime.entry.value.mode }}
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M4.496 1.994A1 1 0 0 0 3 2.862v6.277a1 1 0 0 0 1.496.868l5.492-3.139a1 1 0 0 0 0-1.736L4.496 1.994z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span class="daily-english-copy">
          <p>{{ runtime.entry.value.sentence }}</p>
          <em>{{ runtime.entry.value.translation }}</em>
        </span>
      </template>
      <audio
        v-if="runtime.entry.value.audioUrl"
        class="daily-english-audio"
        :src="runtime.entry.value.audioUrl"
        preload="none"
        aria-hidden="true"
      ></audio>
    </span>
  </span>
</template>

<style scoped>
.sd-daily-english-widget,
.daily-english-card {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.daily-english-card {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  padding: 12px;
  background: var(
    --sd-theme-daily-english-daily-english-widget-surface-01
  );
  color: var(--sd-theme-daily-english-daily-english-widget-text-01);
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Helvetica Neue",
    sans-serif;
}

.daily-english-bg {
  position: absolute;
  inset: 0;
  display: block;
  background: var(--daily-english-image) center/cover no-repeat;
  opacity: 0.3;
}

.daily-english-icon {
  position: relative;
  z-index: 1;
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  color: var(--sd-theme-daily-english-daily-english-widget-text-01);
  font-size: 19px;
}

.daily-english-icon svg {
  width: 1.4em;
  height: 1.4em;
}

.daily-english-follow {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: inline-flex;
  height: 18px;
  align-items: center;
  color: var(--sd-theme-daily-english-daily-english-widget-text-02);
  font-size: 12px;
  line-height: 18px;
  transform: scale(0.84);
  transform-origin: top right;
}

.daily-english-follow svg {
  width: 12px;
  height: 12px;
  margin-left: 2px;
}

.daily-english-copy {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  flex-direction: column;
  justify-content: center;
}

.daily-english-copy p {
  margin: 0;
  color: var(--sd-theme-daily-english-daily-english-widget-text-01);
  font-size: 12px;
  line-height: 18px;
}

.daily-english-copy em {
  display: block;
  margin-top: 5px;
  color: var(--sd-theme-daily-english-daily-english-widget-text-03);
  font-size: 12px;
  font-style: normal;
  line-height: 18px;
}

.daily-english-audio {
  display: none;
}

.daily-english-size-2-4 .daily-english-copy {
  padding-right: 30px;
}

.daily-english-size-2-4 .daily-english-copy p,
.daily-english-size-2-4 .daily-english-copy em {
  font-size: 14px;
  line-height: 21px;
}
</style>
