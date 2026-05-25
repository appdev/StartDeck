<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
} from "vue";
import type { StyleValue } from "vue";

import {
  formatWidgetShellViolations,
  validateWidgetShell,
  WIDGET_SHELL_CONTRACT_VERSION,
  WidgetShellContractError,
  type WidgetShellViolation,
} from "../itab-widgets/WidgetShellContract";

const props = defineProps<{
  cardStyle?: StyleValue;
  contractId?: string;
}>();

defineEmits<{
  open: [event: MouseEvent];
  contextmenu: [event: MouseEvent];
}>();

defineSlots<{
  default(): unknown;
  title(): unknown;
}>();

const rootRef = ref<HTMLElement | null>(null);
const shellViolations = ref<WidgetShellViolation[]>([]);
const shellContractLocked = ref(false);
let reportedViolationSignature = "";
let delayedValidationTimer: number | undefined;

const hasShellViolation = computed(() => shellViolations.value.length > 0);
const shellViolationText = computed(() =>
  formatWidgetShellViolations(shellViolations.value),
);

const shouldValidateRenderedShell = () =>
  import.meta.env.MODE !== "test" &&
  typeof window !== "undefined" &&
  typeof window.getComputedStyle === "function";

const validateCurrentShell = async () => {
  if (shellContractLocked.value || !shouldValidateRenderedShell()) return;
  await nextTick();
  if (!rootRef.value) return;

  const result = validateWidgetShell(rootRef.value, {
    componentId: props.contractId,
  });
  if (result.valid) {
    shellViolations.value = [];
    return;
  }

  shellContractLocked.value = true;
  shellViolations.value = result.violations;
  const signature = shellViolationText.value;
  if (signature && signature !== reportedViolationSignature) {
    reportedViolationSignature = signature;
    console.error(
      new WidgetShellContractError(result.violations, {
        componentId: props.contractId,
      }),
    );
  }
};

onMounted(() => {
  void validateCurrentShell();
  delayedValidationTimer = window.setTimeout(() => {
    void validateCurrentShell();
  }, 250);
});

onUpdated(() => {
  void validateCurrentShell();
});

onBeforeUnmount(() => {
  if (delayedValidationTimer !== undefined) {
    window.clearTimeout(delayedValidationTimer);
  }
});
</script>

<template>
  <button
    ref="rootRef"
    class="itab-native-widget"
    :class="{ 'is-shell-contract-invalid': hasShellViolation }"
    :data-widget-shell-contract="WIDGET_SHELL_CONTRACT_VERSION"
    type="button"
    @click.stop="$emit('open', $event)"
    @contextmenu="$emit('contextmenu', $event)"
  >
    <span class="widget-card" :style="cardStyle">
      <span
        v-if="hasShellViolation"
        class="widget-contract-error"
        role="alert"
        :title="shellViolationText"
      >
        <strong>组件外壳约束违规</strong>
        <small>已降级，检查控制台错误</small>
      </span>
      <slot v-else></slot>
    </span>
    <span class="widget-title">
      <slot name="title"></slot>
    </span>
  </button>
</template>

<style>
.itab-native .itab-native-widget {
  position: relative;
  display: block;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: center;
}

.itab-native .itab-native-widget.is-weather {
  border-radius: 18px;
}

.itab-native .itab-native-widget > .widget-card {
  position: absolute;
  inset: 0;
  display: block;
  overflow: hidden;
  border-radius: 18px;
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.21);
}

.itab-native .itab-native-widget > .widget-title {
  position: absolute;
  top: calc(100% + 5px);
  left: 50%;
  width: max(88px, 100%);
  overflow: hidden;
  color: #fff;
  font-size: 12px;
  line-height: 15px;
  text-overflow: ellipsis;
  text-shadow: 0 1px 7px rgba(0, 0, 0, 0.72);
  transform: translateX(-50%);
  white-space: nowrap;
}

