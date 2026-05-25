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
  box-shadow: 0 12px 26px var(--sd-theme-itab-live-live-widget-frame-shadow-01);
}

.itab-native .itab-native-widget > .widget-title {
  position: absolute;
  top: calc(100% + 5px);
  left: 50%;
  width: max(88px, 100%);
  overflow: hidden;
  color: var(--sd-theme-itab-live-live-widget-frame-text-01);
  font-size: 12px;
  line-height: 15px;
  text-overflow: ellipsis;
  text-shadow: 0 1px 7px var(--sd-theme-itab-live-live-widget-frame-shadow-02);
  transform: translateX(-50%);
  white-space: nowrap;
}

.itab-native .itab-native-widget.size-1-1 > .widget-card {
  display: grid;
  place-items: center;
  background: var(--sd-theme-itab-live-live-widget-frame-surface-01);
  backdrop-filter: blur(8px);
}

.itab-native .itab-native-widget.is-tool-icon > .widget-card {
  display: grid;
  place-items: center;
  background: var(--sd-theme-itab-live-live-widget-frame-surface-02);
}

.itab-native .itab-native-widget.is-tool-icon > .widget-card img {
  width: 76px;
  height: 76px;
  object-fit: contain;
}

.itab-native .itab-native-widget.widget-ip-30 > .widget-card {
  display: block;
  background: transparent;
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-03) 0 0 5px 0;
  backdrop-filter: none;
}

.itab-native .itab-native-widget.widget-ip-30.size-2-2 > .widget-card {
  background: var(--sd-theme-itab-live-live-widget-frame-accent-surface-01);
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-04) 0 0 10px 0;
}

.itab-native .itab-native-widget.widget-ip-30.size-2-4 > .widget-card {
  background: var(--sd-theme-itab-live-live-widget-frame-accent-surface-01);
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-04) 0 0 10px 0;
}

.itab-native .itab-native-widget.widget-ip-30 > .widget-card img {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--sd-theme-itab-live-live-widget-frame-accent-surface-01);
  object-fit: contain;
}

.itab-native .itab-native-widget.is-shell-contract-invalid > .widget-card {
  display: grid;
  place-items: center;
  padding: 10px;
  background: var(--sd-theme-itab-live-live-widget-frame-accent-surface-02);
  color: var(--sd-theme-itab-live-live-widget-frame-text-01);
  box-shadow:
    0 0 0 1px var(--sd-theme-itab-live-live-widget-frame-shadow-05),
    0 12px 26px var(--sd-theme-itab-live-live-widget-frame-shadow-06);
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
  color: var(--sd-theme-itab-live-live-widget-frame-text-02);
  font-size: 10px;
  line-height: 13px;
}

.itab-native .itab-native-widget.is-weather > .widget-card {
  border-radius: 18px;
  background: transparent;
  color: var(--sd-theme-itab-live-live-widget-frame-text-01);
  box-shadow: 0 0 5px var(--sd-theme-itab-live-live-widget-frame-shadow-03);
  text-align: left;
}

.itab-native .itab-native-widget.is-weather:hover > .widget-card {
  box-shadow: 0 0 10px var(--sd-theme-itab-live-live-widget-frame-shadow-04);
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
  background: var(--sd-theme-itab-live-live-widget-frame-surface-03);
  color: var(--sd-theme-itab-live-live-widget-frame-text-03);
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
  box-shadow: 0 0 5px var(--sd-theme-itab-live-live-widget-frame-shadow-03);
}

.itab-native .itab-native-widget.is-calendar.size-2-2 > .widget-card,
.itab-native .itab-native-widget.is-calendar.size-2-4 > .widget-card {
  box-shadow: 0 0 10px var(--sd-theme-itab-live-live-widget-frame-shadow-04);
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
    var(--sd-theme-itab-live-live-widget-frame-accent-surface-03),
    var(--sd-theme-itab-live-live-widget-frame-surface-04)
  );
  color: var(--sd-theme-itab-live-live-widget-frame-text-04);
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
  background: linear-gradient(
      135deg,
      var(--sd-theme-itab-live-live-widget-frame-accent-surface-04),
      var(--sd-theme-itab-live-live-widget-frame-accent-surface-05)
    )
    center / cover;
  color: var(--sd-theme-itab-live-live-widget-frame-text-01);
  font-size: 21px;
  line-height: 1.5;
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-03) 0 0 5px 0;
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
  background: var(
    --movie-bg-color,
    var(--sd-theme-itab-live-live-widget-frame-surface-05)
  );
  color: var(
    --movie-text-color,
    var(--sd-theme-itab-live-live-widget-frame-text-05)
  );
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-03) 0 0 5px 0;
  text-align: left;
}

