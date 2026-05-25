<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import type { WidgetConfig } from "@/types";
import {
  ITAB_DAILY_ENGLISH_API_REFERENCE,
  ITAB_DAILY_ENGLISH_PROVIDER_REFERENCE,
  useItabDailyEnglishRuntime,
} from "./useItabDailyEnglishRuntime";

defineProps<{
  widget: WidgetConfig;
}>();

const runtime = useItabDailyEnglishRuntime();
const audioElement = ref<HTMLAudioElement | null>(null);
const playing = ref(false);

const stopAudio = () => {
  const audio = audioElement.value;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  playing.value = false;
};

const togglePlayback = async () => {
  const audio = audioElement.value;
  if (!audio || !runtime.entry.value.audioUrl) {
    playing.value = false;
    return;
  }

  if (playing.value) {
    audio.pause();
    playing.value = false;
    return;
  }

  try {
    await audio.play();
    playing.value = true;
  } catch {
    playing.value = false;
  }
};

onMounted(() => {
  void runtime.load();
});

onUnmounted(stopAudio);
</script>

<template>
  <div
    class="itab-daily-english-opened-panel"
    :class="{ playing }"
    :style="runtime.entryStyle.value"
    :data-daily-english-state="playing ? 'playing' : 'paused'"
    :data-daily-english-api="ITAB_DAILY_ENGLISH_API_REFERENCE"
    :data-daily-english-provider="ITAB_DAILY_ENGLISH_PROVIDER_REFERENCE"
    :data-daily-english-dateline="runtime.entry.value.dateline"
    :data-daily-english-source-status="runtime.sourceStatus.value"
  >
    <span class="opened-english-bg" aria-hidden="true"></span>
    <span class="opened-english-shade" aria-hidden="true"></span>
    <section class="opened-english-copy">
      <p>{{ runtime.entry.value.sentence }}</p>
      <em>{{ runtime.entry.value.translation }}</em>
    </section>
    <button
      class="opened-english-play"
      type="button"
      data-itab-inner-control
      data-itab-hotspot-id="today-english-play"
      data-itab-action="toggle-audio-progress"
      :aria-label="playing ? '暂停跟读' : '播放跟读'"
      :aria-pressed="playing"
      @click.stop="togglePlayback"
    >
      <svg v-if="playing" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M3 2.4h2v7.2H3V2.4zm4 0h2v7.2H7V2.4z" />
      </svg>
      <svg v-else viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M4.496 1.994A1 1 0 0 0 3 2.862v6.277a1 1 0 0 0 1.496.868l5.492-3.139a1 1 0 0 0 0-1.736L4.496 1.994z"
        />
      </svg>
    </button>
    <span class="opened-english-progress" aria-hidden="true">
      {{ runtime.entry.value.progressLabel }}
    </span>
    <audio
      ref="audioElement"
      class="opened-english-audio"
      :src="runtime.entry.value.audioUrl"
      preload="none"
      aria-hidden="true"
      @ended="stopAudio"
    ></audio>
  </div>
</template>

<style scoped>
.itab-daily-english-opened-panel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 20px;
  background: var(
    --sd-theme-itab-daily-english-daily-english-opened-panel-surface-01
  );
  color: var(--sd-theme-itab-daily-english-daily-english-opened-panel-text-01);
}

.opened-english-bg,
.opened-english-shade {
  position: absolute;
  inset: 0;
  display: block;
}

.opened-english-bg {
  background: var(--daily-english-image) center/cover no-repeat;
  opacity: 0.5;
}

.opened-english-shade {
  background: var(
    --sd-theme-itab-daily-english-daily-english-opened-panel-surface-02
  );
}

.opened-english-copy {
  position: absolute;
  top: 214px;
  left: 50%;
  z-index: 1;
  width: min(520px, calc(100% - 120px));
  text-align: center;
  transform: translateX(-50%);
}

.opened-english-copy p {
  margin: 0;
  color: var(--sd-theme-itab-daily-english-daily-english-opened-panel-text-01);
  font-family:
    Arial,
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  font-size: 18px;
  line-height: 27px;
}

.opened-english-copy em {
  display: block;
  margin-top: 12px;
  color: var(--sd-theme-itab-daily-english-daily-english-opened-panel-text-02);
  font-size: 13px;
  font-style: normal;
  line-height: 20px;
}

.opened-english-play {
  position: absolute;
  top: 300px;
  left: 50%;
  z-index: 2;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(
    --sd-theme-itab-daily-english-daily-english-opened-panel-surface-03
  );
  color: var(--sd-theme-itab-daily-english-daily-english-opened-panel-text-01);
  transform: translateX(-50%);
}

.opened-english-play svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
}

.opened-english-play:not([aria-pressed="true"]) svg {
  transform: translateX(1px);
}

.opened-english-progress {
  position: absolute;
  left: 12px;
  bottom: 10px;
  color: transparent;
  font-size: 0;
}

.opened-english-audio {
  display: none;
}
</style>
