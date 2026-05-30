<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";
import { ITAB_POEM_ICON_URL, useItabPoemRuntime } from "./useItabPoemRuntime";
import type { ItabPoemWidgetData } from "./itabPoemTypes";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: ItabWidgetSizeKey;
  refreshToken?: number;
}>();

const emit = defineEmits<{
  updateData: [data: ItabPoemWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useItabPoemRuntime(widgetRef, (data) =>
  emit("updateData", data),
);
const lastRefreshToken = ref(props.refreshToken ?? 0);

onMounted(() => {
  runtime.ensureLoaded();
});

onBeforeUnmount(() => {
  runtime.dispose();
});

watch(
  () => props.refreshToken,
  (value) => {
    const token = value ?? 0;
    if (token === lastRefreshToken.value) return;
    lastRefreshToken.value = token;
    void runtime.refreshPoem();
  },
);
</script>

<template>
  <span
    class="itab-poem-widget"
    data-itab-poem-widget
    :data-itab-poem-size="sizeKey"
    :data-itab-poem-source-status="runtime.sourceStatus.value"
    :style="runtime.paletteStyle.value"
  >
    <span
      class="poem-icon-content"
      :class="`is-poem-size-${sizeKey.replace('x', '-')}`"
    >
      <img v-if="sizeKey === '1x1'" alt="今日诗词" :src="ITAB_POEM_ICON_URL" />
      <template v-else>
        <svg class="poem-wave" viewBox="0 0 700 226" aria-hidden="true">
          <title>画板</title>
          <path
            d="M1310.09105,191.626557 C1496.65509,191.626557 1770.14929,157.346326 1920,106.258614 L1920,226.585567 C1920,226.585567 57.7507064,226.769694 1.29607535,226.778064 L0,226.778064 C0.301412873,150.421181 0.452119309,112.242739 0.452119309,112.242739 C402.829314,254.28206 430.581953,106.258614 671.986104,106.258614 C913.390256,106.258614 1123.52701,191.626557 1310.09105,191.626557 Z"
            fill="var(--poem-wave-base)"
            fill-opacity="0.6"
          />
          <path
            d="M0.0139194415,226.56425 C0.0139194415,207.632936 0.00602482649,190.017506 -0.00976440346,173.717958 C-0.00976440346,173.717958 64.0945019,127.498953 182.10043,132.182456 C300.106358,136.865959 566.945531,199.128662 690.656287,199.128662 C926.193135,199.128662 1181.88325,106.258614 1429.28183,106.258614 C1676.68041,106.258614 1762.21292,199.128662 1920,132.182456 C1920,132.182456 1920,163.707219 1920,226.756746 L1918.70393,226.756746 C1862.24971,226.748377 0.0139194415,226.56425 0.0139194415,226.56425 Z"
            fill="var(--poem-wave-base)"
            fill-opacity="0.6"
          />
          <path
            d="M1463.25587,166.368856 C1551.98939,166.368856 1579.00033,142.163535 1682.98644,125.993122 C1786.97255,109.822709 1903.42761,144.008202 1920,142.125085 L1920,226.246611 C1920,226.246611 57.7382953,226.430738 1.31380552,226.439107 L0,226.439107 C0.875870348,212.023153 1.31380552,204.815176 1.31380552,204.815176 C1.31380552,204.815176 171.201223,92.2827368 319.815615,99.6364213 C498.755382,108.490655 535.30872,172.276704 680.584032,172.276704 C825.859343,172.276704 892.163947,69.0953634 1074.42656,72.7600803 C1256.68917,76.4247971 1374.52235,166.368856 1463.25587,166.368856 Z"
            fill="var(--poem-wave-base)"
            fill-opacity="0.3"
          />
        </svg>
        <span v-if="runtime.hasContent.value" class="poem-body">
          <p class="poem-text">{{ runtime.activePoem.value.sentence }}</p>
          <small
            v-if="
              (sizeKey === '2x2' || sizeKey === '2x4') &&
              runtime.activePoem.value.poemTitle &&
              runtime.activePoem.value.author
            "
            class="poem-source"
          >
            {{ runtime.activePoem.value.poemTitle }} ·
            {{ runtime.activePoem.value.author }}
          </small>
        </span>
      </template>
    </span>
  </span>
</template>

<style scoped>
.itab-poem-widget {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.poem-icon-content,
.poem-icon-content img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.poem-icon-content {
  overflow: hidden;
  background: var(
    --itab-poem-card-bg,
    var(--poem-bg, var(--sd-theme-itab-poem-poem-widget-surface-01))
  );
}

:global([data-sd-scheme="dark"] .itab-poem-widget),
:global([data-sd-theme="dark"] .itab-poem-widget) {
  --poem-bg: var(--sd-theme-itab-poem-poem-widget-surface-01) !important;
  --poem-wave-base: color-mix(
    in srgb,
    var(--sd-state-info) 24%,
    transparent
  ) !important;
}

.poem-icon-content.is-poem-size-1-1 {
  --itab-poem-card-bg: var(--sd-theme-itab-poem-poem-widget-accent-01);
}

.poem-icon-content img {
  background: var(
    --itab-poem-card-bg,
    var(--sd-theme-itab-poem-poem-widget-accent-surface-01)
  );
  object-fit: contain;
}

.poem-wave {
  position: absolute;
  left: 0;
  width: 100%;
  height: auto;
  color: var(--sd-theme-itab-poem-poem-widget-text-01);
  pointer-events: none;
}

.is-poem-size-1-2 .poem-wave {
  top: 20px;
  height: 48px;
}

.is-poem-size-2-1 .poem-wave {
  top: 131px;
  height: 19px;
}

.is-poem-size-2-2 .poem-wave {
  top: 102px;
  height: 48px;
}

.is-poem-size-2-4 .poem-wave {
  top: 64px;
  height: 107px;
}

.poem-body {
  position: absolute;
  left: 10px;
  top: 10px;
  display: flex;
  flex-direction: column;
  width: calc(100% - 20px);
  height: calc(100% - 20px);
  align-items: stretch;
  justify-content: center;
  overflow: visible;
  color: var(--sd-theme-itab-poem-poem-widget-text-01);
}

.poem-body p {
  margin: 0;
  font-size: 13.86px;
  line-height: 20.79px;
}

.is-poem-size-1-2 .poem-body,
.is-poem-size-2-1 .poem-body {
  top: 10px;
  height: calc(100% - 20px);
}

.is-poem-size-1-2 .poem-body p {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 12.54px;
  line-height: 18.81px;
}

.is-poem-size-2-1 .poem-body p {
  display: block;
  width: 38px;
  height: 130px;
  overflow: hidden;
  font-size: 12.54px;
  line-height: 18.81px;
  writing-mode: vertical-lr;
}

.is-poem-size-2-2 .poem-body {
  justify-content: center;
}

.is-poem-size-2-4 .poem-body {
  justify-content: center;
}

.is-poem-size-2-4 .poem-body p {
  width: 310px;
  font-size: 18.06px;
  line-height: 27.09px;
}

.poem-body small {
  display: block;
  width: 100%;
  margin-top: 5px;
  overflow: hidden;
  color: var(--sd-theme-itab-poem-poem-widget-text-02);
  font-size: 11.97px;
  line-height: 17.96px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
