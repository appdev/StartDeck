<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ArrowRightLeft,
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Gift,
  RotateCcw,
} from "@lucide/vue";
import type { WidgetConfig } from "@/types";
import {
  buildSdCalendarDetail,
  buildSdCalendarDay,
  buildSdCalendarMonthGrid,
  solarDayFromDate,
  solarDayFromKey,
  useSdCalendarRuntime,
  type SdCalendarWeekStart,
} from "./useSdCalendarRuntime";
import type {
  SdCalendarDay,
  SdCalendarWidgetData,
} from "./sdCalendarTypes";

type CalendarFestivalEvent = {
  key: string;
  monthDay: string;
  title: string;
  meta: string;
  type: "rest" | "work" | "festival" | "term";
};

const props = defineProps<{
  widget: WidgetConfig;
}>();

const emit = defineEmits<{
  updateData: [data: SdCalendarWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useSdCalendarRuntime(widgetRef, (data) =>
  emit("updateData", data),
);
const pad2 = (value: number) => String(value).padStart(2, "0");
const formatDateKey = (year: number, month: number, day: number) =>
  `${year}-${pad2(month)}-${pad2(day)}`;
const dateInputToLocalTime = (key: string) => {
  const [year, month, day] = key.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day).getTime();
};
const normalizeDateKey = (key: string, fallback: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : fallback;
const today = computed(() => runtime.snapshot.value.today);
const selectedKey = ref(today.value.key);
const viewYear = ref(today.value.year);
const viewMonth = ref(today.value.month);
const activeTab = ref<"calendar" | "tools">("calendar");
const weekStart = ref<SdCalendarWeekStart>("monday");
const activePicker = ref<"year" | "month" | null>(null);
const dateDiffStart = ref(today.value.key);
const dateDiffEnd = ref(today.value.key);
const workdayStart = ref(today.value.key);
const workdayAmount = ref(5);
const workdayDirection = ref<"forward" | "backward">("forward");
const weekdayLabels = computed(() =>
  weekStart.value === "sunday"
    ? ["日", "一", "二", "三", "四", "五", "六"]
    : ["一", "二", "三", "四", "五", "六", "日"],
);
const weekStartLabel = computed(() =>
  weekStart.value === "sunday" ? "日" : "一",
);
const isTodayActionVisible = computed(
  () =>
    selectedKey.value !== today.value.key ||
    viewYear.value !== today.value.year ||
    viewMonth.value !== today.value.month,
);
const yearOptions = computed(() => {
  const startYear = Math.floor(viewYear.value / 10) * 10 - 1;
  return Array.from({ length: 12 }, (_, index) => startYear + index);
});
const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);
const viewGrid = computed(() =>
  buildSdCalendarMonthGrid(
    viewYear.value,
    viewMonth.value,
    new Date(),
    weekStart.value,
  ),
);
const selectedDetail = computed(() =>
  buildSdCalendarDetail(solarDayFromKey(selectedKey.value)),
);
const dateDiffResult = computed(() => {
  const start = normalizeDateKey(dateDiffStart.value, today.value.key);
  const end = normalizeDateKey(dateDiffEnd.value, today.value.key);
  const rawDays = Math.round(
    (dateInputToLocalTime(end) - dateInputToLocalTime(start)) / 86_400_000,
  );
  return {
    days: Math.abs(rawDays),
    inclusiveDays: Math.abs(rawDays) + 1,
    directionText: rawDays >= 0 ? "之后" : "之前",
  };
});

const isWorkingDay = (dateKey: string) => {
  const solarDay = solarDayFromKey(dateKey);
  const legalHoliday = solarDay.getLegalHoliday();
  if (legalHoliday) return legalHoliday.isWork();
  const weekIndex = solarDay.getWeek().getIndex();
  return weekIndex !== 0 && weekIndex !== 6;
};

const addWorkdays = (
  startKey: string,
  amount: number,
  direction: "forward" | "backward",
) => {
  const normalizedAmount = Math.max(0, Math.floor(Number(amount) || 0));
  const step = direction === "forward" ? 1 : -1;
  let remaining = normalizedAmount;
  let cursor = solarDayFromKey(startKey);
  while (remaining > 0) {
    cursor = cursor.next(step);
    const cursorKey = formatDateKey(
      cursor.getYear(),
      cursor.getMonth(),
      cursor.getDay(),
    );
    if (isWorkingDay(cursorKey)) remaining -= 1;
  }
  return cursor;
};

const workdayResult = computed(() => {
  const start = normalizeDateKey(workdayStart.value, today.value.key);
  const amount = Math.max(0, Math.floor(Number(workdayAmount.value) || 0));
  const resultDay = addWorkdays(start, amount, workdayDirection.value);
  return buildSdCalendarDetail(resultDay);
});

const festivalEvents = computed(() => {
  const events: CalendarFestivalEvent[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const daysInMonth = new Date(viewYear.value, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const solarDay = solarDayFromKey(
        formatDateKey(viewYear.value, month, day),
      );
      const calendarDay = buildSdCalendarDay(
        solarDay,
        today.value.key,
        month,
      );
      const title =
        calendarDay.festivalName ||
        calendarDay.solarTermName ||
        calendarDay.legalHolidayName;
      if (!title) continue;
      events.push({
        key: calendarDay.key,
        monthDay: `${pad2(month)}-${pad2(day)}`,
        title,
        meta: `${calendarDay.weekName} · ${calendarDay.lunarDayName}`,
        type:
          calendarDay.legalHolidayType ||
          (calendarDay.solarTermName ? "term" : "festival"),
      });
    }
  }
  return events;
});

const selectDay = (day: SdCalendarDay) => {
  activePicker.value = null;
  selectedKey.value = day.key;
};

const changeMonth = (offset: number) => {
  activePicker.value = null;
  const next = new Date(viewYear.value, viewMonth.value - 1 + offset, 1);
  viewYear.value = next.getFullYear();
  viewMonth.value = next.getMonth() + 1;
  selectedKey.value = formatDateKey(viewYear.value, viewMonth.value, 1);
};

const goToday = () => {
  activePicker.value = null;
  runtime.updateNow();
  const solarToday = solarDayFromDate(new Date());
  selectedKey.value = formatDateKey(
    solarToday.getYear(),
    solarToday.getMonth(),
    solarToday.getDay(),
  );
  viewYear.value = solarToday.getYear();
  viewMonth.value = solarToday.getMonth();
};

const toggleWeekStart = () => {
  activePicker.value = null;
  weekStart.value = weekStart.value === "monday" ? "sunday" : "monday";
};

const togglePicker = (picker: "year" | "month") => {
  activePicker.value = activePicker.value === picker ? null : picker;
};

const selectViewYear = (year: number) => {
  viewYear.value = year;
  selectedKey.value = formatDateKey(year, viewMonth.value, 1);
  activePicker.value = null;
};

const selectViewMonth = (month: number) => {
  viewMonth.value = month;
  selectedKey.value = formatDateKey(viewYear.value, month, 1);
  activePicker.value = null;
};

const swapDateRange = () => {
  const start = dateDiffStart.value;
  dateDiffStart.value = dateDiffEnd.value;
  dateDiffEnd.value = start;
};

const selectFestivalEvent = (event: CalendarFestivalEvent) => {
  selectedKey.value = event.key;
  const detail = buildSdCalendarDetail(solarDayFromKey(event.key));
  viewYear.value = detail.year;
  viewMonth.value = detail.month;
};
</script>

<template>
  <section
    class="sd-calendar-opened-panel"
    data-sd-calendar-opened-panel
    :data-sd-calendar-selected-date="selectedDetail.key"
    :data-sd-calendar-view-month="`${viewYear}-${String(viewMonth).padStart(2, '0')}`"
  >
    <div class="calendar-main-pane">
      <header class="calendar-toolbar">
        <div class="calendar-picker-group">
          <span class="calendar-picker-shell">
            <button
              class="calendar-picker"
              type="button"
              aria-label="选择年份"
              aria-haspopup="listbox"
              :aria-expanded="activePicker === 'year'"
              @click="togglePicker('year')"
            >
              <CalendarDays :size="12" stroke-width="2" />
              <span>{{ viewYear }}</span>
            </button>
            <span
              v-if="activePicker === 'year'"
              class="calendar-picker-popover year-picker"
              role="listbox"
              aria-label="年份"
            >
              <button
                v-for="year in yearOptions"
                :key="year"
                type="button"
                role="option"
                :aria-selected="year === viewYear"
                @click="selectViewYear(year)"
              >
                {{ year }}
              </button>
            </span>
          </span>
          <span class="calendar-picker-shell">
            <button
              class="calendar-picker"
              type="button"
              aria-label="选择月份"
              aria-haspopup="listbox"
              :aria-expanded="activePicker === 'month'"
              @click="togglePicker('month')"
            >
              <CalendarDays :size="12" stroke-width="2" />
              <span>{{ String(viewMonth).padStart(2, "0") }}</span>
            </button>
            <span
              v-if="activePicker === 'month'"
              class="calendar-picker-popover month-picker"
              role="listbox"
              aria-label="月份"
            >
              <button
                v-for="month in monthOptions"
                :key="month"
                type="button"
                role="option"
                :aria-selected="month === viewMonth"
                @click="selectViewMonth(month)"
              >
                {{ String(month).padStart(2, "0") }}
              </button>
            </span>
          </span>
          <button
            class="square-action"
            type="button"
            aria-label="上个月"
            @click="changeMonth(-1)"
          >
            <ChevronLeft :size="16" stroke-width="2.4" />
          </button>
          <button
            class="square-action"
            type="button"
            aria-label="下个月"
            @click="changeMonth(1)"
          >
            <ChevronRight :size="16" stroke-width="2.4" />
          </button>
          <button
            class="today-action"
            :class="{ active: isTodayActionVisible }"
            type="button"
            title="今天"
            :tabindex="isTodayActionVisible ? 0 : -1"
            :aria-hidden="!isTodayActionVisible"
            @click="goToday"
          >
            今
          </button>
        </div>

        <div
          class="calendar-tabs"
          :data-active-tab="activeTab"
          role="tablist"
          aria-label="日历面板"
        >
          <button
            :class="{ active: activeTab === 'calendar' }"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'calendar'"
            @click="activeTab = 'calendar'"
          >
            日历
          </button>
          <button
            :class="{ active: activeTab === 'tools' }"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'tools'"
            @click="activeTab = 'tools'"
          >
            工具
          </button>
        </div>

        <button
          class="calendar-switch"
          type="button"
          title="一周开始日"
          role="switch"
          :aria-checked="weekStart === 'monday'"
          @click="toggleWeekStart"
        >
          <span>{{ weekStartLabel }}</span>
        </button>
      </header>

      <div v-if="activeTab === 'calendar'" class="calendar-month-board">
        <span class="month-watermark">{{ viewMonth }}</span>
        <div class="weekday-row">
          <span
            v-for="week in weekdayLabels"
            :key="week"
            :class="{ weekend: week === '六' || week === '日' }"
          >
            {{ week }}
          </span>
        </div>
        <div class="month-grid">
          <button
            v-for="day in viewGrid"
            :key="day.key"
            class="day-cell"
            :class="{
              today: day.isToday,
              selected: day.key === selectedDetail.key,
              muted: !day.isCurrentMonth,
              weekend: day.isWeekend,
              rest: day.legalHolidayType === 'rest',
              work: day.legalHolidayType === 'work',
            }"
            type="button"
            :title="day.lunarDisplayName || day.lunarDayName"
            @click="selectDay(day)"
          >
            <span
              v-if="day.legalHolidayType"
              class="holiday-badge"
              :class="day.legalHolidayType"
            >
              {{ day.legalHolidayType === "rest" ? "休" : "班" }}
            </span>
            <span class="solar-day">{{ day.dayLabelPadded }}</span>
            <span class="lunar-day">{{ day.lunarDisplayName }}</span>
          </button>
        </div>
      </div>

      <div v-else class="calendar-tools-board" data-sd-calendar-tools-panel>
        <section class="tool-card date-diff-tool">
          <header>
            <CalendarRange :size="18" stroke-width="2" />
            <span>日期差计算</span>
          </header>
          <div class="tool-date-row">
            <label>
              <span>开始</span>
              <input v-model="dateDiffStart" type="date" />
            </label>
            <button
              class="swap-tool-button"
              type="button"
              aria-label="交换日期"
              @click="swapDateRange"
            >
              <ArrowRightLeft :size="15" stroke-width="2.2" />
            </button>
            <label>
              <span>结束</span>
              <input v-model="dateDiffEnd" type="date" />
            </label>
          </div>
          <div class="tool-result-row">
            <strong>{{ dateDiffResult.days }}</strong>
            <span>天</span>
            <em>含首尾 {{ dateDiffResult.inclusiveDays }} 天</em>
          </div>
        </section>

        <section class="tool-card workday-tool">
          <header>
            <BriefcaseBusiness :size="18" stroke-width="2" />
            <span>工作日计算</span>
          </header>
          <div class="workday-form">
            <label>
              <span>起始日期</span>
              <input v-model="workdayStart" type="date" />
            </label>
            <label>
              <span>工作日</span>
              <input v-model.number="workdayAmount" min="0" type="number" />
            </label>
            <div class="direction-segment" role="group" aria-label="推算方向">
              <button
                :class="{ active: workdayDirection === 'forward' }"
                type="button"
                @click="workdayDirection = 'forward'"
              >
                之后
              </button>
              <button
                :class="{ active: workdayDirection === 'backward' }"
                type="button"
                @click="workdayDirection = 'backward'"
              >
                之前
              </button>
            </div>
          </div>
          <div class="workday-result">
            <span>{{ workdayResult.dateText }}</span>
            <strong>{{ workdayResult.weekdayText }}</strong>
          </div>
        </section>

        <section class="tool-card festival-tool">
          <header>
            <Gift :size="18" stroke-width="2" />
            <span>节日大全</span>
            <button
              type="button"
              aria-label="回到今年"
              @click="viewYear = today.year"
            >
              <RotateCcw :size="14" stroke-width="2" />
            </button>
          </header>
          <div class="festival-list">
            <button
              v-for="event in festivalEvents"
              :key="event.key"
              class="festival-row"
              type="button"
              @click="selectFestivalEvent(event)"
            >
              <span class="festival-date">{{ event.monthDay }}</span>
              <span class="festival-title">{{ event.title }}</span>
              <span class="festival-meta">{{ event.meta }}</span>
            </button>
          </div>
        </section>
      </div>
    </div>

    <aside class="calendar-detail-pane">
      <p class="detail-date">{{ selectedDetail.dateText }}</p>
      <div class="detail-calendar-icon" aria-hidden="true">
        <span class="pin-row"><i></i><i></i></span>
        <strong>{{ selectedDetail.dayPadded }}</strong>
      </div>
      <p class="detail-lunar">{{ selectedDetail.lunarFullText }}</p>
      <p class="detail-year">{{ selectedDetail.ganzhiYearText }}</p>
      <p class="detail-index">
        本年第{{ selectedDetail.weekOfYear }}周， 第{{
          selectedDetail.dayOfYear
        }}天
      </p>

      <dl class="detail-list">
        <div>
          <dt class="badge red">生肖</dt>
          <dd>{{ selectedDetail.zodiacText }}</dd>
        </div>
        <div>
          <dt class="badge pink">星座</dt>
          <dd>{{ selectedDetail.constellationText }}</dd>
        </div>
        <div>
          <dt class="badge blue">节日</dt>
          <dd>{{ selectedDetail.festivalText }}</dd>
        </div>
        <div>
          <dt class="badge green">宜</dt>
          <dd>{{ selectedDetail.recommendText }}</dd>
        </div>
        <div>
          <dt class="badge rose">忌</dt>
          <dd>{{ selectedDetail.avoidText }}</dd>
        </div>
        <div>
          <dt class="badge gray">月相</dt>
          <dd>{{ selectedDetail.phaseText }}</dd>
          <dt class="badge gray">物候</dt>
          <dd>{{ selectedDetail.phenologyText }}</dd>
        </div>
      </dl>

      <div class="direction-list">
        <p>喜神方位：{{ selectedDetail.joyDirectionText }}</p>
        <p>阳贵神方位：{{ selectedDetail.yangDirectionText }}</p>
        <p>阴贵神方位：{{ selectedDetail.yinDirectionText }}</p>
        <p>福神方位：{{ selectedDetail.mascotDirectionText }}</p>
        <p>财神方位：{{ selectedDetail.wealthDirectionText }}</p>
      </div>
    </aside>
  </section>
