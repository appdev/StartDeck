<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import {
  resolveItabReplicaOpenedShell,
  resolveItabReplicaOpenedShellStyle,
  type ItabReplicaOpenedShellOverride,
  type ItabReplicaWidgetKind,
} from "../itab-widgets/itabWidgetContract";

type OpenedShellWidget = {
  id: string;
  kind: ItabReplicaWidgetKind;
  openedShell?: ItabReplicaOpenedShellOverride;
};

const props = defineProps<{
  widget: OpenedShellWidget;
  instanceOverride?: ItabReplicaOpenedShellOverride;
  callerOverride?: ItabReplicaOpenedShellOverride;
}>();

const emit = defineEmits<{
  requestClose: [];
}>();

defineSlots<{
  default(props: { requestClose: () => void }): unknown;
}>();

const resolvedInstanceOverride = computed(
  () => props.instanceOverride ?? props.widget.openedShell,
);
const resolvedShell = computed(() =>
  resolveItabReplicaOpenedShell(
    props.widget.kind,
    resolvedInstanceOverride.value,
    props.callerOverride,
  ),
);
const resolvedShellStyle = computed(() => {
  const style = resolveItabReplicaOpenedShellStyle(
    props.widget.kind,
    resolvedInstanceOverride.value,
    props.callerOverride,
  );

  return `width: ${style.width}; height: ${style.height};`;
});
const openedPanelClass = computed(() => [
  `opened-${props.widget.kind}`,
  `opened-widget-${props.widget.id}`,
]);
const openedWindowRef = ref<HTMLElement | null>(null);

watchEffect(() => {
  openedWindowRef.value?.setAttribute("style", resolvedShellStyle.value);
});

const requestClose = () => {
  emit("requestClose");
};
</script>

<template>
  <div
    class="itab-native-panel"
    :class="`itab-native-panel--${props.widget.kind}`"
    role="dialog"
    aria-modal="true"
    @click.self="requestClose"
  >
    <section
      ref="openedWindowRef"
      class="opened-window"
      :class="openedPanelClass"
      @click.stop
    >
      <div v-if="resolvedShell.trafficVisible" class="traffic">
        <button class="yellow" type="button" aria-label="minimize"></button>
        <button class="green" type="button" aria-label="maximize"></button>
        <button
          class="red"
          type="button"
          aria-label="close"
          @click="requestClose"
        ></button>
      </div>
      <slot :request-close="requestClose"></slot>
    </section>
  </div>
</template>

<style scoped>
.itab-native-panel {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  background: var(--sd-theme-itab-live-live-opened-shell-surface-01);
  backdrop-filter: blur(10px);
}

.itab-native-panel.itab-native-panel--weather {
  backdrop-filter: none;
}

.opened-window {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--sd-theme-itab-live-live-opened-shell-border-01);
  border-radius: 16px;
  background: var(--sd-theme-itab-live-live-opened-shell-surface-02);
  color: var(--sd-theme-itab-live-live-opened-shell-accent-text-01);
  box-shadow: 0 30px 80px var(--sd-theme-itab-live-live-opened-shell-shadow-01);
  backdrop-filter: blur(26px);
}

.traffic {
  position: absolute;
  top: 11px;
  right: 18px;
  z-index: 3;
  display: flex;
  gap: 12px;
}

.traffic button {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 999px;
}

.traffic .yellow {
  background: var(--sd-theme-itab-live-live-opened-shell-accent-surface-01);
}

.traffic .green {
  background: var(--sd-theme-itab-live-live-opened-shell-accent-surface-02);
}

.traffic .red {
  background: var(--sd-theme-itab-live-live-opened-shell-accent-surface-03);
}

.opened-window.opened-poem {
  border: 1px solid var(--sd-theme-itab-live-live-opened-shell-border-02);
  border-radius: 20px;
  background: var(--sd-theme-itab-live-live-opened-shell-surface-03);
  color: var(--sd-theme-itab-live-live-opened-shell-text-01);
  box-shadow: var(--sd-theme-itab-live-live-opened-shell-shadow-02) 0 12px 32px
    0;
  backdrop-filter: none;
  overflow: auto;
}

