<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";
import {
  ITAB_MOVIE_CALENDAR_API_REFERENCE,
  useItabMovieCalendarRuntime,
} from "./useItabMovieCalendarRuntime";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: ItabWidgetSizeKey;
  refreshToken?: number;
}>();

const runtime = useItabMovieCalendarRuntime();
const lastRefreshToken = ref(props.refreshToken ?? 0);
const sizeClass = computed(
  () => `movie-size-${props.sizeKey.replace("x", "-")}`,
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
    class="itab-movie-calendar-widget"
    data-itab-movie-calendar-widget
    :data-itab-movie-calendar-size="sizeKey"
    :data-itab-movie-calendar-api="ITAB_MOVIE_CALENDAR_API_REFERENCE"
    :data-itab-movie-calendar-date="runtime.entry.value.date"
    :data-itab-movie-calendar-title="runtime.entry.value.movieTitle"
    :data-itab-movie-calendar-source-status="runtime.sourceStatus.value"
  >
    <span
      class="movie-calendar-card"
      :class="sizeClass"
      :style="runtime.entryStyle.value"
    >
      <span class="movie-card-bg" aria-hidden="true"></span>

      <span v-if="sizeKey === '1x1'" class="movie-icon-view">
        <i class="movie-calendar-icon">
          <span class="movie-logo">{{ runtime.entry.value.day }}</span>
          <svg viewBox="0 0 512 512" aria-hidden="true">
            <rect
              x="80"
              y="112"
              width="352"
              height="320"
              rx="64"
              fill="currentColor"
            />
            <path
              d="M144 80v72M368 80v72M112 200h288"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="48"
            />
          </svg>
        </i>
      </span>

      <span
        v-else-if="sizeKey === '1x2' && runtime.hasContent.value"
        class="movie-inline"
      >
        <span class="movie-inline-stack">
          <span class="movie-title" :title="runtime.entry.value.movieTitle">
            《{{ runtime.entry.value.movieTitle }}》
          </span>
          <span class="movie-rating">
            <i>{{ runtime.ratingText.value }}</i>
          </span>
        </span>
      </span>

      <span
        v-else-if="sizeKey === '2x1' && runtime.hasContent.value"
        class="movie-vertical"
      >
        <span class="movie-vertical-stack">
          <span
            class="movie-title movie-title-vertical"
            :title="runtime.entry.value.movieTitle"
          >
            {{ runtime.entry.value.movieTitle }}
          </span>
          <span class="movie-rating movie-rating-vertical">
            <i>{{ runtime.ratingText.value }}</i>
          </span>
        </span>
      </span>

      <span v-else-if="runtime.hasContent.value" class="movie-wide">
        <span class="movie-date">
          <strong>{{ runtime.entry.value.day }}</strong>
          <em>
            {{ runtime.entry.value.monthLabel }}/{{
              runtime.entry.value.weekday
            }}
          </em>
        </span>
        <span class="movie-copy">
          <span class="movie-heading-line">
            <span class="movie-title" :title="runtime.entry.value.movieTitle">
              《{{ runtime.entry.value.movieTitle }}》
            </span>
            <span class="movie-rating">
              <i>{{ runtime.ratingText.value }}</i>
            </span>
          </span>
          <p>{{ runtime.entry.value.quote }}</p>
        </span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.itab-movie-calendar-widget,
.movie-calendar-card {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.movie-calendar-card {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  border-radius: 18px;
  background: var(
    --movie-bg-color,
    var(--sd-theme-itab-movie-calendar-movie-calendar-widget-surface-01)
  );
  color: var(
    --movie-text-color,
    var(--sd-theme-itab-movie-calendar-movie-calendar-widget-text-01)
  );
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Helvetica Neue",
    sans-serif;
  font-size: 12px;
  line-height: 18px;
}

.movie-card-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  background:
    linear-gradient(
      0deg,
      var(
        --movie-bg-color,
        var(--sd-theme-itab-movie-calendar-movie-calendar-widget-surface-01)
      ),
      var(--sd-theme-itab-movie-calendar-movie-calendar-widget-surface-02)
    ),
    var(--movie-cover-image, none) center/cover no-repeat,
    var(
      --movie-bg-color,
      var(--sd-theme-itab-movie-calendar-movie-calendar-widget-surface-01)
    );
}

.movie-calendar-card::after {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(
    --sd-theme-itab-movie-calendar-movie-calendar-widget-surface-03
  );
  content: "";
}

.movie-icon-view,
.movie-inline,
.movie-vertical,
.movie-wide {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
}

.movie-size-1-1,
.movie-size-1-2,
.movie-size-2-1,
.movie-size-2-4 {
  padding: 10px;
}

.movie-size-1-1,
.movie-size-1-2,
.movie-size-2-1 {
  box-shadow: 0 0 5px
    var(--sd-theme-itab-movie-calendar-movie-calendar-widget-shadow-01);
}

.movie-size-2-2,
.movie-size-2-4 {
  padding: 10px;
  box-shadow: 0 0 10px
    var(--sd-theme-itab-movie-calendar-movie-calendar-widget-shadow-02);
}

.movie-icon-view {
  display: flex;
  align-items: center;
  justify-content: center;
}

.movie-calendar-icon {
  position: relative;
  display: block;
  width: 86%;
  height: 86%;
  color: var(--sd-theme-itab-movie-calendar-movie-calendar-widget-text-02);
  font-style: normal;
  line-height: 12px;
}

.movie-calendar-icon svg {
  display: block;
  width: 100%;
  height: 100%;
}

.movie-calendar-icon svg rect {
  opacity: 0.96;
}

.movie-logo {
  position: absolute;
  top: 58%;
  left: 50%;
  z-index: 1;
  display: flex;
  width: 23px;
  height: 12px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--sd-theme-itab-movie-calendar-movie-calendar-widget-text-03);
  font-size: 19.2px;
  font-weight: 700;
  line-height: 12px;
  transform: translate(-50%, -50%);
}