</template>

<style scoped>
.sd-calendar-opened-panel {
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-columns: minmax(0, 1fr) 300px;
  overflow: hidden;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-01);
  color: var(--sd-theme-calendar-calendar-opened-panel-text-01);
  font-family:
    HarmonyOS_Sans,
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.calendar-main-pane {
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
  padding: 44px 34px 30px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-01);
}

.calendar-toolbar {
  position: relative;
  display: flex;
  height: 28px;
  align-items: center;
  justify-content: flex-start;
  gap: 18px;
  margin-bottom: 12px;
}

.calendar-picker-group {
  display: flex;
  align-items: center;
  gap: 9px;
}

.calendar-picker,
.square-action,
.today-action {
  display: inline-flex;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-02);
  color: var(--sd-theme-calendar-calendar-opened-panel-text-01);
  font: inherit;
}

.calendar-picker {
  width: 90px;
  gap: 7px;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-02);
  font-size: 12px;
}

.calendar-picker-shell {
  position: relative;
  display: inline-flex;
}

.calendar-picker[aria-expanded="true"] {
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-03);
  color: var(--sd-theme-calendar-calendar-opened-panel-text-03);
}

.calendar-picker-popover {
  position: absolute;
  top: 29px;
  left: 0;
  z-index: 20;
  display: grid;
  width: 132px;
  border-radius: 10px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-04);
  padding: 8px;
  box-shadow:
    0 16px 34px var(--sd-theme-calendar-calendar-opened-panel-shadow-01),
    inset 0 0 0 1px
      var(--sd-theme-calendar-calendar-opened-panel-shadow-02);
}

