<script setup lang="ts">
import { computed, onMounted } from "vue";
import type { WidgetConfig } from "@/types";
import {
  formatWeatherDegree,
  useItabWeatherRuntime,
  weatherLifeIndexes,
} from "./useItabWeatherRuntime";
import type { ItabWeatherWidgetData } from "./itabWeatherTypes";

const props = defineProps<{
  widget: WidgetConfig;
}>();

const emit = defineEmits<{
  updateData: [data: ItabWeatherWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useItabWeatherRuntime(widgetRef, (data) =>
  emit("updateData", data),
);

onMounted(() => {
  runtime.ensureLoaded();
});
</script>

<template>
  <div class="opened-weather-panel" data-grid-drag-ignore="true">
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
        <button type="button">
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
  height: 100%;
  padding: 30px 24px 24px;
  overflow: hidden auto;
  scrollbar-width: none;
}

.opened-weather-panel::-webkit-scrollbar {
  display: none;
}

.opened-weather-header {
  display: flex;
  min-height: 30px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 14px;
  line-height: 20px;
}

.weather-header-tools {
  display: flex;
  flex: none;
  align-items: center;
  gap: 10px;
}

.weather-combobox,
.weather-location-search {
  position: relative;
  display: block;
}

.weather-combobox input,
.weather-location-search input {
  width: 200px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  outline: none;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.78);
  font-size: 14px;
}

.weather-header-tools > button {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.74);
}

.weather-header-tools > button:disabled {
  opacity: 0.5;
}

.weather-header-tools > button svg {
  width: 17px;
  height: 17px;
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
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(37, 39, 43, 0.96);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
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
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  line-height: 16px;
}

.weather-city-popover button.active,
.weather-city-popover button:hover {
  background: rgba(255, 255, 255, 0.09);
  color: #fff;
}

.weather-city-popover button b {
  flex: none;
  font-weight: 400;
}

.weather-runtime-error {
  margin: 10px 0 0;
  color: rgba(255, 204, 204, 0.88);
  font-size: 12px;
}

.opened-weather-current {
  display: grid;
  grid-template-columns: 250px minmax(220px, 1fr) 368px;
  gap: 26px;
  align-items: end;
  min-height: 118px;
  margin-top: 28px;
}

.opened-weather-temp strong {
  display: block;
  font-size: 78px;
  font-weight: 300;
  letter-spacing: 0;
  line-height: 82px;
}

.opened-weather-temp span {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 14px;
  line-height: 20px;
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
  max-width: 295px;
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 13px;
  line-height: 23px;
}

.opened-weather-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 18px;
  margin: 0;
}

.opened-weather-metrics div {
  display: grid;
  gap: 3px;
}

.opened-weather-metrics dt,
.opened-weather-metrics dd {
  margin: 0;
}

.opened-weather-metrics dt {
  color: rgba(255, 255, 255, 0.48);
  font-size: 12px;
}

.opened-weather-metrics dd {
  color: rgba(255, 255, 255, 0.88);
  font-size: 16px;
}

.weather-hour-card,
.weather-day-card,
.weather-life-card,
.weather-location-list {
  overflow: hidden;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
}

.weather-hour-card {
  margin-top: 20px;
  padding: 16px 18px 12px;
  overflow-x: auto;
}

.weather-hour-card h3,
.weather-day-card h3,
.weather-life-card h3,
.weather-location-list h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 15px;
  font-weight: 400;
  line-height: 22px;
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
  grid-template-columns: repeat(24, 38px);
  min-width: 912px;
  margin-top: 14px;
  padding: 0 0 52px;
  gap: 0;
}

.weather-hour-track span {
  display: grid;
  justify-items: center;
  gap: 7px;
  color: rgba(255, 255, 255, 0.74);
  font-size: 12px;
  line-height: 16px;
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
  right: 8px;
  bottom: 0;
  left: 8px;
  height: 54px;
  overflow: visible;
}

.weather-temp-line polyline {
  fill: none;
  stroke: rgba(160, 201, 255, 0.88);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.weather-temp-line circle {
  fill: rgb(160, 201, 255);
  stroke: rgba(255, 255, 255, 0.85);
  stroke-width: 1;
}

.weather-day-card {
  margin-top: 16px;
  padding: 15px 18px 18px;
}

.weather-day-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0;
  margin-top: 13px;
}

.weather-day-grid article {
  display: grid;
  min-height: 112px;
  place-items: center;
  gap: 4px;
  padding: 9px 4px;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  font-size: 12px;
  line-height: 16px;
  transition:
    background 0.2s ease,
    color 0.2s ease;
  user-select: none;
}

.weather-day-grid article:hover,
.weather-day-grid article.active {
  background: rgba(255, 255, 255, 0.09);
  color: #fff;
}

.weather-day-grid article:focus-visible {
  outline: 1px solid rgba(255, 255, 255, 0.5);
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
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
}

.weather-life-card article svg {
  grid-row: span 3;
  width: 22px;
  height: 22px;
  fill: rgba(255, 255, 255, 0.74);
}

.weather-life-card article b {
  color: rgba(255, 255, 255, 0.92);
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

.weather-location-list > button {
  display: grid;
  grid-template-columns: 1fr 28px 42px;
  gap: 5px 8px;
  align-items: center;
  padding: 10px 11px;
  border: 0;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  text-align: left;
}

.weather-location-list > button span,
.weather-location-list > button small {
  grid-column: 1 / 2;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.74);
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weather-location-list > button img {
  width: 25px;
  height: 25px;
  object-fit: contain;
}

.weather-location-list > button b,
.weather-location-list > button strong {
  font-weight: 400;
}

.weather-location-list > button strong {
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
