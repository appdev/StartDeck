<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";
import {
  useItabWeatherRuntime,
  formatWeatherDegree,
} from "./useItabWeatherRuntime";
import type { ItabWeatherWidgetData } from "./itabWeatherTypes";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: ItabWidgetSizeKey;
  refreshToken?: number;
}>();

const emit = defineEmits<{
  updateData: [data: ItabWeatherWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useItabWeatherRuntime(widgetRef, (data) =>
  emit("updateData", data),
);
const lastRefreshToken = ref(props.refreshToken ?? 0);

onMounted(() => {
  runtime.ensureLoaded();
});

watch(
  () => props.refreshToken,
  (value) => {
    const token = value ?? 0;
    if (token === lastRefreshToken.value) return;
    lastRefreshToken.value = token;
    void runtime.loadCurrent(runtime.activeLocation.value, true);
  },
);
</script>

<template>
  <span
    class="itab-weather-widget"
    data-itab-weather-widget
    :data-itab-weather-size="sizeKey"
    :data-itab-weather-source-status="runtime.sourceStatus.value"
  >
    <span
      class="weather-icon-content"
      :class="[
        `is-weather-size-${sizeKey.replace('x', '-')}`,
        runtime.weatherOuterClass.value,
      ]"
    >
      <template v-if="sizeKey === '1x1'">
        <span class="weather-compact-main">
          <i>{{ runtime.activeLocation.value.city }}</i>
          <strong>{{ runtime.sample.temp }}°</strong>
        </span>
      </template>
      <template v-else-if="sizeKey === '1x2'">
        <span class="weather-strip-main">
          <span>
            <i>{{ runtime.activeLocation.value.city }}</i>
            <strong>{{ runtime.sample.temp }}°</strong>
          </span>
          <span class="weather-strip-condition">
            <b>{{ runtime.sample.condition }}</b>
            <img alt="" :src="runtime.sample.icon" />
            <small>
              {{ formatWeatherDegree(runtime.sample.low) }} ~
              {{ formatWeatherDegree(runtime.sample.high) }}
            </small>
          </span>
        </span>
      </template>
      <template v-else-if="sizeKey === '2x1'">
        <span class="weather-column-main">
          <span>
            <i>{{ runtime.activeLocation.value.city }}</i>
            <strong>{{ runtime.sample.temp }}°</strong>
          </span>
          <span class="weather-column-condition">
            <img alt="" :src="runtime.sample.icon" />
            <b>{{ runtime.sample.condition }}</b>
          </span>
        </span>
      </template>
      <template v-else-if="sizeKey === '2x4'">
        <span class="weather-wide-main">
          <span class="weather-wide-top">
            <span>
              <span class="weather-location-line">
                <i>{{ runtime.activeLocation.value.city }}</i>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 2C8.7 2 6 4.7 6 8c0 4.2 6 14 6 14s6-9.8 6-14c0-3.3-2.7-6-6-6zm0 8.4A2.4 2.4 0 1 1 12 5.6a2.4 2.4 0 0 1 0 4.8z"
                  />
                </svg>
              </span>
              <strong>{{ runtime.sample.temp }}°</strong>
            </span>
            <span class="weather-wide-condition">
              <span class="weather-wide-condition-current">
                {{ runtime.sample.condition }}
                <img alt="" :src="runtime.sample.icon" />
              </span>
              <small>
                最低 {{ formatWeatherDegree(runtime.sample.low) }} 最高
                {{ formatWeatherDegree(runtime.sample.high) }}
              </small>
            </span>
          </span>
          <span class="weather-wide-days">
            <b
              v-for="day in runtime.weatherOuterDaily.value"
              :key="`outer-weather-${day.date}`"
            >
              <i>{{ day.label }}</i>
              <img alt="" :src="day.icon" />
              <small>{{ day.range }}</small>
            </b>
          </span>
        </span>
      </template>
      <template v-else>
        <span class="weather-card-main">
          <span class="weather-top">
            <span>
              <span class="weather-location-line">
                <i>{{ runtime.activeLocation.value.city }}</i>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 2C8.7 2 6 4.7 6 8c0 4.2 6 14 6 14s6-9.8 6-14c0-3.3-2.7-6-6-6zm0 8.4A2.4 2.4 0 1 1 12 5.6a2.4 2.4 0 0 1 0 4.8z"
                  />
                </svg>
              </span>
              <strong>{{ runtime.sample.temp }}°</strong>
            </span>
            <span class="weather-card-condition">
              <img alt="" :src="runtime.sample.icon" />
              <b>{{ runtime.sample.condition }}</b>
            </span>
          </span>
          <span class="weather-card-stats">
            <span>AQI {{ runtime.sample.airQuality }}</span>
            <small>
              最高{{ formatWeatherDegree(runtime.sample.high) }} 最低{{
                formatWeatherDegree(runtime.sample.low)
              }}
            </small>
          </span>
        </span>
      </template>
    </span>
  </span>
</template>

<style scoped>
.itab-weather-widget,
.weather-icon-content {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.weather-icon-content {
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  background-color: #154280;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  color: var(--sd-theme-itab-weather-weather-widget-text-01);
}

.weather-icon-content::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.weather-icon-content > span {
  position: relative;
  z-index: 1;
}

.weather-icon-content.weather-sunny_d {
  background-image: linear-gradient(35deg, #154280 30%, #335693, #a8b3d2);
}

.weather-icon-content.weather-sunny_n {
  background-image: linear-gradient(45deg, #000012 20%, #29334e);
}

.weather-icon-content.weather-cloudy_d {
  background-image: linear-gradient(35deg, #054989 30%, #72ade0);
}

.weather-icon-content.weather-cloudy_d::before {
  background-image: url("/itab/weather/background/cloud.webp");
  background-repeat: no-repeat;
  background-position: right top;
  background-size: 120px auto;
  content: "";
  opacity: 0.6;
}

.weather-icon-content.weather-cloudy_n {
  background-image: linear-gradient(35deg, #191a2e 30%, #4c5f7f);
}

.weather-icon-content.weather-yin_d {
  background-image: linear-gradient(35deg, #354564 30%, #4c5f7f, #8b9bb8);
}

.weather-icon-content.weather-yin_n {
  background-image: linear-gradient(45deg, #211e22 20%, #383a3e);
}

.weather-icon-content.weather-rain_d,
.weather-icon-content.weather-rain_n {
  background-image: url("/itab/weather/background/rain_d.webp");
}

.weather-icon-content.weather-snow_d {
  background-image: url("/itab/weather/background/snow_d.webp");
}

.weather-icon-content.weather-snow_n {
  background-image: url("/itab/weather/background/snow_n.webp");
}

.weather-icon-content.weather-thunder_d {
  background-image: url("/itab/weather/background/thunder_d.webp");
}

.weather-icon-content.weather-thunder_n {
  background-image: url("/itab/weather/background/thunder_n.webp");
}

.weather-icon-content.weather-foggy_d {
  background-image: linear-gradient(45deg, #789fb8 20%, #6386a3);
}

.weather-icon-content.weather-foggy_n {
  background-image: linear-gradient(45deg, #6c7682 20%, #535d69);
}

.weather-icon-content.weather-haze_d {
  background-image: linear-gradient(45deg, #8d8882 20%, #bbb7af);
}

.weather-icon-content.weather-haze_n {
  background-image: linear-gradient(45deg, #1b1712 20%, #5b4c49);
}

.weather-icon-content.weather-other {
  background-image: var(--weather-other);
}

.weather-compact-main,
.weather-strip-main,
.weather-column-main,
.weather-card-main,
.weather-wide-main {
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  color: var(--sd-theme-itab-weather-weather-widget-text-01);
}

.weather-compact-main {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.weather-compact-main i,
.weather-strip-main i,
.weather-column-main i,
.weather-wide-main i,
.weather-card-main i {
  font-style: normal;
}

.weather-compact-main i,
.weather-strip-main i,
.weather-column-main i {
  display: block;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weather-compact-main strong {
  margin-top: 5px;
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.weather-strip-main {
  align-items: center;
  justify-content: space-between;
  padding: 0 6px;
}

.weather-strip-main > span:first-child,
.weather-column-main > span:first-child {
  min-width: 0;
}

.weather-strip-main strong,
.weather-column-main strong {
  display: block;
  margin-top: 5px;
  font-size: 22px;
  font-weight: 400;
  line-height: 33px;
}

.weather-strip-condition,
.weather-column-condition,
.weather-wide-condition {
  font-size: 12px;
  line-height: 17px;
}

.weather-strip-condition {
  width: 52px;
  text-align: left;
  white-space: nowrap;
}

.weather-strip-condition b,
.weather-column-condition b,
.weather-wide-condition b {
  display: block;
  font-weight: 400;
}

.weather-strip-condition img,
.weather-column-condition img {
  display: block;
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.weather-strip-condition small,
.weather-wide-condition small {
  display: block;
  color: var(--sd-theme-itab-weather-weather-widget-text-01);
  font-size: 12px;
  line-height: 17px;
}

.weather-column-main {
  flex-direction: column;
  justify-content: space-between;
  padding: 14px 6px;
  text-align: center;
}

.weather-column-condition {
  display: block;
  text-align: center;
}

.weather-card-main {
  flex-direction: column;
  justify-content: space-between;
  padding: 12px;
  font-size: 20px;
  line-height: 30px;
}

.weather-top {
  display: flex;
  width: 100%;
  min-height: 62px;
  align-items: flex-start;
  justify-content: space-between;
  color: var(--sd-theme-itab-weather-weather-widget-text-01);
  font-size: 20px;
  line-height: 30px;
}

.weather-top > span {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.weather-top > span:first-child {
  height: 62px;
}

.weather-top svg,
.weather-location-line svg {
  flex: none;
  width: 12px;
  height: 12px;
  margin-left: 2px;
  fill: currentColor;
}

.weather-location-line {
  display: flex;
  align-items: center;
  font-size: 12px;
  line-height: 18px;
}

.weather-location-line i {
  display: inline;
  overflow: visible;
  font-size: inherit;
  line-height: inherit;
  text-overflow: clip;
}

.weather-top img {
  width: 25px;
  height: 25px;
  object-fit: contain;
}

.weather-top b {
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-align: center;
}

.weather-card-condition {
  width: 25px;
  align-items: center;
  padding-top: 10px;
}

.weather-card-main strong {
  display: block;
  margin-top: 5px;
  font-size: 26px;
  font-weight: 700;
  line-height: 39px;
}

.weather-card-stats,
.weather-card-stats small {
  display: block;
  color: var(--sd-theme-itab-weather-weather-widget-text-01);
  font-size: 12px;
  line-height: 18px;
}

.weather-card-stats > span {
  display: block;
  margin-bottom: 2px;
}

.weather-card-stats small {
  margin: 0;
}

.weather-wide-main {
  flex-direction: column;
  justify-content: flex-start;
  padding: 12px 12px 13px;
}

.weather-wide-top {
  display: flex;
  width: 100%;
  align-items: flex-start;
  justify-content: space-between;
}

.weather-wide-days i {
  display: block;
  font-size: 12px;
  line-height: 18px;
}

.weather-wide-main .weather-location-line {
  font-size: 12px;
  line-height: 18px;
}

.weather-wide-main .weather-location-line svg {
  width: 12px;
  height: 12px;
}

.weather-wide-main strong {
  display: block;
  margin-top: 5px;
  font-size: 29.4px;
  font-weight: 700;
  line-height: 44px;
}

.weather-wide-condition {
  width: 98px;
  padding-top: 15px;
  text-align: right;
}

.weather-wide-condition-current {
  display: flex;
  height: 22px;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 4px;
  font-size: 12px;
  line-height: 13.2px;
}

.weather-wide-condition-current img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.weather-wide-condition small {
  margin-top: 3px;
  line-height: 13.2px;
}

.weather-wide-days {
  display: flex;
  width: 100%;
  margin-top: 9px;
  justify-content: space-between;
  font-size: 12px;
  line-height: 17px;
}

.weather-wide-days b {
  display: block;
  width: 34px;
  font-weight: 400;
  text-align: center;
}

.weather-wide-days img {
  width: 16px;
  height: 16px;
  margin: 0 0 0 5px;
  object-fit: contain;
}

.weather-wide-days small {
  color: var(--sd-theme-itab-weather-weather-widget-text-01);
  font-size: 12px;
  line-height: 17px;
}
</style>