.year-picker {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.month-picker {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.calendar-picker-popover button {
  height: 28px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-04);
  font-size: 12px;
}

.calendar-picker-popover button:hover,
.calendar-picker-popover button[aria-selected="true"] {
  background: var(
    --sd-theme-calendar-calendar-opened-panel-accent-surface-01
  );
  color: var(--sd-theme-calendar-calendar-opened-panel-text-05);
}

.square-action {
  width: 24px;
  padding: 0;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-06);
}

.today-action {
  width: 24px;
  padding: 0;
  background: var(
    --sd-theme-calendar-calendar-opened-panel-accent-surface-01
  );
  color: var(--sd-theme-calendar-calendar-opened-panel-text-05);
  font-size: 14px;
}

.calendar-tabs {
  position: relative;
  display: flex;
  width: 144px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-05);
  padding: 2px;
}

.calendar-tabs::before {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 68px;
  height: 28px;
  border-radius: 999px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-06);
  content: "";
  transition: transform 160ms ease;
}

.calendar-tabs[data-active-tab="tools"]::before {
  transform: translateX(72px);
}

.calendar-tabs button {
  position: relative;
  z-index: 1;
  width: 70px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-07);
  font-size: 14px;
}

.calendar-tabs .active {
  color: var(--sd-theme-calendar-calendar-opened-panel-text-05);
}

