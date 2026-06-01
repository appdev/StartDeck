<script setup lang="ts">
import { computed, onMounted } from "vue";
import type { WidgetConfig } from "@/types";
import {
  formatWeatherDegree,
  useSdWeatherRuntime,
  weatherLifeIndexes,
} from "./useSdWeatherRuntime";
import type { SdWeatherWidgetData } from "./sdWeatherTypes";

const props = defineProps<{
  widget: WidgetConfig;
}>();

const emit = defineEmits<{
  updateData: [data: SdWeatherWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useSdWeatherRuntime(widgetRef, (data) =>
  emit("updateData", data),
);

onMounted(() => {
  runtime.ensureLoaded({ refreshIfStale: true });
});
</script>

<template>
  <div
    class="opened-weather-panel"
    :class="runtime.weatherOuterClass.value"
    data-sd-weather-opened-panel
    data-grid-drag-ignore="true"
  >
    <header class="opened-weather-header">
      <span>
        {{ runtime.activeLocation.value.province }} ·
        {{ runtime.activeLocation.value.city
        }}{{ runtime.sample.condition }} 发布于:{{ runtime.sample.reportTime }}
      </span>
      <div class="weather-header-tools">
        <div class="weather-combobox" @click.stop>
          <input
            v-model="runtime.searchText.header"
            role="combobox"
            aria-label="输入城市、乡镇"
            placeholder="输入城市、乡镇"
            @click.stop="runtime.pickerTarget.value = 'header'"
            @focus="runtime.pickerTarget.value = 'header'"
            @input="runtime.onCitySearchInput('header')"
          />
          <div
            v-if="runtime.pickerTarget.value === 'header'"
            class="weather-city-popover"
          >
            <button
              v-for="city in runtime.cityOptions.value"
              :key="`weather-header-${city.id}`"
              :class="{
                active: city.city === runtime.activeLocation.value.city,
              }"
              type="button"
              @click.stop="runtime.selectCity(city)"
            >
              <span>{{ city.province }} · {{ city.city }}</span>
              <b
                >{{ city.condition || "天气" }}
                {{ city.temp ? `${city.temp}°` : "" }}</b
              >
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="刷新天气"
          :disabled="runtime.loading.value"
          @click="runtime.loadCurrent(runtime.activeLocation.value, true)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.3L13 11h8V3l-3.3 3.3z"
            />
          </svg>
        </button>
        <button type="button" aria-label="天气列表">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16v2H4V7zm0 4h16v2H4v-2zm0 4h16v2H4v-2z" />
          </svg>
        </button>
      </div>
    </header>

    <p v-if="runtime.error.value" class="weather-runtime-error" role="status">
      {{ runtime.error.value }}
    </p>

    <section class="opened-weather-current">
      <div class="opened-weather-temp">
        <strong>{{ runtime.sample.temp }}°</strong>
        <span>
          <b>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2l3 6 6 .8-4.4 4.3 1 6-5.6-3-5.6 3 1-6L3 8.8 9 8l3-6z"
              />
            </svg>
            {{ runtime.sample.airQuality }}
          </b>
          <b>
            <img alt="" :src="runtime.sample.icon" />
            {{ runtime.sample.condition }} {{ runtime.sample.wind }}
          </b>
        </span>
      </div>
      <p>{{ runtime.sample.description }}</p>
      <dl class="opened-weather-metrics">
        <div v-for="metric in runtime.weatherMetrics.value" :key="metric.label">
          <dt>{{ metric.label }}</dt>
          <dd>{{ metric.value }}</dd>
        </div>
      </dl>
    </section>

    <section class="weather-hour-card">
      <h3>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 7v5l3 2 1-1.7-2-1.2V7h-2zm0-5a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"
          />
        </svg>
        24小时天气预报
      </h3>
      <div class="weather-hour-track">
        <span v-for="hour in runtime.hours.value" :key="hour.time">
          <b>{{ hour.time }}</b>
          <img alt="" :src="hour.icon" />
          <em>{{ hour.temp }}</em>
        </span>
        <svg
          class="weather-temp-line"
          viewBox="0 0 884 54"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline :points="runtime.weatherTempLinePoints.value" />
          <circle
            v-for="point in runtime.weatherTempPoints.value"
            :key="point.key"
            :cx="point.x"
            :cy="point.y"
            r="2.3"
          />
        </svg>
      </div>
    </section>

    <section class="weather-day-card">
      <h3>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 2v2H5a2 2 0 0 0-2 2v14h18V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 8H5V8h14v2z"
          />
        </svg>
        7日天气预报
      </h3>
      <div class="weather-day-grid">
        <article
          v-for="(day, dayIndex) in runtime.days.value"
          :key="`${day.day}-${day.date}`"
          :class="{ active: dayIndex === runtime.activeDayIndex.value }"
          role="button"
          tabindex="0"
          :aria-pressed="dayIndex === runtime.activeDayIndex.value"
          @click.stop="runtime.selectDay(dayIndex)"
          @keydown.enter.prevent="runtime.selectDay(dayIndex)"
          @keydown.space.prevent="runtime.selectDay(dayIndex)"
        >
          <span>{{ day.day }}</span>
          <small>{{ day.date }}</small>
          <img alt="" :src="day.icon" />
          <b>{{ day.text }}</b>
          <em>{{ day.wind }}</em>
          <strong>{{ day.high }}</strong>
        </article>
      </div>
    </section>

    <section class="weather-lower-grid">
      <div class="weather-life-card">
        <h3>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 13a8 8 0 0 1 16 0v7H4v-7zm4-1h8a4 4 0 0 0-8 0z" />
          </svg>
          生活指数
        </h3>
        <article v-for="item in weatherLifeIndexes" :key="item.name">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path :d="item.iconPath" />
          </svg>
          <span>{{ item.name }}</span>
          <b>{{ item.value }}</b>
          <small>{{ item.detail }}</small>
        </article>
      </div>
      <aside class="weather-location-list">
        <h3>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"
            />
          </svg>
          天气列表
        </h3>
        <div class="weather-location-search" @click.stop>
          <input
            v-model="runtime.searchText.list"
            role="combobox"
            aria-label="天气列表输入城市、乡镇"
            placeholder="输入城市、乡镇"
            @click.stop="runtime.pickerTarget.value = 'list'"
            @focus="runtime.pickerTarget.value = 'list'"
            @input="runtime.onCitySearchInput('list')"
          />
          <div
            v-if="runtime.pickerTarget.value === 'list'"
            class="weather-city-popover"
          >
            <button
              v-for="city in runtime.cityOptions.value"
              :key="`weather-list-${city.id}`"
              :class="{
                active: city.city === runtime.activeLocation.value.city,
              }"
              type="button"
              @click.stop="runtime.selectCity(city)"
            >
              <span>{{ city.province }} · {{ city.city }}</span>
              <b
                >{{ city.condition || "天气" }}
                {{ city.temp ? `${city.temp}°` : "" }}</b
              >
            </button>
          </div>
        </div>
        <button
          type="button"
          class="weather-location-card"
          :class="runtime.weatherOuterClass.value"
        >
          <span>我的位置 · {{ runtime.activeLocation.value.city }}</span>
          <img alt="" :src="runtime.sample.icon" />
          <b>{{ runtime.sample.condition }}</b>
          <strong>{{ runtime.sample.temp }}°</strong>
          <small>
            最高{{ formatWeatherDegree(runtime.sample.high) }} 最低{{
              formatWeatherDegree(runtime.sample.low)
            }}
          </small>
        </button>
      </aside>
    </section>
  </div>