.movie-inline {
  display: flex;
  align-items: flex-start;
}

.movie-inline-stack {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.movie-vertical {
  display: flex;
  justify-content: center;
}

.movie-vertical-stack {
  display: flex;
  height: 100%;
  min-width: 0;
}

.movie-wide {
  display: flex;
  align-items: flex-end;
}

.movie-date {
  display: block;
  width: 66px;
  height: 54px;
  overflow: visible;
  color: currentColor;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}

.movie-date strong {
  display: block;
  height: 38px;
  font-size: 40px;
  font-weight: 400;
  line-height: 32px;
}

.movie-date em {
  display: block;
  font-size: 12px;
  font-style: normal;
  line-height: 18px;
  transform: scale(0.8);
  transform-origin: center top;
}

.movie-copy {
  display: block;
  min-width: 0;
}

.movie-heading-line {
  display: block;
  min-width: 0;
  margin: 0 0 5px;
  font-size: 12px;
  line-height: 18px;
}

.movie-title {
  display: inline-block;
  overflow: hidden;
  max-width: 100%;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.movie-rating {
  display: inline-block;
  width: fit-content;
  min-width: 49px;
  height: 12px;
  box-sizing: border-box;
  padding: 0 2px;
  border-radius: 6px;
  background: var(
    --sd-theme-itab-movie-calendar-movie-calendar-widget-accent-surface-01
  );
  color: var(
    --sd-theme-itab-movie-calendar-movie-calendar-widget-accent-text-01
  );
  font-size: 12px;
  line-height: 12px;
  white-space: nowrap;
}

.movie-rating i {
  display: block;
  font-style: normal;
  line-height: 12px;
  transform: scale(0.82);
  transform-origin: left center;
}

.movie-copy p {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  opacity: 0.9;
  -webkit-box-orient: vertical;
}

.movie-size-1-2 .movie-title {
  max-width: 130px;
}

.movie-size-2-1 .movie-title-vertical {
  width: 14px;
  height: 125px;
  margin: 0 0 5px;
  line-height: 18px;
  white-space: normal;
  writing-mode: vertical-lr;
}

.movie-size-2-1 .movie-rating-vertical {
  display: flex;
  width: 12px;
  min-width: 12px;
  height: 48px;
  align-items: center;
  margin-left: 3px;
  writing-mode: vertical-lr;
}

.movie-size-2-2 .movie-wide {
  width: 130px;
  height: 130px;
}

.movie-size-2-2 .movie-date {
  position: absolute;
  top: 0;
  right: 0;
}

.movie-size-2-2 .movie-copy {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 130px;
  height: 76px;
}

.movie-size-2-2 .movie-heading-line {
  height: 35px;
}

.movie-size-2-2 .movie-heading-line .movie-title {
  width: 130px;
  margin-left: -4px;
}

.movie-size-2-2 .movie-heading-line .movie-rating {
  display: block;
}

.movie-size-2-2 .movie-copy p {
  height: 36px;
  -webkit-line-clamp: 2;
}

.movie-size-2-4 .movie-wide {
  width: 310px;
  height: 130px;
}

.movie-size-2-4 .movie-copy {
  width: 244px;
  height: 41px;
}

.movie-size-2-4 .movie-heading-line {
  display: flex;
  height: 18px;
  align-items: center;
}

.movie-size-2-4 .movie-heading-line .movie-title {
  width: auto;
  max-width: 190px;
  margin-left: -4px;
}

.movie-size-2-4 .movie-copy p {
  height: 18px;
  -webkit-line-clamp: 1;
}
</style>