.calendar-switch {
  position: relative;
  display: inline-flex;
  width: 42px;
  height: 20px;
  align-items: center;
  margin-left: auto;
  border: 0;
  border-radius: 999px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-07);
  padding: 0;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-08);
  font: inherit;
}

.calendar-switch::after {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-01);
  box-shadow: 0 1px 4px
    var(--sd-theme-calendar-calendar-opened-panel-shadow-03);
  content: "";
  transition:
    right 160ms ease,
    transform 160ms ease;
}

.calendar-switch[aria-checked="false"]::after {
  right: 23px;
}

.calendar-switch span {
  position: absolute;
  right: 23px;
  z-index: 1;
  width: 18px;
  text-align: center;
  font-size: 11px;
  line-height: 18px;
  pointer-events: none;
}

.calendar-switch[aria-checked="false"] span {
  right: 1px;
}

.today-action {
  width: 0;
  height: 0;
  padding: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transition:
    width 140ms ease,
    opacity 140ms ease;
}

.today-action.active {
  width: 24px;
  height: 24px;
  opacity: 1;
  pointer-events: auto;
}

.calendar-month-board {
  position: relative;
  height: calc(100% - 40px);
  min-height: 0;
}

.month-watermark {
  position: absolute;
  inset: 120px 0 auto;
  z-index: 0;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-09);
  font-size: 216px;
  font-weight: 700;
  line-height: 1;
  text-align: center;
  pointer-events: none;
}