</template>

<style scoped>
.opened-weather-panel {
  position: relative;
  height: 100%;
  padding: 30px 12px 20px 24px;
  overflow: hidden auto;
  background-color: var(
    --sd-theme-weather-weather-opened-panel-scene-base
  );
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  color: var(--sd-theme-weather-weather-opened-panel-text-01);
  scrollbar-width: none;
}

.opened-weather-panel > * {
  position: relative;
  z-index: 1;
}

.opened-weather-panel.weather-sunny_d,
.weather-location-card.weather-sunny_d {
  background-image: var(
    --sd-theme-weather-weather-opened-panel-scene-sunny-day
  );
}

.opened-weather-panel.weather-sunny_n,
.weather-location-card.weather-sunny_n {
  background-image: var(
    --sd-theme-weather-weather-opened-panel-scene-sunny-night
  );
}

.opened-weather-panel.weather-cloudy_d,
.weather-location-card.weather-cloudy_d {
  background-image: var(
    --sd-theme-weather-weather-opened-panel-scene-cloudy-day
  );
}

.opened-weather-panel.weather-cloudy_d::before,
.weather-location-card.weather-cloudy_d::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: url("/sd/weather/background/cloud.webp");
  background-repeat: no-repeat;
  background-position: right top;
  content: "";
  opacity: 0.6;
}

