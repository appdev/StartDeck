<script setup lang="ts">
import { computed } from "vue";
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";
import {
  anniversaryCalendarDays,
  anniversaryDays,
  anniversaryTemplateStyle,
  anniversaryWeekdays,
  anniversaryUsesCalendar,
} from "./useItabAnniversaryRuntime";
import type { ItabAnniversaryTemplate } from "./itabAnniversaryTypes";

const props = withDefaults(
  defineProps<{
    template: ItabAnniversaryTemplate;
    sizeKey?: ItabWidgetSizeKey;
    variant?: "outer" | "mini" | "preview";
    current?: boolean;
  }>(),
  {
    sizeKey: undefined,
    variant: "outer",
    current: false,
  },
);

const cardTemplate = computed(() => ({
  ...props.template,
  sizeKey: props.sizeKey || props.template.sizeKey,
}));
const sizeClass = computed(
  () => `size-${cardTemplate.value.sizeKey.replace("x", "-")}`,
);
const isPayday = computed(() => cardTemplate.value.eventName === "发工资还有");
const hasImageBackground = computed(
  () =>
    cardTemplate.value.backgroundMode === "image" &&
    cardTemplate.value.backgroundImage.trim().length > 0,
);
const withCalendar = computed(() =>
  anniversaryUsesCalendar(cardTemplate.value),
);
const templateClass = computed(() => `is-template-${cardTemplate.value.id}`);
const style = computed(() => anniversaryTemplateStyle(cardTemplate.value));
const hasEventData = computed(() =>
  Boolean(
    cardTemplate.value.label ||
      cardTemplate.value.eventName ||
      cardTemplate.value.date,
  ),
);
</script>

<template>
  <span
    class="itab-anniversary-card"
    :class="[
      `variant-${variant}`,
      sizeClass,
      {
        'is-current': current,
        'is-payday': isPayday,
        'has-image-background': hasImageBackground,
        'with-calendar': withCalendar,
      },
      templateClass,
    ]"
    :style="style"
    :data-itab-anniversary-card-size="cardTemplate.sizeKey"
  >
    <span v-if="hasEventData" class="anniversary-card-copy">
      <span>{{ cardTemplate.label }}</span>
      <strong>
        {{
          anniversaryDays(
            cardTemplate.date,
            cardTemplate.mode,
            cardTemplate.repeat,
          )
        }}<small v-if="!isPayday">天</small>
      </strong>
      <em v-if="!isPayday">{{ cardTemplate.date }}</em>
    </span>
    <span v-if="withCalendar" class="anniversary-card-calendar">
      <b
        v-for="day in anniversaryWeekdays"
        :key="`anniversary-week-${cardTemplate.id}-${day}`"
        :class="{ weekend: day === '六' || day === '日' }"
      >
        {{ day }}
      </b>
      <i
        v-for="(day, dayIndex) in anniversaryCalendarDays"
        :key="`anniversary-day-${cardTemplate.id}-${dayIndex}`"
        :class="{
          muted: dayIndex < 4 || dayIndex > 34,
          weekend: dayIndex % 7 >= 5,
          today: day === 20 && dayIndex > 8 && dayIndex < 28,
        }"
      >
        {{ day }}
      </i>
    </span>
  </span>
</template>

<style scoped>
.itab-anniversary-card {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  padding: 12px;
  background-color: var(--anniversary-bg);
  background-image: var(--anniversary-background-image);
  background-position: center;
  background-size: cover;
  color: var(--anniversary-text);
  font-family: var(--anniversary-font);
}

.variant-mini,
.variant-preview {
  display: grid;
  align-content: center;
  border-radius: 18px;
}

.variant-mini {
  box-shadow: 0 0 10px 3px
    var(--sd-theme-itab-anniversary-anniversary-card-shadow-01);
}

.variant-preview {
  box-shadow: 0 8px 18px
    var(--sd-theme-itab-anniversary-anniversary-card-shadow-02);
}

.variant-mini.size-2-2 {
  width: 123px;
  height: 123px;
  padding: 9.5px 7.6px;
  border-radius: 14px;
}

.variant-mini.size-2-4 {
  width: 275px;
  height: 125px;
  padding: 14px 16px;
  border-radius: 14px;
}