.weekday-row,
.month-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.weekday-row {
  height: 38px;
  align-items: center;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-01);
  font-size: 16px;
  text-align: center;
}

.weekday-row .weekend {
  color: var(--sd-theme-calendar-calendar-opened-panel-accent-text-01);
}

.month-grid {
  height: calc(100% - 38px);
  grid-template-rows: repeat(6, minmax(0, 1fr));
  gap: 2px;
}

.day-cell {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-01);
  font: inherit;
}

.day-cell:hover,
.day-cell.selected:not(.today) {
  background: transparent;
  box-shadow: inset 0 0 0 2px
    var(--sd-theme-calendar-calendar-opened-panel-shadow-04);
}

.day-cell:hover:not(.today):not(.selected) {
  background: transparent;
  box-shadow: inset 0 0 0 2px
    var(--sd-theme-calendar-calendar-opened-panel-shadow-08);
}

.day-cell.today {
  background: var(
    --sd-theme-calendar-calendar-opened-panel-accent-surface-01
  );
  color: var(--sd-theme-calendar-calendar-opened-panel-text-05);
}

.day-cell.rest:not(.today) {
  background: var(
    --sd-theme-calendar-calendar-opened-panel-accent-surface-02
  );
}

.day-cell.work:not(.today) {
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-08);
}