.opened-weather-panel.weather-cloudy_n,
.weather-location-card.weather-cloudy_n {
  background-image: var(
    --sd-theme-weather-weather-opened-panel-scene-cloudy-night
  );
}

.opened-weather-panel.weather-yin_d,
.weather-location-card.weather-yin_d {
  background-image: var(
    --sd-theme-weather-weather-opened-panel-scene-yin-day
  );
}

.opened-weather-panel.weather-yin_n,
.weather-location-card.weather-yin_n {
  background-image: var(
    --sd-theme-weather-weather-opened-panel-scene-yin-night
  );
}

.opened-weather-panel.weather-rain_d,
.opened-weather-panel.weather-rain_n,
.weather-location-card.weather-rain_d,
.weather-location-card.weather-rain_n {
  background-image: url("/sd/weather/background/rain_d.webp");
}

.opened-weather-panel.weather-snow_d,
.weather-location-card.weather-snow_d {
  background-image: url("/sd/weather/background/snow_d.webp");
}

.opened-weather-panel.weather-snow_n,
.weather-location-card.weather-snow_n {
  background-image: url("/sd/weather/background/snow_n.webp");
}

.opened-weather-panel.weather-thunder_d,
.weather-location-card.weather-thunder_d {
  background-image: url("/sd/weather/background/thunder_d.webp");
}

.opened-weather-panel.weather-thunder_n,
.weather-location-card.weather-thunder_n {
  background-image: url("/sd/weather/background/thunder_n.webp");
}

.opened-weather-panel.weather-foggy_d,
.weather-location-card.weather-foggy_d {
  background-image: var(
    --sd-theme-weather-weather-opened-panel-scene-foggy-day
  );
}

.opened-weather-panel.weather-foggy_n,
.weather-location-card.weather-foggy_n {
  background-image: var(
    --sd-theme-weather-weather-opened-panel-scene-foggy-night
  );
}

.opened-weather-panel.weather-haze_d,
.weather-location-card.weather-haze_d {
  background-image: var(
    --sd-theme-weather-weather-opened-panel-scene-haze-day
  );
}

.opened-weather-panel.weather-haze_n,
.weather-location-card.weather-haze_n {
  background-image: var(
    --sd-theme-weather-weather-opened-panel-scene-haze-night
  );
}

.opened-weather-panel.weather-other,
.weather-location-card.weather-other {
  background-image: var(--weather-other);
}

.opened-weather-panel::-webkit-scrollbar {
  display: none;
}

.opened-weather-header {
  display: flex;
  min-height: 24px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  color: var(--sd-theme-weather-weather-opened-panel-text-01);
  font-size: 12px;
  line-height: 18px;
}

.weather-header-tools {
  display: flex;
  flex: none;
  align-items: center;
  gap: 5px;
}

.weather-combobox,
.weather-location-search {
  position: relative;
  display: block;
}

.weather-combobox input,
.weather-location-search input {
  width: 130px;
  height: 24px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px 0 0 8px;
  outline: none;
  background: var(--sd-theme-weather-weather-opened-panel-surface-01);
  color: var(--sd-theme-weather-weather-opened-panel-text-01);
  font-size: 12px;
}

.weather-header-tools > button {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: var(--sd-theme-weather-weather-opened-panel-surface-01);
  color: var(--sd-theme-weather-weather-opened-panel-text-13);
}

.weather-header-tools > button:disabled {
  opacity: 0.5;
}

.weather-header-tools > button svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.weather-city-popover {
  position: absolute;
  top: calc(100% + 7px);
  right: 0;
  z-index: 9;
  display: grid;
  width: 238px;
  padding: 6px;
  border: 1px solid var(--sd-theme-weather-weather-opened-panel-border-02);
  border-radius: 6px;
  background: var(--sd-theme-weather-weather-opened-panel-surface-02);
  box-shadow: 0 10px 24px
    var(--sd-theme-weather-weather-opened-panel-shadow-01);
}