.itab-native .itab-native-widget.is-movie.size-2-2 > .widget-card {
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-04) 0 0 10px 0;
}

.itab-native .itab-native-widget.is-movie > .widget-card::before {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      0deg,
      var(
        --movie-bg-color,
        var(--sd-theme-itab-live-live-widget-frame-surface-05)
      ),
      var(--sd-theme-itab-live-live-widget-frame-surface-06)
    ),
    var(--movie-cover-image) center/cover;
  content: "";
}

.itab-native .itab-native-widget.is-countdown > .widget-card {
  padding: 0;
  background: var(
    --countdown-bg-color,
    var(--sd-theme-itab-live-live-widget-frame-surface-03)
  );
  color: var(
    --countdown-text-color,
    var(--sd-theme-itab-live-live-widget-frame-text-06)
  );
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-03) 0 0 5px 0;
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
  background: var(--sd-theme-itab-live-live-widget-frame-accent-surface-06);
  color: var(--sd-theme-itab-live-live-widget-frame-text-07);
  text-align: left;
}

.itab-native .itab-native-widget.is-next-holiday > .widget-card::before {
  position: absolute;
  inset: 13px;
  content: "";
  border: 1px dashed var(--sd-theme-itab-live-live-widget-frame-border-01);
  border-radius: 10px;
}

.itab-native .itab-native-widget.is-daily-quote > .widget-card {
  display: block;
  background: transparent;
  color: var(--sd-theme-itab-live-live-widget-frame-text-01);
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-03) 0 0 5px 0;
  text-align: center;
  backdrop-filter: none;
}

.itab-native .itab-native-widget.is-daily-quote.size-2-2 > .widget-card,
.itab-native .itab-native-widget.is-daily-quote.size-2-4 > .widget-card {
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-04) 0 0 10px 0;
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
  --itab-poem-card-bg: var(--sd-theme-itab-live-live-widget-frame-surface-07);

  background: var(--itab-poem-card-bg);
  color: var(--sd-theme-itab-live-live-widget-frame-text-08);
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-03) 0 0 5px 0;
  text-align: left;
}

.itab-native .itab-native-widget.is-poem.size-1-1 > .widget-card {
  --itab-poem-card-bg: var(--sd-theme-itab-live-live-widget-frame-accent-01);
}

.itab-native .itab-native-widget.is-poem.size-2-2 > .widget-card,
.itab-native .itab-native-widget.is-poem.size-2-4 > .widget-card {
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-04) 0 0 10px 0;
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
  background: var(--sd-theme-itab-live-live-widget-frame-surface-08);
  color: var(--sd-theme-itab-live-live-widget-frame-accent-text-01);
  text-align: left;
}

.itab-native .itab-native-widget.is-clock > .widget-card {
  display: block;
  background: var(--sd-theme-itab-live-live-widget-frame-surface-09);
  color: var(--sd-theme-itab-live-live-widget-frame-text-01);
  font-size: 21px;
  box-shadow: 0 0 10px var(--sd-theme-itab-live-live-widget-frame-shadow-04);
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
  box-shadow: 0 0 5px var(--sd-theme-itab-live-live-widget-frame-shadow-03);
}

.itab-native .itab-native-widget.is-clock > .widget-title {
  top: calc(100% + 6px);
  width: calc(100% + 30px);
}

.itab-native .itab-native-widget.is-speed-test > .widget-card {
  display: block;
  background: var(--sd-theme-itab-live-live-widget-frame-accent-surface-07);
}

.itab-native .itab-native-widget.is-speed-test > .widget-card img,
.itab-native .itab-native-widget.is-gradient > .widget-card img {
  display: block;
  width: 100%;
  height: 100%;
  background-color: var(--sd-theme-itab-live-live-widget-frame-surface-03);
  object-fit: contain;
}

.itab-native .itab-native-widget.is-speed-test > .widget-card img {
  background-color: var(
    --sd-theme-itab-live-live-widget-frame-accent-surface-07
  );
}

.itab-native .itab-native-widget.is-speed-test.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-speed-test.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-speed-test.size-2-1 > .widget-card {
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-03) 0 0 5px 0;
}

.itab-native .itab-native-widget.is-speed-test.size-2-2 > .widget-card,
.itab-native .itab-native-widget.is-speed-test.size-2-4 > .widget-card {
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-04) 0 0 10px 0;
}

.itab-native .itab-native-widget.is-today-english > .widget-card {
  padding: 0;
  background: var(--sd-theme-itab-live-live-widget-frame-surface-10);
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-04) 0 0 10px 0;
  text-align: left;
}

.itab-native .itab-native-widget.is-today-english.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-today-english.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-today-english.size-2-1 > .widget-card {
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-03) 0 0 5px 0;
}