.day-cell.muted {
  color: var(--sd-theme-calendar-calendar-opened-panel-text-10);
}

.day-cell.muted.rest:not(.today),
.day-cell.muted.work:not(.today) {
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-09);
}

.day-cell.weekend:not(.today) .solar-day {
  color: var(--sd-theme-calendar-calendar-opened-panel-accent-text-01);
}

.day-cell.muted.weekend:not(.today) .solar-day {
  color: var(--sd-theme-calendar-calendar-opened-panel-accent-text-02);
}

.day-cell.muted .holiday-badge {
  opacity: 0.56;
}

.solar-day {
  font-size: 19px;
  font-weight: 500;
  line-height: 28px;
}

.lunar-day {
  max-width: 92%;
  overflow: hidden;
  color: inherit;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.holiday-badge {
  position: absolute;
  top: 7px;
  right: 10px;
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-05);
  font-size: 12px;
  line-height: 18px;
}

.holiday-badge.rest {
  background: var(
    --sd-theme-calendar-calendar-opened-panel-accent-surface-03
  );
}

.holiday-badge.work {
  background: var(
    --sd-theme-calendar-calendar-opened-panel-accent-surface-04
  );
}

.calendar-tools-board {
  display: grid;
  height: calc(100% - 40px);
  min-height: 0;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  gap: 14px;
  overflow: hidden;
}