.variant-preview {
  position: absolute;
  top: 0;
  left: 50%;
  width: 126px;
  height: 126px;
  padding: 13px 12px;
  border-radius: 14px;
  opacity: 0.24;
  pointer-events: auto;
  transform: translateX(-50%) scale(0.78);
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}

.variant-preview.is-current {
  z-index: 3;
  opacity: 1;
  transform: translateX(-50%) rotate(0deg) scale(1);
}

.anniversary-card-copy,
.anniversary-card-copy > span,
.anniversary-card-copy em {
  display: block;
  min-width: 0;
}

.anniversary-card-copy > span {
  overflow: hidden;
  font-size: 12px;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.anniversary-card-copy strong {
  display: block;
  overflow: visible;
  margin-top: 18px;
  font-size: 39px;
  font-weight: 700;
  line-height: 43px;
  text-overflow: clip;
  white-space: nowrap;
}

.anniversary-card-copy small {
  margin-left: 2px;
  font-size: 13px;
}

.anniversary-card-copy em {
  margin-top: 9px;
  overflow: hidden;
  font-size: 12px;
  font-style: normal;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.variant-mini.size-2-2 .anniversary-card-copy {
  align-content: start;
}

.variant-mini.size-2-2 .anniversary-card-copy > span {
  font-size: 11.4px;
  line-height: 13.68px;
}

.variant-mini.size-2-2 .anniversary-card-copy strong {
  margin-top: 8px;
  font-size: 34.2px;
  line-height: 51.3px;
}

.variant-mini.size-2-2 .anniversary-card-copy small {
  font-size: 12px;
  line-height: 18px;
}

.variant-mini.size-2-2 .anniversary-card-copy em {
  margin-top: 5px;
  font-size: 11.4px;
  line-height: 17.1px;
}

.variant-mini.size-2-2.is-template-love {
  padding: 17.1px;
  text-align: center;
}

.variant-mini.size-2-2.is-template-love .anniversary-card-copy {
  justify-items: center;
}

.variant-mini.size-2-2.is-template-love .anniversary-card-copy strong {
  margin-top: 3px;
  font-size: 32.3px;
  line-height: 48.45px;
}

.is-payday {
  --payday-band: 44px;
  justify-content: flex-start;
  padding: 0;
  background: linear-gradient(
    to bottom,
    var(--anniversary-text) 0 var(--payday-band),
    var(--anniversary-bg) var(--payday-band) 100%
  );
  color: var(--anniversary-text);
  text-align: center;
}

.is-payday .anniversary-card-copy {
  display: grid;
  width: 100%;
  height: 100%;
  align-content: start;
  align-self: stretch;
  justify-self: stretch;
}

.is-payday .anniversary-card-copy > span {
  height: 44px;
  color: var(--sd-theme-itab-anniversary-anniversary-card-text-01);
  font-size: 14px;
  font-weight: 600;
  line-height: 44px;
}

.is-payday .anniversary-card-copy strong {
  width: 100%;
  justify-self: stretch;
  margin-top: 26px;
  color: var(--anniversary-text);
  font-size: 54px;
  line-height: 60px;
  text-align: center;
}

.is-payday .anniversary-card-copy small,
.is-payday .anniversary-card-copy em {
  display: none;
}

.variant-mini.is-payday.size-2-2 {
  --payday-band: 37.5px;
  display: block;
  background: linear-gradient(
    to bottom,
    var(--anniversary-text) 0 var(--payday-band),
    var(--anniversary-bg) var(--payday-band) 100%
  );
}

.variant-mini.is-payday.size-2-4 {
  display: block;
}

.variant-mini.is-payday.size-2-2 .anniversary-card-copy > span {
  width: calc(100% + 15.2px);
  height: 37.5px;
  margin: -9.5px -7.6px 0;
  font-size: 11.9px;
  line-height: 37.5px;
}

.variant-mini.is-payday.size-2-2 .anniversary-card-copy strong {
  margin-top: 0;
  font-size: 47.6px;
  line-height: 71.4px;
}

.variant-mini.is-payday.size-2-4 .anniversary-card-copy > span {
  width: calc(100% + 32px);
  height: 44px;
  margin: -14px -16px 0;
  font-size: 11.9px;
  line-height: 44px;
}

.variant-mini.is-payday.size-2-4 .anniversary-card-copy strong {
  display: flex;
  height: 81px;
  align-items: center;
  justify-content: center;
  margin-top: 0;
  font-size: 47.6px;
  line-height: 71.4px;
}

.is-payday.size-1-1 {
  --payday-band: 18px;
}

.is-payday.size-1-1 .anniversary-card-copy {
  grid-template-rows: 18px minmax(0, 1fr);
}

.is-payday.size-1-1 .anniversary-card-copy > span {
  height: 18px;
  padding: 0 3px;
  font-size: 12px;
  line-height: 18px;
}

.is-payday.size-1-1 .anniversary-card-copy strong {
  display: flex;
  height: 42px;
  align-items: center;
  justify-content: center;
  margin: 0;
  font-size: 22.4px;
  line-height: 33.6px;
}

.is-payday.size-1-2 {
  --payday-band: 20px;
  background: var(--anniversary-bg);
}

.is-payday.size-1-2 .anniversary-card-copy {
  align-content: center;
  justify-items: center;
}

.is-payday.size-1-2 .anniversary-card-copy > span {
  width: 72px;
  height: 18px;
  color: var(--anniversary-text);
  font-size: 12px;
  line-height: 18px;
}

.is-payday.size-1-2 .anniversary-card-copy strong {
  margin: 0;
  color: var(--anniversary-text);
  font-size: 16px;
  line-height: 24px;
}

.is-payday.size-2-1 {
  --payday-band: 38px;
  background: var(--anniversary-bg);
}

.is-payday.size-2-1 .anniversary-card-copy {
  align-content: center;
  justify-items: center;
}

.is-payday.size-2-1 .anniversary-card-copy > span {
  width: 20px;
  height: 60px;
  color: var(--anniversary-text);
  font-size: 12px;
  line-height: 18px;
  white-space: normal;
}

.is-payday.size-2-1 .anniversary-card-copy strong {
  margin: 4px 0 0;
  color: var(--anniversary-text);
  font-size: 16px;
  line-height: 24px;
}

.itab-anniversary-card.size-1-1:not(.is-payday),
.itab-anniversary-card.size-1-2:not(.is-payday),
.itab-anniversary-card.size-2-1:not(.is-payday),
.itab-anniversary-card.size-2-4.with-calendar:not(.is-payday) {
  display: block;
  padding: 0;
  text-align: center;
}

.itab-anniversary-card.size-1-1:not(.is-payday) .anniversary-card-copy,
.itab-anniversary-card.size-1-2:not(.is-payday) .anniversary-card-copy,
.itab-anniversary-card.size-2-1:not(.is-payday) .anniversary-card-copy,
.itab-anniversary-card.size-2-4.with-calendar:not(.is-payday)
  .anniversary-card-copy {
  position: relative;
  width: 100%;
  height: 100%;
}

.itab-anniversary-card.size-1-1:not(.is-payday) .anniversary-card-copy > span {
  position: absolute;
  top: 10px;
  left: -6px;
  width: 72px;
  height: 18px;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.itab-anniversary-card.size-1-1:not(.is-payday) .anniversary-card-copy strong {
  position: absolute;
  top: 28px;
  left: -6px;
  width: 72px;
  height: 23px;
  margin: 0;
  font-size: 15px;
  line-height: 22.5px;
}

.itab-anniversary-card.size-1-1:not(.is-payday) .anniversary-card-copy small,
.itab-anniversary-card.size-1-1:not(.is-payday) .anniversary-card-copy em {
  display: none;
}

.itab-anniversary-card.size-1-2:not(.is-payday) .anniversary-card-copy > span {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 71px;
  height: 18px;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
}

.itab-anniversary-card.size-1-2:not(.is-payday) .anniversary-card-copy strong {
  position: absolute;
  top: 18px;
  left: 93px;
  width: 45px;
  height: 24px;
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  text-align: left;
}

.itab-anniversary-card.size-1-2:not(.is-payday) .anniversary-card-copy small {
  display: none;
}

.itab-anniversary-card.size-1-2:not(.is-payday) .anniversary-card-copy em {
  position: absolute;
  top: 30px;
  left: 12px;
  width: 71px;
  height: 18px;
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
}

.itab-anniversary-card.size-2-1:not(.is-payday) .anniversary-card-copy > span {
  position: absolute;
  top: 12px;
  left: 0;
  width: 60px;
  height: 39px;
  font-size: 13px;
  line-height: 19.5px;
  white-space: normal;
}

.itab-anniversary-card.size-2-1:not(.is-payday) .anniversary-card-copy strong {
  position: absolute;
  top: 63px;
  left: 7px;
  width: 45px;
  height: 24px;
  margin: 0;
  font-size: 16px;
  line-height: 24px;
}

.itab-anniversary-card.size-2-1:not(.is-payday) .anniversary-card-copy small {
  display: none;
}

.itab-anniversary-card.size-2-1:not(.is-payday) .anniversary-card-copy em {
  position: absolute;
  top: 99px;
  left: 0;
  width: 60px;
  height: 39px;
  margin: 0;
  font-size: 13px;
  line-height: 19.5px;
  white-space: normal;
}

.itab-anniversary-card.size-2-4:not(.with-calendar):not(.is-payday) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 17px;
  text-align: center;
}

.itab-anniversary-card.size-2-4:not(.with-calendar):not(.is-payday)
  .anniversary-card-copy {
  display: grid;
  justify-items: center;
}

.itab-anniversary-card.size-2-4:not(.with-calendar):not(.is-payday)
  .anniversary-card-copy
  > span {
  max-width: 100%;
  font-size: 11.4px;
  line-height: 13.68px;
}

.itab-anniversary-card.size-2-4:not(.with-calendar):not(.is-payday)
  .anniversary-card-copy
  strong {
  margin-top: 8px;
  font-size: 32.3px;
  line-height: 48.45px;
}

.itab-anniversary-card.size-2-4:not(.with-calendar):not(.is-payday)
  .anniversary-card-copy
  em {
  margin-top: 4px;
  font-size: 11.4px;
  line-height: 17.1px;
}

.itab-anniversary-card.size-2-4.with-calendar:not(.is-payday)
  .anniversary-card-copy
  > span {
  position: absolute;
  top: 11px;
  left: 8px;
  width: 313px;
  height: 15px;
  font-size: 12.6px;
  line-height: 15.12px;
  text-align: left;
}

.itab-anniversary-card.size-2-4.with-calendar:not(.is-payday)
  .anniversary-card-copy
  strong {
  position: absolute;
  top: 42px;
  left: 8px;
  width: 118px;
  height: 57px;
  margin: 0;
  font-size: 37.8px;
  line-height: 56.7px;
  text-align: left;
}

.itab-anniversary-card.size-2-4.with-calendar:not(.is-payday)
  .anniversary-card-copy
  small {
  margin-left: 0;
  font-size: 12px;
  line-height: 18px;
}

.itab-anniversary-card.size-2-4.with-calendar:not(.is-payday)
  .anniversary-card-copy
  em {
  position: absolute;
  top: 121px;
  left: 8px;
  width: 60px;
  height: 19px;
  margin: 0;
  font-size: 12.6px;
  line-height: 18.9px;
  text-align: left;
}

.variant-mini.size-2-4.with-calendar:not(.is-payday)
  .anniversary-card-copy
  > span {
  top: 9px;
  left: 7px;
  width: 260px;
  height: 13px;
  font-size: 10.5px;
  line-height: 12.6px;
}

.variant-mini.size-2-4.with-calendar:not(.is-payday)
  .anniversary-card-copy
  strong {
  top: 35px;
  left: 7px;
  width: 98px;
  height: 48px;
  font-size: 31.5px;
  line-height: 47.25px;
}

.variant-mini.size-2-4.with-calendar:not(.is-payday)
  .anniversary-card-copy
  small {
  font-size: 10px;
  line-height: 15px;
}

.variant-mini.size-2-4.with-calendar:not(.is-payday) .anniversary-card-copy em {
  top: 101px;
  left: 7px;
  width: 50px;
  height: 16px;
  font-size: 10.5px;
  line-height: 15.75px;
}

.anniversary-card-calendar {
  position: absolute;
  top: 11px;
  left: 140px;
  display: grid;
  width: 182px;
  height: 128px;
  align-content: start;
  grid-template-columns: repeat(7, 26px);
  gap: 3px 0;
  color: currentColor;
  font-size: 11.76px;
  line-height: 17.64px;
  text-align: center;
}

.variant-mini.size-2-4 .anniversary-card-calendar {
  top: 9px;
  left: 117px;
  width: 152px;
  height: 107px;
  grid-template-columns: repeat(7, 21.7px);
  gap: 2.5px 0;
  font-size: 9.8px;
  line-height: 14.7px;
}

.anniversary-card-calendar i,
.anniversary-card-calendar b {
  display: block;
  min-width: 0;
  font-style: normal;
  font-weight: 400;
}

.anniversary-card-calendar .weekend,
.anniversary-card-calendar i:nth-child(6),
.anniversary-card-calendar i:nth-child(7) {
  color: var(--sd-theme-itab-anniversary-anniversary-card-accent-text-01);
}

.anniversary-card-calendar .muted {
  opacity: 0.42;
}

.anniversary-card-calendar .today {
  display: grid;
  width: 15px;
  height: 15px;
  place-items: center;
  justify-self: center;
  border-radius: 50%;
  background: var(
    --sd-theme-itab-anniversary-anniversary-card-accent-surface-01
  );
  color: var(--sd-theme-itab-anniversary-anniversary-card-text-01);
  line-height: 15px;
}

.variant-preview.size-1-1 {
  top: 32px;
  width: 60px;
  height: 60px;
  padding: 0;
  border-radius: 18px;
}

.variant-preview.size-1-2 {
  top: 44px;
  width: 150px;
  height: 60px;
  padding: 0;
  border-radius: 18px;
}

.variant-preview.size-2-1 {
  width: 60px;
  height: 150px;
  padding: 0;
  border-radius: 18px;
}

.variant-preview.size-2-4 {
  width: 330px;
  height: 150px;
  padding: 0;
  border-radius: 18px;
}

.variant-preview.is-payday {
  --payday-band: 38px;
  --payday-label-size: 11.9px;
  --payday-label-line: 17.85px;
  --payday-number-size: 47.6px;
  --payday-number-line: 71.4px;
  display: block;
  padding: 0;
  background: linear-gradient(
    to bottom,
    var(--anniversary-text) 0 var(--payday-band),
    var(--anniversary-bg) var(--payday-band) 100%
  );
}

.variant-preview.is-payday.size-1-1 {
  --payday-band: 18px;
  --payday-label-size: 9px;
  --payday-label-line: 12px;
  --payday-number-size: 20px;
  --payday-number-line: 30px;
}

.variant-preview.is-payday.size-1-2 {
  --payday-band: 20px;
  --payday-label-size: 10px;
  --payday-label-line: 14px;
  --payday-number-size: 22px;
  --payday-number-line: 32px;
}

.variant-preview.is-payday.size-2-1 {
  --payday-band: 38px;
  --payday-label-size: 11px;
  --payday-label-line: 15px;
  --payday-number-size: 28px;
  --payday-number-line: 42px;
}

.variant-preview.is-payday .anniversary-card-copy {
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-rows: var(--payday-band) minmax(0, 1fr);
}

.variant-preview.is-payday .anniversary-card-copy > span {
  display: flex;
  width: 100%;
  height: var(--payday-band);
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0 6px;
  color: var(--sd-theme-itab-anniversary-anniversary-card-text-01);
  font-size: var(--payday-label-size);
  font-weight: 500;
  line-height: var(--payday-label-line);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.variant-preview.is-payday .anniversary-card-copy strong {
  display: flex;
  min-width: 0;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  margin: 0;
  overflow: hidden;
  color: var(--anniversary-text);
  font-size: var(--payday-number-size);
  font-weight: 700;
  line-height: var(--payday-number-line);
}

.is-payday.has-image-background,
.variant-mini.is-payday.has-image-background,
.variant-preview.is-payday.has-image-background {
  background-color: var(--anniversary-bg);
  background-image:
    linear-gradient(
      to bottom,
      var(--anniversary-text) 0 var(--payday-band),
      transparent var(--payday-band) 100%
    ),
    var(--anniversary-background-image);
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}
</style>