.itab-native .itab-native-widget.size-1-1 > .widget-card {
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(8px);
}

.itab-native .itab-native-widget.is-tool-icon > .widget-card {
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.92);
}

.itab-native .itab-native-widget.is-tool-icon > .widget-card img {
  width: 76px;
  height: 76px;
  object-fit: contain;
}

.itab-native .itab-native-widget.widget-ip-30 > .widget-card {
  display: block;
  background: transparent;
  box-shadow: rgba(0, 0, 0, 0.1) 0 0 5px 0;
  backdrop-filter: none;
}

.itab-native .itab-native-widget.widget-ip-30.size-2-2 > .widget-card {
  background: rgb(60, 102, 255);
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 10px 0;
}

.itab-native .itab-native-widget.widget-ip-30.size-2-4 > .widget-card {
  background: rgb(60, 102, 255);
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 10px 0;
}

.itab-native .itab-native-widget.widget-ip-30 > .widget-card img {
  display: block;
  width: 100%;
  height: 100%;
  background: rgb(60, 102, 255);
  object-fit: contain;
}

.itab-native .itab-native-widget.is-shell-contract-invalid > .widget-card {
  display: grid;
  place-items: center;
  padding: 10px;
  background: rgba(68, 20, 22, 0.96);
  color: #fff;
  box-shadow:
    0 0 0 1px rgba(255, 92, 89, 0.48),
    0 12px 26px rgba(0, 0, 0, 0.28);
  text-align: center;
}