.weather-city-popover button {
  display: flex;
  height: 34px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--sd-theme-weather-weather-opened-panel-text-02);
  font-size: 12px;
  line-height: 16px;
}

.weather-city-popover button.active,
.weather-city-popover button:hover {
  background: var(--sd-theme-weather-weather-opened-panel-surface-03);
  color: var(--sd-theme-weather-weather-opened-panel-text-04);
}

.weather-city-popover button b {
  flex: none;
  font-weight: 400;
}

.weather-runtime-error {
  margin: 10px 0 0;
  color: var(--sd-theme-weather-weather-opened-panel-text-05);
  font-size: 12px;
}

.opened-weather-current {
  display: block;
  min-height: 147px;
  margin-top: 20px;
}

.opened-weather-temp {
  display: flex;
  height: 80px;
  align-items: center;
}

.opened-weather-temp strong {
  display: block;
  flex: none;
  font-size: 80px;
  font-weight: 300;
  letter-spacing: 0;
  line-height: 80px;
}

.opened-weather-temp span {
  display: grid;
  gap: 8px;
  margin: 0 0 0 20px;
  color: var(--sd-theme-weather-weather-opened-panel-text-01);
  font-size: 13px;
  line-height: 19.5px;
}

.opened-weather-temp b {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 400;
}

.opened-weather-temp svg,
.opened-weather-temp img {
  width: 18px;
  height: 18px;
  object-fit: contain;
  fill: currentColor;
}

.opened-weather-current p {
  max-width: none;
  margin: 20px 0 0;
  color: var(--sd-theme-weather-weather-opened-panel-text-01);
  font-size: 13px;
  line-height: 18px;
}

.opened-weather-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin: 10px 0 0;
  color: var(--sd-theme-weather-weather-opened-panel-text-01);
  font-size: 13px;
  line-height: 18px;
}

.opened-weather-metrics div {
  display: flex;
  gap: 4px;
}

.opened-weather-metrics dt,
.opened-weather-metrics dd {
  margin: 0;
}

.opened-weather-metrics dt {
  color: inherit;
  font-size: inherit;
}

.opened-weather-metrics dd {
  color: inherit;
  font-size: inherit;
}

.weather-hour-card,
.weather-day-card,
.weather-life-card,
.weather-location-list {
  overflow: hidden;
  border-radius: 6px;
  background: var(--sd-theme-weather-weather-opened-panel-surface-07);
}

.weather-hour-card {
  margin-top: 20px;
  height: 180px;
  padding: 12px 12px 10px;
  overflow: hidden;
}

.weather-hour-card h3,
.weather-day-card h3,
.weather-life-card h3,
.weather-location-list h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--sd-theme-weather-weather-opened-panel-text-07);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.weather-hour-card h3 svg,
.weather-day-card h3 svg,
.weather-life-card h3 svg,
.weather-location-list h3 svg {
  width: 17px;
  height: 17px;
  fill: currentColor;
}

.weather-hour-track {
  position: relative;
  display: grid;
  grid-template-columns: repeat(24, 50px);
  min-width: 1200px;
  margin-top: 8px;
  padding: 0 0 70px;
  gap: 0;
}

.weather-hour-track span {
  display: grid;
  border-radius: 6px;
  justify-items: center;
  gap: 6px;
  color: var(--sd-theme-weather-weather-opened-panel-text-03);
  font-size: 14px;
  line-height: 21px;
  transition: background 0.2s ease;
}

.weather-hour-track span:hover {
  background: var(--sd-theme-weather-weather-opened-panel-surface-08);
}

.weather-hour-track b,
.weather-hour-track em {
  font-weight: 400;
  font-style: normal;
}

.weather-hour-track img {
  width: 25px;
  height: 25px;
  object-fit: contain;
}

.weather-temp-line {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 70px;
  overflow: visible;
}