.opened-window.opened-movie {
  box-sizing: border-box;
  border: 1px solid var(--sd-theme-itab-live-live-opened-shell-border-02);
  border-radius: 20px;
  background: transparent;
  color: var(--sd-theme-itab-live-live-opened-shell-text-02);
  box-shadow: var(--sd-theme-itab-live-live-opened-shell-shadow-02) 0 12px 32px
    0;
  backdrop-filter: none;
}

.opened-window.opened-daily-quote {
  box-sizing: border-box;
  width: min(860px, calc(100vw - 42px));
  height: min(552px, calc(100vh - 64px));
  border: 1px solid var(--sd-theme-itab-live-live-opened-shell-border-02);
  border-radius: 20px;
  background: transparent;
  color: var(--sd-theme-itab-live-live-opened-shell-text-02);
  box-shadow: var(--sd-theme-itab-live-live-opened-shell-shadow-02) 0 12px 32px
    0;
  backdrop-filter: none;
}

.opened-window.opened-converter {
  border: 1px solid var(--sd-theme-itab-live-live-opened-shell-border-03);
  border-radius: 20px;
  background: var(--sd-theme-itab-live-live-opened-shell-surface-04);
  color: var(--sd-theme-itab-live-live-opened-shell-text-03);
  box-shadow: var(--sd-theme-itab-live-live-opened-shell-shadow-02) 0 12px 32px
    0;
  backdrop-filter: none;
}

.opened-window.opened-eat-today {
  border: 0;
  border-radius: 20px;
  background: var(--sd-theme-itab-live-live-opened-shell-surface-05);
  color: var(--sd-theme-itab-live-live-opened-shell-text-04);
  box-shadow: var(--sd-theme-itab-live-live-opened-shell-shadow-02) 0 12px 32px
    0;
  backdrop-filter: none;
}

.opened-window.opened-widget-ip-30 {
  border: 0;
  border-radius: 20px;
  background: var(--sd-theme-itab-live-live-opened-shell-surface-04);
  color: var(--sd-theme-itab-live-live-opened-shell-text-03);
  box-shadow: var(--sd-theme-itab-live-live-opened-shell-shadow-02) 0 12px 32px
    0;
  backdrop-filter: none;
}

.opened-window.opened-wallpaper {
  border: 1px solid var(--sd-theme-itab-live-live-opened-shell-border-04);
  border-radius: 20px;
  background: var(--sd-theme-itab-live-live-opened-shell-surface-06);
  color: var(--sd-theme-itab-live-live-opened-shell-text-05);
  box-shadow: var(--sd-theme-itab-live-live-opened-shell-shadow-02) 0 12px 32px
    0;
  backdrop-filter: blur(28px);
}

.opened-window.opened-poem .traffic,
.opened-window.opened-movie .traffic,
.opened-window.opened-daily-quote .traffic,
.opened-window.opened-converter .traffic,
.opened-window.opened-eat-today .traffic,
.opened-window.opened-widget-ip-30 .traffic,
.opened-window.opened-wallpaper .traffic,
.opened-window.opened-today-english .traffic,
.opened-weather .traffic {
  top: 11px;
  right: 17px;
}

.opened-window.opened-poem .traffic .yellow,
.opened-window.opened-movie .traffic .yellow,
.opened-window.opened-daily-quote .traffic .yellow,
.opened-window.opened-wallpaper .traffic .yellow,
.opened-window.opened-eat-today .traffic .yellow,
.opened-window.opened-widget-ip-30 .traffic .yellow,
.opened-window.opened-today-english .traffic .yellow,
.opened-window.opened-calendar .traffic .yellow,
.opened-window.opened-memo .traffic .yellow,
.opened-window.opened-todo .traffic .yellow,
.opened-window.opened-tomato .traffic .yellow,
.opened-weather .traffic .yellow {
  display: none;
}