.tool-card {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 16px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-10);
  padding: 16px;
  box-shadow: inset 0 0 0 1px
    var(--sd-theme-calendar-calendar-opened-panel-shadow-05);
}

.tool-card header {
  display: flex;
  height: 24px;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-11);
  font-size: 15px;
  font-weight: 600;
}

.tool-card header svg {
  color: var(--sd-theme-calendar-calendar-opened-panel-accent-text-03);
}

.tool-card label {
  min-width: 0;
}

.tool-card label span {
  display: block;
  margin-bottom: 6px;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-08);
  font-size: 12px;
  line-height: 16px;
}

.tool-card input {
  width: 100%;
  height: 34px;
  border: 0;
  border-radius: 9px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-01);
  padding: 0 8px;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-01);
  font: inherit;
  font-size: 13px;
  outline: none;
}

.tool-card input[type="date"] {
  padding: 0 5px;
  font-size: 12px;
}

.tool-card input:focus {
  box-shadow: inset 0 0 0 2px
    var(--sd-theme-calendar-calendar-opened-panel-shadow-06);
}

.tool-date-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30px minmax(0, 1fr);
  gap: 8px;
  align-items: end;
}

.swap-tool-button {
  display: inline-flex;
  width: 30px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-01);
  color: var(--sd-theme-calendar-calendar-opened-panel-text-12);
}

.tool-result-row {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-top: 16px;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-13);
}

.tool-result-row strong {
  color: var(--sd-theme-calendar-calendar-opened-panel-accent-text-03);
  font-size: 34px;
  font-weight: 500;
  line-height: 1;
}

.tool-result-row em {
  margin-left: auto;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-08);
  font-size: 12px;
  font-style: normal;
}

.workday-form {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(70px, 0.6fr) auto;
  gap: 10px;
  align-items: end;
}

.direction-segment {
  display: inline-flex;
  height: 34px;
  overflow: hidden;
  border-radius: 9px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-01);
  padding: 2px;
}

.direction-segment button {
  width: 42px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-12);
  font-size: 12px;
}

.direction-segment .active {
  background: var(
    --sd-theme-calendar-calendar-opened-panel-accent-surface-01
  );
  color: var(--sd-theme-calendar-calendar-opened-panel-text-05);
}

.workday-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  border-radius: 12px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-01);
  padding: 12px;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-11);
  font-size: 14px;
}

.workday-result strong {
  color: var(--sd-theme-calendar-calendar-opened-panel-accent-text-03);
  font-size: 14px;
  font-weight: 600;
}

.festival-tool {
  grid-column: 1 / -1;
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.festival-tool header button {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  border: 0;
  border-radius: 8px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-01);
  color: var(--sd-theme-calendar-calendar-opened-panel-text-12);
}

.festival-list {
  display: grid;
  flex: 1 1 0;
  min-height: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: minmax(52px, max-content);
  align-content: start;
  gap: 8px;
  overflow: hidden auto;
  padding-right: 2px;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-color: var(--sd-scrollbar-thumb) var(--sd-scrollbar-track);
  scrollbar-width: thin;
}

.festival-list::-webkit-scrollbar {
  width: var(--sd-scrollbar-size);
}

.festival-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--sd-scrollbar-thumb);
}

.festival-list::-webkit-scrollbar-thumb:hover {
  background: var(--sd-scrollbar-thumb-hover);
}

.festival-list::-webkit-scrollbar-track {
  background: var(--sd-scrollbar-track);
}

.festival-row {
  display: grid;
  min-width: 0;
  grid-template-columns: 42px minmax(0, 1fr);
  grid-template-rows: 18px 18px;
  column-gap: 8px;
  align-items: center;
  border: 0;
  border-radius: 10px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-01);
  padding: 8px 9px;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-11);
  text-align: left;
}

.festival-row:hover {
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-12);
}