.weather-temp-line polyline {
  fill: none;
  stroke: var(--sd-theme-weather-weather-opened-panel-accent-01);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.weather-temp-line circle {
  fill: var(--sd-theme-weather-weather-opened-panel-accent-fill-01);
  stroke: var(--sd-theme-weather-weather-opened-panel-surface-05);
  stroke-width: 1;
}

.weather-day-card {
  height: 378px;
  margin-top: 20px;
  padding: 12px;
}

.weather-day-grid {
  display: flex;
  gap: 0;
  margin-top: 8px;
}

.weather-day-grid article {
  display: grid;
  width: calc(100% / 7);
  min-height: 328px;
  place-items: center;
  gap: 4px;
  padding: 10px 0;
  border-radius: 6px;
  color: var(--sd-theme-weather-weather-opened-panel-text-10);
  cursor: pointer;
  font-size: 13px;
  line-height: 32px;
  transition:
    background 0.2s ease,
    color 0.2s ease;
  user-select: none;
}

.weather-day-grid article.active {
  background: var(--sd-theme-weather-weather-opened-panel-surface-08);
  color: var(--sd-theme-weather-weather-opened-panel-text-04);
}

.weather-day-grid article:hover {
  background: var(--sd-theme-weather-weather-opened-panel-surface-09);
  color: var(--sd-theme-weather-weather-opened-panel-text-04);
}

.weather-day-grid article.active:hover {
  background: var(--sd-theme-weather-weather-opened-panel-surface-08);
  color: var(--sd-theme-weather-weather-opened-panel-text-04);
}

.weather-day-grid article:focus-visible {
  outline: 1px solid var(--sd-theme-weather-weather-opened-panel-border-03);
  outline-offset: -1px;
}

.weather-day-grid img {
  width: 27px;
  height: 27px;
  object-fit: contain;
}

.weather-day-grid b,
.weather-day-grid em,
.weather-day-grid strong {
  font-weight: 400;
  font-style: normal;
}

.weather-lower-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  gap: 16px;
  margin-top: 16px;
  padding-bottom: 14px;
}

.weather-life-card,
.weather-location-list {
  padding: 15px 18px;
}

.weather-life-card {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 16px;
}

.weather-life-card h3 {
  grid-column: 1 / -1;
}

.weather-life-card article {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 2px 9px;
  align-items: center;
  color: var(--sd-theme-weather-weather-opened-panel-text-11);
  font-size: 12px;
}

.weather-life-card article svg {
  grid-row: span 3;
  width: 22px;
  height: 22px;
  fill: var(--sd-theme-weather-weather-opened-panel-fill-01);
}

.weather-life-card article b {
  color: var(--sd-theme-weather-weather-opened-panel-text-12);
  font-size: 15px;
  font-weight: 400;
}

.weather-life-card article small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weather-location-list {
  display: grid;
  gap: 12px;
  align-content: start;
}

.weather-location-search input {
  width: 100%;
}

.weather-location-list > .weather-location-card {
  display: grid;
  position: relative;
  grid-template-columns: 1fr 28px 42px;
  gap: 5px 8px;
  align-items: center;
  padding: 10px 11px;
  border: 0;
  border-radius: 12px;
  overflow: hidden;
  background-color: var(
    --sd-theme-weather-weather-opened-panel-surface-10
  );
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  color: var(--sd-theme-weather-weather-opened-panel-text-14);
  text-align: left;
}

.weather-location-card > * {
  position: relative;
  z-index: 1;
}

.weather-location-list > .weather-location-card span,
.weather-location-list > .weather-location-card small {
  grid-column: 1 / 2;
  overflow: hidden;
  color: inherit;
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weather-location-list > .weather-location-card img {
  width: 25px;
  height: 25px;
  object-fit: contain;
}

.weather-location-list > .weather-location-card b,
.weather-location-list > .weather-location-card strong {
  color: inherit;
  font-weight: 400;
}

.weather-location-list > .weather-location-card strong {
  justify-self: end;
  font-size: 22px;
  line-height: 24px;
}

@media (max-width: 760px) {
  .opened-weather-panel {
    padding: 24px 16px 18px;
  }

  .opened-weather-header,
  .opened-weather-current,
  .weather-lower-grid {
    grid-template-columns: 1fr;
  }

  .opened-weather-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .opened-weather-current {
    gap: 16px;
  }

  .weather-day-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .weather-life-card {
    grid-template-columns: 1fr;
  }
}
</style>
