<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";
import { useSdCalendarRuntime } from "./useSdCalendarRuntime";
import type { SdCalendarWidgetData } from "./sdCalendarTypes";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: SdWidgetSizeKey;
  refreshToken?: number;
}>();

const emit = defineEmits<{
  updateData: [data: SdCalendarWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useSdCalendarRuntime(widgetRef, (data) =>
  emit("updateData", data),
);
const lastRefreshToken = ref(props.refreshToken ?? 0);
const normalizedSize = computed(() => props.sizeKey.replace("x", "-"));
const today = computed(() => runtime.snapshot.value.today);
const detail = computed(() => runtime.snapshot.value.todayDetail);
const visibleGrid = computed(() => runtime.snapshot.value.grid);

watch(
  () => props.refreshToken,
  (value) => {
    const token = value ?? 0;
    if (token === lastRefreshToken.value) return;
    lastRefreshToken.value = token;
    runtime.updateNow();
  },
);
</script>

<template>
  <span
    class="sd-calendar-widget"
    :class="`size-${normalizedSize}`"
    data-sd-calendar-widget
    :data-sd-calendar-size="sizeKey"
    :data-sd-calendar-date="today.key"
  >
    <span class="calendar-card">
      <template v-if="sizeKey === '1x1'">
        <span class="single-day-card">
          <span class="weekday accent">{{ today.weekName }}</span>
          <span class="day compact">{{ today.dayLabel }}</span>
        </span>
      </template>

      <template v-else-if="sizeKey === '1x2'">
        <span class="wide-strip">
          <span class="strip-date">{{ detail.shortDateText }}</span>
          <span class="strip-week accent">{{ detail.weekdayText }}</span>
        </span>
      </template>

      <template v-else-if="sizeKey === '2x1'">
        <span class="vertical-card">
          <span class="vertical-month">{{ today.year }}/{{ today.month }}</span>
          <span class="vertical-day">{{ today.dayLabel }}</span>
          <span class="vertical-week accent">{{ today.weekName }}</span>
        </span>
      </template>

      <template v-else-if="sizeKey === '2x4'">
        <span class="large-horizontal">
          <span class="large-summary">
            <span class="summary-month">{{
              runtime.snapshot.value.monthTitle
            }}</span>
            <span class="summary-day">{{ today.dayLabel }}</span>
            <span class="summary-meta"
              >第{{ detail.dayOfYear }}天 第{{ detail.weekOfYear }}周</span
            >
            <span class="summary-lunar"
              >{{ detail.lunarText }} {{ today.weekName }}</span
            >
          </span>
          <span class="mini-month-grid" aria-hidden="true">
            <span
              v-for="week in ['一', '二', '三', '四', '五', '六', '日']"
              :key="week"
              class="mini-week"
              :class="{ weekend: week === '六' || week === '日' }"
            >
              {{ week }}
            </span>
            <span
              v-for="day in visibleGrid"
              :key="day.key"
              class="mini-day"
              :class="{
                today: day.isToday,
                muted: !day.isCurrentMonth,
                weekend: day.isWeekend,
              }"
            >
              {{ day.dayLabel }}
            </span>
          </span>
        </span>
      </template>

      <template v-else>
        <span class="month-card">
          <span class="month-head">{{
            runtime.snapshot.value.monthTitle
          }}</span>
          <span class="month-body">
            <span class="month-day">{{ today.dayLabel }}</span>
            <span class="month-meta"
              >第{{ detail.dayOfYear }}天 第{{ detail.weekOfYear }}周</span
            >
            <span class="month-lunar"
              >{{ detail.lunarText }} {{ today.weekName }}</span
            >
          </span>
        </span>
      </template>
    </span>
  </span>
</template>

<style scoped>
.sd-calendar-widget,
.calendar-card {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.calendar-card {
  overflow: hidden;
  background: var(--sd-theme-calendar-calendar-widget-surface-01);
  color: var(--sd-theme-calendar-calendar-widget-text-01);
  font-family:
    HarmonyOS_Sans,
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.single-day-card,
.wide-strip,
.vertical-card,
.month-card,
.large-horizontal {
  display: flex;
  width: 100%;
  height: 100%;
}

.accent {
  color: var(--sd-theme-calendar-calendar-widget-accent-text-01);
}

.single-day-card {
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 2px;
  font-weight: 700;
  text-align: center;
}

.weekday {
  font-size: 12px;
  line-height: 18px;
}

.day.compact {
  font-size: 18px;
  line-height: 24px;
}

.wide-strip {
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 20px;
  white-space: nowrap;
}

.strip-date {
  font-size: 18px;
  line-height: 27px;
}

.strip-week {
  font-size: 16px;
  line-height: 24px;
}

.vertical-card {
  align-items: center;
  justify-content: space-between;
  flex-direction: column;
  padding: 20px 0;
  text-align: center;
}

.vertical-month {
  font-size: 12px;
  line-height: 18px;
}

.vertical-day {
  font-size: 36px;
  font-weight: 700;
  line-height: 54px;
}

.vertical-week {
  font-size: 14px;
  font-weight: 700;
  line-height: 21px;
}

.month-card {
  flex-direction: column;
  text-align: center;
}

.month-head {
  display: flex;
  height: 38px;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    90deg,
    var(--sd-theme-calendar-calendar-widget-accent-surface-01),
    var(--sd-theme-calendar-calendar-widget-accent-surface-02)
  );
  color: var(--sd-theme-calendar-calendar-widget-text-02);
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.month-body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px 8px 8px;
}

.month-day {
  color: var(--sd-theme-calendar-calendar-widget-text-03);
  font-size: 58px;
  font-weight: 500;
  line-height: 64px;
}

.month-meta,
.month-lunar,
.summary-meta,
.summary-lunar {
  overflow: hidden;
  max-width: 100%;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.month-meta,
.summary-meta {
  color: var(--sd-theme-calendar-calendar-widget-text-04);
}

.month-lunar,
.summary-lunar {
  color: var(--sd-theme-calendar-calendar-widget-text-05);
}

.large-horizontal {
  position: relative;
  align-items: stretch;
}

.large-summary {
  display: flex;
  width: 40%;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: 13px 0 13px 28px;
}

.summary-month {
  margin-bottom: 4px;
  font-size: 16px;
  line-height: 24px;
}

.summary-day {
  color: var(--sd-theme-calendar-calendar-widget-text-06);
  font-size: 58px;
  font-weight: 500;
  line-height: 62px;
}

.mini-month-grid {
  display: grid;
  width: 60%;
  min-width: 0;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: 22px repeat(6, 1fr);
  align-items: center;
  padding: 8px 13px 7px 3px;
  text-align: center;
}

.mini-week,
.mini-day {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  color: var(--sd-theme-calendar-calendar-widget-text-01);
  font-size: 11.5px;
  line-height: 16px;
}

.mini-week.weekend,
.mini-day.weekend {
  color: var(--sd-theme-calendar-calendar-widget-accent-text-02);
}

.mini-day.muted {
  color: var(--sd-theme-calendar-calendar-widget-text-07);
}

.mini-day.today {
  width: 20px;
  height: 20px;
  justify-self: center;
  border-radius: 999px;
  background: var(--sd-theme-calendar-calendar-widget-accent-surface-03);
  color: var(--sd-theme-calendar-calendar-widget-text-02);
}
</style>
