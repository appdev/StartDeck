<script setup lang="ts">
import { onMounted } from "vue";
import type { WidgetConfig } from "@/types";
import {
  ITAB_MOVIE_CALENDAR_API_REFERENCE,
  useItabMovieCalendarRuntime,
} from "./useItabMovieCalendarRuntime";

defineProps<{
  widget: WidgetConfig;
}>();

const runtime = useItabMovieCalendarRuntime();

onMounted(() => {
  void runtime.load();
});
</script>

<template>
  <section
    class="itab-movie-calendar-opened-panel"
    :style="runtime.entryStyle.value"
    :data-itab-movie-calendar-api="ITAB_MOVIE_CALENDAR_API_REFERENCE"
    :data-itab-movie-calendar-date="runtime.entry.value.date"
    :data-itab-movie-calendar-title="runtime.entry.value.movieTitle"
    :data-itab-movie-calendar-source-status="runtime.sourceStatus.value"
  >
    <span class="movie-calendar-panel-bg" aria-hidden="true"></span>
    <div v-if="runtime.hasContent.value" class="movie-calendar-panel-copy">
      <h3>{{ runtime.entry.value.movieTitle }}</h3>
      <span class="movie-calendar-panel-rating-row">
        <span
          class="movie-calendar-panel-rating-star"
          aria-hidden="true"
        ></span>
        <span class="movie-calendar-panel-rating">
          {{ runtime.entry.value.rating }}
        </span>
      </span>
      <p class="movie-calendar-panel-meta">{{ runtime.metaText.value }}</p>
      <p class="movie-calendar-panel-director">
        {{ runtime.directorText.value }}
      </p>
      <p class="movie-calendar-panel-quote">
        “ {{ runtime.entry.value.quote }} ”
      </p>
      <p class="movie-calendar-panel-intro">{{ runtime.introText.value }}</p>
    </div>
    <aside
      v-if="runtime.entry.value.posterUrl || runtime.entry.value.movieTitle"
      class="movie-calendar-panel-poster"
      aria-hidden="true"
    >
      <img
        v-if="runtime.entry.value.posterUrl"
        :src="runtime.entry.value.posterUrl"
        :alt="runtime.entry.value.movieTitle"
        decoding="async"
      />
      <span v-else>{{ runtime.entry.value.movieTitle }}</span>
    </aside>
    <a
      v-if="runtime.entry.value.sourceUrl"
      class="movie-calendar-panel-source"
      data-itab-inner-control
      data-itab-hotspot-id="movie-source"
      data-itab-action="open-source"
      :href="runtime.entry.value.sourceUrl"
      target="_blank"
      rel="noreferrer"
      @click.stop
    >
      查看电影源→
    </a>
  </section>
</template>

<style scoped>
.itab-movie-calendar-opened-panel {
  position: relative;
  display: grid;
  grid-template-columns: 76% minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 0;
  row-gap: 0;
  align-content: start;
  align-items: start;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  margin: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(
    --sd-theme-itab-movie-calendar-movie-calendar-opened-panel-accent-text-01
  );
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Helvetica Neue",
    sans-serif;
  padding: 51px 50px 50px;
}

.movie-calendar-panel-bg {
  position: absolute;
  inset: -30px;
  z-index: 0;
  background:
    linear-gradient(
      var(
        --sd-theme-itab-movie-calendar-movie-calendar-opened-panel-surface-01
      ),
      var(
        --sd-theme-itab-movie-calendar-movie-calendar-opened-panel-accent-surface-01
      )
    ),
    var(--movie-poster-image, none) center/cover no-repeat,
    var(--sd-theme-itab-movie-calendar-movie-calendar-opened-panel-surface-02);
  filter: blur(15px);
}

.movie-calendar-panel-bg::after {
  position: absolute;
  inset: 0;
  background: var(
    --sd-theme-itab-movie-calendar-movie-calendar-opened-panel-surface-03
  );
  content: "";
}

.movie-calendar-panel-poster {
  position: relative;
  z-index: 1;
  display: grid;
  grid-column: 2;
  grid-row: 1;
  width: 100%;
  aspect-ratio: 273 / 405;
  height: auto;
  align-self: start;
  place-items: center;
  margin: 0;
  overflow: hidden;
  border-radius: 6px;
  background:
    linear-gradient(
      160deg,
      var(
        --sd-theme-itab-movie-calendar-movie-calendar-opened-panel-surface-04
      ),
      var(--sd-theme-itab-movie-calendar-movie-calendar-opened-panel-surface-05)
    ),
    var(
      --movie-bg-color,
      var(--sd-theme-itab-movie-calendar-movie-calendar-opened-panel-surface-06)
    );
  color: var(
    --sd-theme-itab-movie-calendar-movie-calendar-opened-panel-text-01
  );
  font-size: 38px;
  font-weight: 700;
  text-align: center;
}

.movie-calendar-panel-poster img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.movie-calendar-panel-copy {
  position: relative;
  z-index: 1;
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
  padding: 0 20px 0 0;
}

.movie-calendar-panel-copy h3 {
  margin: 0;
  overflow: hidden;
  color: var(
    --sd-theme-itab-movie-calendar-movie-calendar-opened-panel-accent-text-01
  );
  font-size: 30px;
  font-weight: 400;
  line-height: 48px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.movie-calendar-panel-rating-row {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 22.4px;
  margin: 0;
}

.movie-calendar-panel-rating-star {
  display: inline-block;
  flex: 0 0 auto;
  width: 55px;
  height: 11px;
  background-image: url("../../assets/itab/movie-calendar/rating_s@2x.png");
  background-position: 0 -33px;
  background-repeat: no-repeat;
  background-size: 55px 121px;
  line-height: 11px;
}

.movie-calendar-panel-rating {
  display: inline-block;
  color: var(
    --sd-theme-itab-movie-calendar-movie-calendar-opened-panel-accent-text-01
  );
  font-size: 14px;
  line-height: 22.4px;
}

.movie-calendar-panel-copy p {
  max-width: none;
  margin: 0;
  color: var(
    --sd-theme-itab-movie-calendar-movie-calendar-opened-panel-accent-text-01
  );
  font-size: 14px;
  line-height: 22.4px;
}

.movie-calendar-panel-quote {
  margin-top: 20px !important;
  color: var(
    --sd-theme-itab-movie-calendar-movie-calendar-opened-panel-text-02
  ) !important;
  font-size: 18px !important;
  line-height: 28.8px !important;
}

.movie-calendar-panel-intro {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 10px !important;
  color: var(
    --sd-theme-itab-movie-calendar-movie-calendar-opened-panel-text-03
  ) !important;
  font-size: 12px !important;
  line-height: 20px !important;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 7;
}

.movie-calendar-panel-source {
  position: relative;
  z-index: 1;
  grid-column: 1 / -1;
  grid-row: 2;
  width: 100%;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(
    --sd-theme-itab-movie-calendar-movie-calendar-opened-panel-accent-text-02
  );
  font-size: 12px;
  font-weight: 400;
  line-height: 19.2px;
  padding: 10px 0 0;
  text-align: left;
  text-decoration: none;
  opacity: 0.8;
}
</style>