.itab-native .itab-native-widget.is-eat-today > .widget-card {
  display: block;
  background: var(--sd-theme-itab-live-live-widget-frame-surface-03);
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-04) 0 0 10px 0;
  color: var(--sd-theme-itab-live-live-widget-frame-text-09);
}

.itab-native .itab-native-widget.is-eat-today.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-eat-today.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-eat-today.size-2-1 > .widget-card {
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-03) 0 0 5px 0;
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
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-04) 0 0 10px 0;
  color: var(--sd-theme-itab-live-live-widget-frame-text-01);
  text-align: left;
}

.itab-native .itab-native-widget.is-wallpaper.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-wallpaper.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-wallpaper.size-2-1 > .widget-card {
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-03) 0 0 5px 0;
}

.itab-native .itab-native-widget.is-todo > .widget-card {
  display: block;
  padding: 0;
  background: var(--sd-theme-itab-live-live-widget-frame-surface-03);
  color: var(--sd-theme-itab-live-live-widget-frame-text-10);
  font-size: 21px;
  line-height: 31.5px;
  text-align: left;
}

.itab-native .itab-native-widget.is-todo.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-todo.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-todo.size-2-1 > .widget-card,
.itab-native .itab-native-widget.is-todo.size-2-4 > .widget-card {
  box-shadow: 0 0 5px var(--sd-theme-itab-live-live-widget-frame-shadow-03);
}

.itab-native .itab-native-widget.is-todo.size-2-2 > .widget-card {
  box-shadow: 0 0 10px var(--sd-theme-itab-live-live-widget-frame-shadow-04);
}

.itab-native .itab-native-widget.is-stock > .widget-card,
.itab-native .itab-native-widget.is-exchange-rate > .widget-card {
  padding: 13px;
  background: var(--sd-theme-itab-live-live-widget-frame-surface-03);
  color: var(--sd-theme-itab-live-live-widget-frame-text-11);
  text-align: left;
}

.itab-native .itab-native-widget.is-exchange-rate > .widget-card > small {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--sd-theme-itab-live-live-widget-frame-text-12);
  font-size: 11px;
}

.itab-native .itab-native-widget.is-gradient > .widget-card {
  background: var(--sd-theme-itab-live-live-widget-frame-surface-03);
}

.itab-native .itab-native-widget.is-gradient > .widget-card img {
  background-color: var(--sd-theme-itab-live-live-widget-frame-surface-03);
}

.itab-native .itab-native-widget.is-gradient.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-gradient.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-gradient.size-2-1 > .widget-card,
.itab-native .itab-native-widget.is-gradient.size-2-4 > .widget-card {
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-03) 0 0 5px 0;
}

.itab-native .itab-native-widget.is-gradient.size-2-2 > .widget-card {
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-04) 0 0 10px 0;
}

.itab-native .itab-native-widget.is-habit > .widget-card {
  padding: 16px;
  background: var(--sd-theme-itab-live-live-widget-frame-surface-03);
  color: var(--sd-theme-itab-live-live-widget-frame-accent-text-02);
  text-align: left;
}

.itab-native .itab-native-widget.is-tomato > .widget-card {
  display: block;
  background: var(--sd-theme-itab-live-live-widget-frame-surface-10);
}

.itab-native .itab-native-widget.is-tomato.size-1-1 > .widget-card,
.itab-native .itab-native-widget.is-tomato.size-1-2 > .widget-card,
.itab-native .itab-native-widget.is-tomato.size-2-1 > .widget-card {
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-03) 0 0 5px 0;
}

.itab-native .itab-native-widget.is-tomato.size-2-2 > .widget-card,
.itab-native .itab-native-widget.is-tomato.size-2-4 > .widget-card {
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-04) 0 0 10px 0;
}

.itab-native .itab-native-widget.is-world-clock > .widget-card {
  padding: 13px 15px;
  background: var(--sd-theme-itab-live-live-widget-frame-accent-surface-08);
  text-align: left;
}

.itab-native .itab-native-widget.is-converter > .widget-card {
  display: block;
  padding: 0;
  background: var(--sd-theme-itab-live-live-widget-frame-surface-10)
    url("https://go.itab.link/assets/bg-CJNxJb1Y.jpg") center/cover no-repeat;
  color: var(--sd-theme-itab-live-live-widget-frame-text-01);
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
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-03) 0 0 5px 0;
}

.itab-native .itab-native-widget.is-converter.size-2-2 > .widget-card,
.itab-native .itab-native-widget.is-converter.size-2-4 > .widget-card {
  box-shadow: var(--sd-theme-itab-live-live-widget-frame-shadow-04) 0 0 10px 0;
}
</style>