.opened-window.opened-widget-ip-30 .traffic .yellow {
  display: none;
}

.opened-window.opened-eat-today .traffic .yellow {
  display: none;
}

.opened-weather {
  border: 1px solid var(--sd-theme-itab-live-live-opened-shell-border-03);
  border-radius: 20px;
  background: transparent;
  color: var(--sd-theme-itab-live-live-opened-shell-text-02);
  box-shadow: var(--sd-theme-itab-live-live-opened-shell-shadow-02) 0 12px 32px
    0;
  backdrop-filter: none;
}

.opened-window.opened-tomato {
  box-sizing: border-box;
  border: 1px solid var(--sd-theme-itab-live-live-opened-shell-border-05);
  border-radius: 20px;
  background: transparent;
  color: var(--sd-theme-itab-live-live-opened-shell-text-02);
  box-shadow: var(--sd-theme-itab-live-live-opened-shell-shadow-02) 0 12px 32px
    0;
  backdrop-filter: none;
}

.opened-window.opened-tomato .traffic {
  top: 11px;
  right: 17px;
  z-index: 4;
  display: flex;
}

.opened-window.opened-tomato .traffic button {
  display: block;
}

.opened-window.opened-clock,
.opened-window.opened-calendar,
.opened-window.opened-memo,
.opened-window.opened-todo {
  border: 1px solid var(--sd-theme-itab-live-live-opened-shell-border-03);
  border-radius: 20px;
  color: var(--sd-theme-itab-live-live-opened-shell-text-06);
  box-shadow: 0 12px 32px var(--sd-theme-itab-live-live-opened-shell-shadow-02);
  backdrop-filter: none;
  overflow: auto;
}

.opened-window.opened-clock {
  background: transparent;
  animation: clock-dialog-in 180ms cubic-bezier(0.2, 0, 0, 1);
}

.opened-window.opened-calendar,
.opened-window.opened-memo,
.opened-window.opened-todo {
  background: var(--sd-theme-itab-live-live-opened-shell-surface-04);
}

.opened-window.opened-calendar,
.opened-window.opened-todo {
  color: var(--sd-theme-itab-live-live-opened-shell-accent-text-02);
}

.opened-window.opened-memo,
.opened-window.opened-todo {
  font-size: 14px;
  line-height: 21px;
}

.opened-window.opened-countdown {
  border: 1px solid var(--sd-theme-itab-live-live-opened-shell-border-03);
  border-radius: 20px;
  background: var(--sd-theme-itab-live-live-opened-shell-surface-04);
  color: var(--sd-theme-itab-live-live-opened-shell-text-06);
  box-shadow: 0 12px 32px var(--sd-theme-itab-live-live-opened-shell-shadow-02);
  backdrop-filter: none;
  overflow: auto;
  font-size: 14px;
  line-height: 21px;
}

.opened-window.opened-countdown .traffic {
  top: 11px;
  right: 17px;
}

.opened-window.opened-anniversary,
.opened-window.opened-anniversary-day {
  border: 1px solid var(--sd-theme-itab-live-live-opened-shell-border-06);
  border-radius: 20px;
  background: var(--sd-theme-itab-live-live-opened-shell-surface-09);
  color: var(--sd-theme-itab-live-live-opened-shell-text-07);
  box-shadow: 0 12px 32px var(--sd-theme-itab-live-live-opened-shell-shadow-02);
  backdrop-filter: none;
}

.opened-window.opened-today-english {
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: var(--sd-theme-itab-live-live-opened-shell-text-02);
  box-shadow: var(--sd-theme-itab-live-live-opened-shell-shadow-02) 0 12px 32px
    0;
  backdrop-filter: none;
}

@keyframes clock-dialog-in {
  from {
    opacity: 0;
    transform: scale(0.985);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