.widget-contract-error {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: 4px;
  place-items: center;
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.widget-contract-error strong,
.widget-contract-error small {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.widget-contract-error strong {
  font-size: 12px;
  line-height: 16px;
}

.widget-contract-error small {
  color: rgba(255, 255, 255, 0.72);
  font-size: 10px;
  line-height: 13px;
}

.itab-native .itab-native-widget.is-weather > .widget-card {
  border-radius: 18px;
  background: transparent;
  color: #fff;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
  text-align: left;
}

.itab-native .itab-native-widget.is-weather:hover > .widget-card {
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
}

.itab-native .itab-native-widget.is-weather > .widget-title {
  line-height: 13.2px;
  text-shadow: none;
}

.itab-native .itab-native-widget.is-weather.size-1-1 > .widget-title,
.itab-native .itab-native-widget.is-weather.size-2-1 > .widget-title {
  width: 90px;
}

.itab-native .itab-native-widget.is-weather.size-1-2 > .widget-title,
.itab-native .itab-native-widget.is-weather.size-2-2 > .widget-title {
  width: 180px;
}

.itab-native .itab-native-widget.is-weather.size-2-4 > .widget-title {
  width: 360px;
}

.itab-native .itab-native-widget.is-calendar > .widget-card {
  display: block;
  background: #fff;
  color: #222;
  font-family:
    "HarmonyOS_Sans",
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.itab-native .itab-native-widget.is-calendar.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-calendar.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-calendar.size-2-1 > .widget-card {
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
}

.itab-native .itab-native-widget.is-calendar.size-2-2 > .widget-card,
.itab-native .itab-native-widget.is-calendar.size-2-4 > .widget-card {
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
}

.itab-native .itab-native-widget.is-calendar > .widget-title {
  top: calc(100% + 6px);
  width: calc(100% + 30px);
  font-family:
    "PingFang SC",
    -apple-system,
    "system-ui",
    "Helvetica Neue",
    Helvetica,
    sans-serif;
  line-height: 13.2px;
}

.itab-native .itab-native-widget.is-hotsearch > .widget-card {
  padding: 10px 12px;
  background: linear-gradient(
    135deg,
    rgba(37, 41, 52, 0.93),
    rgba(73, 79, 91, 0.88)
  );
  color: rgba(255, 255, 255, 0.86);
  text-align: left;
}

.itab-native .itab-native-widget.is-anniversary > .widget-card,
.itab-native .itab-native-widget.is-anniversary-day > .widget-card {
  padding: 0;
  background: var(--anniversary-bg);
  color: var(--anniversary-text);
  font-family: var(--anniversary-font);
  text-align: left;
}

.itab-native .itab-native-widget.is-anniversary > .widget-title,
.itab-native .itab-native-widget.is-anniversary-day > .widget-title {
  top: calc(100% + 6px);
  width: 180px;
}

.itab-native .itab-native-widget.is-anniversary.size-1-1 > .widget-title,
.itab-native .itab-native-widget.is-anniversary-day.size-1-1 > .widget-title,
.itab-native .itab-native-widget.is-anniversary.size-2-1 > .widget-title,
.itab-native .itab-native-widget.is-anniversary-day.size-2-1 > .widget-title {
  width: 90px;
}

.itab-native .itab-native-widget.is-anniversary.size-1-2 > .widget-title,
.itab-native .itab-native-widget.is-anniversary-day.size-1-2 > .widget-title,
.itab-native .itab-native-widget.is-anniversary.size-2-2 > .widget-title,
.itab-native .itab-native-widget.is-anniversary-day.size-2-2 > .widget-title {
  width: 180px;
}

.itab-native .itab-native-widget.is-anniversary.size-2-4 > .widget-title,
.itab-native .itab-native-widget.is-anniversary-day.size-2-4 > .widget-title {
  width: 360px;
}

.itab-native .itab-native-widget.is-memo > .widget-card {
  display: block;
  background: linear-gradient(135deg, rgb(29, 101, 240), rgb(26, 209, 252))
    center / cover;
  color: #fff;
  font-size: 21px;
  line-height: 1.5;
  box-shadow: rgba(0, 0, 0, 0.1) 0 0 5px 0;
  text-align: left;
}

.itab-native .itab-native-widget.is-memo.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-memo.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-memo.size-2-1 > .widget-card {
  font-size: 19px;
  backdrop-filter: none;
}

.itab-native .itab-native-widget.is-movie > .widget-card {
  display: block;
  background: var(--movie-bg-color, #4c4c3f);
  color: var(--movie-text-color, #f9f9f4);
  box-shadow: rgba(0, 0, 0, 0.1) 0 0 5px 0;
  text-align: left;
}

.itab-native .itab-native-widget.is-movie.size-2-2 > .widget-card {
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 10px 0;
}

.itab-native .itab-native-widget.is-movie > .widget-card::before {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(0deg, var(--movie-bg-color, #4c4c3f), rgba(0, 0, 0, 0)),
    var(--movie-cover-image) center/cover;
  content: "";
}

.itab-native .itab-native-widget.is-countdown > .widget-card {
  padding: 0;
  background: var(--countdown-bg-color, #fff);
  color: var(--countdown-text-color, #666);
  box-shadow: rgba(0, 0, 0, 0.1) 0 0 5px 0;
  font-family:
    "HarmonyOS_Sans",
    "HarmonyOS Sans",
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  text-align: left;
}

.itab-native .itab-native-widget.is-countdown > .widget-card::after {
  content: none;
}

.itab-native .itab-native-widget.is-next-holiday > .widget-card {
  padding: 13px;
  background: rgba(21, 28, 31, 0.86);
  color: rgba(255, 255, 255, 0.76);
  text-align: left;
}

.itab-native .itab-native-widget.is-next-holiday > .widget-card::before {
  position: absolute;
  inset: 13px;
  content: "";
  border: 1px dashed rgba(255, 255, 255, 0.18);
  border-radius: 10px;
}

.itab-native .itab-native-widget.is-daily-quote > .widget-card {
  display: block;
  background: transparent;
  color: #fff;
  box-shadow: rgba(0, 0, 0, 0.1) 0 0 5px 0;
  text-align: center;
  backdrop-filter: none;
}

.itab-native .itab-native-widget.is-daily-quote.size-2-2 > .widget-card,
.itab-native .itab-native-widget.is-daily-quote.size-2-4 > .widget-card {
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 10px 0;
}

.itab-native .itab-native-widget.is-daily-quote > .widget-title {
  top: calc(100% + 6px);
  width: 90px;
  font-family:
    "PingFang SC",
    -apple-system,
    "system-ui",
    "Helvetica Neue",
    Helvetica,
    sans-serif;
  line-height: 13.2px;
}

.itab-native .itab-native-widget.is-daily-quote.size-1-2 > .widget-title,
.itab-native .itab-native-widget.is-daily-quote.size-2-2 > .widget-title {
  width: 180px;
}

.itab-native .itab-native-widget.is-daily-quote.size-2-4 > .widget-title {
  width: 360px;
}

.itab-native .itab-native-widget.is-poem > .widget-card {
  --itab-poem-card-bg: #eee;

  background: var(--itab-poem-card-bg);
  color: #333;
  box-shadow: rgba(0, 0, 0, 0.1) 0 0 5px 0;
  text-align: left;
}

.itab-native .itab-native-widget.is-poem.size-1-1 > .widget-card {
  --itab-poem-card-bg: rgb(9, 55, 68);
}

.itab-native .itab-native-widget.is-poem.size-2-2 > .widget-card,
.itab-native .itab-native-widget.is-poem.size-2-4 > .widget-card {
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 10px 0;
}

.itab-native .itab-native-widget.is-poem > .widget-title {
  width: 90px;
}

.itab-native .itab-native-widget.is-poem.size-1-2 > .widget-title,
.itab-native .itab-native-widget.is-poem.size-2-2 > .widget-title {
  width: 180px;
}

.itab-native .itab-native-widget.is-poem.size-2-4 > .widget-title {
  width: 360px;
}

.itab-native .itab-native-widget.is-wooden-fish > .widget-card {
  padding: 17px 12px;
  background: #f4f0e9;
  color: #ac7452;
  text-align: left;
}

.itab-native .itab-native-widget.is-clock > .widget-card {
  display: block;
  background: #111;
  color: #fff;
  font-size: 21px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
  font-family:
    HarmonyOS_Sans,
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
}

.itab-native .itab-native-widget.is-clock.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-clock.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-clock.size-2-1 > .widget-card {
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
}

.itab-native .itab-native-widget.is-clock > .widget-title {
  top: calc(100% + 6px);
  width: calc(100% + 30px);
}

.itab-native .itab-native-widget.is-speed-test > .widget-card {
  display: block;
  background: rgb(28, 33, 50);
}

.itab-native .itab-native-widget.is-speed-test > .widget-card img,
.itab-native .itab-native-widget.is-gradient > .widget-card img {
  display: block;
  width: 100%;
  height: 100%;
  background-color: #fff;
  object-fit: contain;
}

.itab-native .itab-native-widget.is-speed-test > .widget-card img {
  background-color: rgb(28, 33, 50);
}

.itab-native .itab-native-widget.is-speed-test.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-speed-test.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-speed-test.size-2-1 > .widget-card {
  box-shadow: rgba(0, 0, 0, 0.1) 0 0 5px 0;
}

.itab-native .itab-native-widget.is-speed-test.size-2-2 > .widget-card,
.itab-native .itab-native-widget.is-speed-test.size-2-4 > .widget-card {
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 10px 0;
}

.itab-native .itab-native-widget.is-today-english > .widget-card {
  padding: 0;
  background: #000;
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 10px 0;
  text-align: left;
}

.itab-native .itab-native-widget.is-today-english.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-today-english.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-today-english.size-2-1 > .widget-card {
  box-shadow: rgba(0, 0, 0, 0.1) 0 0 5px 0;
}

.itab-native .itab-native-widget.is-eat-today > .widget-card {
  display: block;
  background: #fff;
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 10px 0;
  color: rgb(34, 34, 34);
}

.itab-native .itab-native-widget.is-eat-today.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-eat-today.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-eat-today.size-2-1 > .widget-card {
  box-shadow: rgba(0, 0, 0, 0.1) 0 0 5px 0;
}

.itab-native .itab-native-widget.is-wallpaper > .widget-card {
  display: block;
  padding: 0;
  background-image: var(
    --wallpaper-image,
    url("https://cn.bing.com//th?id=OHR.BumbleBee_ZH-CN6429376340_1920x1080.jpg&rf=LaDigue_1920x1080.jpg&pid=hp&w=360&h=202")
  );
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 10px 0;
  color: #fff;
  text-align: left;
}

.itab-native .itab-native-widget.is-wallpaper.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-wallpaper.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-wallpaper.size-2-1 > .widget-card {
  box-shadow: rgba(0, 0, 0, 0.1) 0 0 5px 0;
}

.itab-native .itab-native-widget.is-todo > .widget-card {
  display: block;
  padding: 0;
  background: #fff;
  color: rgba(0, 0, 0, 0.8);
  font-size: 21px;
  line-height: 31.5px;
  text-align: left;
}

.itab-native .itab-native-widget.is-todo.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-todo.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-todo.size-2-1 > .widget-card,
.itab-native .itab-native-widget.is-todo.size-2-4 > .widget-card {
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
}

.itab-native .itab-native-widget.is-todo.size-2-2 > .widget-card {
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
}

.itab-native .itab-native-widget.is-stock > .widget-card,
.itab-native .itab-native-widget.is-exchange-rate > .widget-card {
  padding: 13px;
  background: #fff;
  color: #3f4854;
  text-align: left;
}

.itab-native .itab-native-widget.is-exchange-rate > .widget-card > small {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #9aa3ad;
  font-size: 11px;
}

.itab-native .itab-native-widget.is-gradient > .widget-card {
  background: #fff;
}

.itab-native .itab-native-widget.is-gradient > .widget-card img {
  background-color: #fff;
}

.itab-native .itab-native-widget.is-gradient.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-gradient.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-gradient.size-2-1 > .widget-card,
.itab-native .itab-native-widget.is-gradient.size-2-4 > .widget-card {
  box-shadow: rgba(0, 0, 0, 0.1) 0 0 5px 0;
}

.itab-native .itab-native-widget.is-gradient.size-2-2 > .widget-card {
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 10px 0;
}

.itab-native .itab-native-widget.is-habit > .widget-card {
  padding: 16px;
  background: #fff;
  color: #425266;
  text-align: left;
}

.itab-native .itab-native-widget.is-tomato > .widget-card {
  display: block;
  background: #000;
}

.itab-native .itab-native-widget.is-tomato.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-tomato.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-tomato.size-2-1 > .widget-card {
  box-shadow: rgba(0, 0, 0, 0.1) 0 0 5px 0;
}

.itab-native .itab-native-widget.is-tomato.size-2-2 > .widget-card,
.itab-native .itab-native-widget.is-tomato.size-2-4 > .widget-card {
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 10px 0;
}

.itab-native .itab-native-widget.is-world-clock > .widget-card {
  padding: 13px 15px;
  background: rgba(13, 17, 22, 0.88);
  text-align: left;
}

.itab-native .itab-native-widget.is-converter > .widget-card {
  display: block;
  padding: 0;
  background: #000 url("https://go.itab.link/assets/bg-CJNxJb1Y.jpg")
    center/cover no-repeat;
  color: #fff;
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  text-align: center;
}

.itab-native .itab-native-widget.is-converter.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-converter.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-converter.size-2-1 > .widget-card {
  box-shadow: rgba(0, 0, 0, 0.1) 0 0 5px 0;
}

.itab-native .itab-native-widget.is-converter.size-2-2 > .widget-card,
.itab-native .itab-native-widget.is-converter.size-2-4 > .widget-card {
  box-shadow: rgba(0, 0, 0, 0.3) 0 0 10px 0;
}
</style>