.festival-date {
  grid-row: 1 / 3;
  color: var(--sd-theme-calendar-calendar-opened-panel-accent-text-03);
  font-size: 12px;
  font-weight: 600;
}

.festival-title,
.festival-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.festival-title {
  font-size: 13px;
  font-weight: 600;
}

.festival-meta {
  color: var(--sd-theme-calendar-calendar-opened-panel-text-08);
  font-size: 11px;
}

.calendar-detail-pane {
  min-width: 0;
  overflow: hidden auto;
  padding: 34px 18px 24px 22px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-13);
  color: var(--sd-theme-calendar-calendar-opened-panel-text-01);
  text-align: center;
}

.detail-date,
.detail-lunar,
.detail-year,
.detail-index {
  margin: 0;
}

.detail-date {
  font-size: 14px;
  line-height: 24px;
}

.detail-calendar-icon {
  position: relative;
  display: flex;
  width: 78px;
  height: 78px;
  align-items: center;
  justify-content: center;
  margin: 10px auto 8px;
  border-radius: 9px;
  background: var(
    --sd-theme-calendar-calendar-opened-panel-accent-surface-01
  );
  color: var(--sd-theme-calendar-calendar-opened-panel-text-05);
  box-shadow: inset 0 -4px 0
    var(--sd-theme-calendar-calendar-opened-panel-shadow-07);
}

.detail-calendar-icon strong {
  font-size: 46px;
  font-weight: 300;
  line-height: 1;
}

.pin-row {
  position: absolute;
  top: 8px;
  left: 0;
  display: flex;
  width: 100%;
  justify-content: space-around;
  padding: 0 15px;
}

.pin-row i {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-14);
}

.detail-lunar {
  font-size: 14px;
  line-height: 22px;
}

.detail-year,
.detail-index {
  color: var(--sd-theme-calendar-calendar-opened-panel-text-01);
  font-size: 13px;
  line-height: 22px;
}

.detail-list {
  margin: 12px 0 0;
  border-top: 1px solid
    var(--sd-theme-calendar-calendar-opened-panel-border-01);
  text-align: left;
}

.detail-list div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 7px;
  align-items: start;
  padding: 7px 0;
  border-bottom: 1px solid
    var(--sd-theme-calendar-calendar-opened-panel-border-01);
}

.detail-list div:last-child {
  grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
}

.detail-list dt,
.detail-list dd {
  margin: 0;
  font-size: 12px;
  line-height: 20px;
}

.detail-list dd {
  color: var(--sd-theme-calendar-calendar-opened-panel-text-13);
}

.badge {
  display: inline-flex;
  min-width: 31px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-05);
}

.badge.red {
  background: var(
    --sd-theme-calendar-calendar-opened-panel-accent-surface-05
  );
}

.badge.pink {
  background: var(
    --sd-theme-calendar-calendar-opened-panel-accent-surface-06
  );
}

.badge.blue {
  background: var(
    --sd-theme-calendar-calendar-opened-panel-accent-surface-07
  );
}

.badge.green {
  background: var(
    --sd-theme-calendar-calendar-opened-panel-accent-surface-08
  );
}

.badge.rose {
  background: var(
    --sd-theme-calendar-calendar-opened-panel-accent-surface-09
  );
}

.badge.gray {
  background: var(--sd-theme-calendar-calendar-opened-panel-surface-15);
}

.direction-list {
  margin-top: 8px;
  text-align: left;
}

.direction-list p {
  margin: 0;
  color: var(--sd-theme-calendar-calendar-opened-panel-text-14);
  font-size: 12px;
  line-height: 21px;
}

@media (max-width: 720px) {
  .sd-calendar-opened-panel {
    grid-template-columns: 1fr;
  }

  .calendar-detail-pane {
    display: none;
  }

  .calendar-main-pane {
    padding: 42px 18px 22px;
  }

  .calendar-tools-board {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto minmax(0, 1fr);
  }

  .festival-tool {
    grid-column: auto;
  }

  .festival-list {
    grid-template-columns: 1fr;
  }
}
</style>
