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
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
}

.opened-window {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 16px;
  background: rgba(250, 250, 250, 0.96);
  color: #20242c;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.38);
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
  background: #ffbf2f;
}

.traffic .green {
  background: #1bd228;
}

.traffic .red {
  background: #ff5c59;
}

.opened-window.opened-poem {
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 20px;
  background: #eee;
  color: #333;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  backdrop-filter: none;
  overflow: auto;
}

.opened-window.opened-movie {
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: #fff;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  backdrop-filter: none;
}

.opened-window.opened-converter {
  border: 1px solid rgba(0, 0, 0, 0.13);
  border-radius: 20px;
  background: #fff;
  color: #25272b;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  backdrop-filter: none;
}

.opened-window.opened-poem .traffic,
.opened-window.opened-movie .traffic,
.opened-window.opened-converter .traffic,
.opened-window.opened-today-english .traffic,
.opened-weather .traffic {
  top: 11px;
  right: 17px;
}

.opened-window.opened-poem .traffic .yellow,
.opened-window.opened-movie .traffic .yellow,
.opened-window.opened-today-english .traffic .yellow,
.opened-window.opened-calendar .traffic .yellow,
.opened-window.opened-memo .traffic .yellow,
.opened-window.opened-todo .traffic .yellow,
.opened-window.opened-tomato .traffic .yellow,
.opened-weather .traffic .yellow {
  display: none;
}

.opened-weather {
  border-radius: 20px;
  background: linear-gradient(45deg, rgb(33, 30, 34) 20%, rgb(56, 58, 62));
  color: #fff;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
  backdrop-filter: none;
}

.opened-window.opened-tomato {
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: transparent;
  color: #fff;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
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
  border: 1px solid rgba(0, 0, 0, 0.13);
  border-radius: 20px;
  color: #222;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.48);
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
  background: #fff;
}

.opened-window.opened-calendar,
.opened-window.opened-todo {
  color: #22262e;
}

.opened-window.opened-memo,
.opened-window.opened-todo {
  font-size: 14px;
  line-height: 21px;
}

.opened-window.opened-countdown {
  border: 1px solid rgba(0, 0, 0, 0.13);
  border-radius: 20px;
  background: #fff;
  color: #222;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.48);
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
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  background: rgb(21, 21, 24);
  color: rgba(255, 255, 255, 0.86);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.48);
  backdrop-filter: none;
}

.opened-window.opened-today-english {
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: #fff;
  box-shadow: rgba(0, 0, 0, 0.48) 0 12px 32px 0;
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
