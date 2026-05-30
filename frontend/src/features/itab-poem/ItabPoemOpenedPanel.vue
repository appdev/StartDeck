<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { WidgetConfig } from "@/types";
import { useItabPoemRuntime } from "./useItabPoemRuntime";
import type { ItabPoemWidgetData } from "./itabPoemTypes";

const props = defineProps<{
  widget: WidgetConfig;
}>();

const emit = defineEmits<{
  updateData: [data: ItabPoemWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useItabPoemRuntime(
  widgetRef,
  (data) => emit("updateData", data),
  {
    allowDailyPaletteRefresh: false,
  },
);
const detailRef = ref<HTMLElement | null>(null);

const scrollPoemDetail = () => {
  detailRef.value?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
};

onMounted(() => {
  runtime.ensureLoaded();
});

onBeforeUnmount(() => {
  runtime.dispose();
});
</script>

<template>
  <div
    class="itab-poem-opened-panel"
    data-itab-poem-opened-panel
    data-grid-drag-ignore="true"
    :style="runtime.paletteStyle.value"
  >
    <div class="opened-poem-wrap">
      <section class="opened-poem-hero">
        <div class="opened-poem-quotes">
          <template v-if="runtime.hasContent.value">
            <h2>{{ runtime.activePoem.value.sentence }}</h2>
            <p>
              出自 {{ runtime.activePoem.value.dynasty }}⋅
              {{ runtime.activePoem.value.author }} 的《{{
                runtime.activePoem.value.poemTitle
              }}》
            </p>
          </template>
          <button
            type="button"
            :disabled="runtime.loading.value"
            @click="runtime.refreshPoem"
          >
            换一句
          </button>
        </div>
        <svg
          class="opened-poem-waves"
          width="700"
          height="226"
          viewBox="0 0 700 226"
          aria-hidden="true"
        >
          <title>画板</title>
          <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
            <path
              d="M1310.09105,191.626557 C1496.65509,191.626557 1770.14929,157.346326 1920,106.258614 L1920,226.585567 C1920,226.585567 57.7507064,226.769694 1.29607535,226.778064 L0,226.778064 C0.301412873,150.421181 0.452119309,112.242739 0.452119309,112.242739 C402.829314,254.28206 430.581953,106.258614 671.986104,106.258614 C913.390256,106.258614 1123.52701,191.626557 1310.09105,191.626557 Z"
              fill="var(--poem-wave-back, var(--sd-itab-poem-wave-back))"
              fill-opacity="0.6"
            />
            <path
              d="M0.0139194415,226.56425 C0.0139194415,207.632936 0.00602482649,190.017506 -0.00976440346,173.717958 C-0.00976440346,173.717958 64.0945019,127.498953 182.10043,132.182456 C300.106358,136.865959 566.945531,199.128662 690.656287,199.128662 C926.193135,199.128662 1181.88325,106.258614 1429.28183,106.258614 C1676.68041,106.258614 1762.21292,199.128662 1920,132.182456 C1920,132.182456 1920,163.707219 1920,226.756746 L1918.70393,226.756746 C1862.24971,226.748377 0.0139194415,226.56425 0.0139194415,226.56425 Z"
              fill="var(--poem-wave-middle, var(--sd-itab-poem-wave-middle))"
              fill-opacity="0.6"
            />
            <path
              d="M1463.25587,166.368856 C1551.98939,166.368856 1579.00033,142.163535 1682.98644,125.993122 C1786.97255,109.822709 1903.42761,144.008202 1920,142.125085 L1920,226.246611 C1920,226.246611 57.7382953,226.430738 1.31380552,226.439107 L0,226.439107 C0.875870348,212.023153 1.31380552,204.815176 1.31380552,204.815176 C1.31380552,204.815176 171.201223,92.2827368 319.815615,99.6364213 C498.755382,108.490655 535.30872,172.276704 680.584032,172.276704 C825.859343,172.276704 892.163947,69.0953634 1074.42656,72.7600803 C1256.68917,76.4247971 1374.52235,166.368856 1463.25587,166.368856 Z"
              fill="var(--poem-wave-front, var(--sd-itab-poem-wave-front))"
              fill-opacity="0.3"
            />
          </g>
        </svg>
        <button
          class="opened-poem-chevron"
          type="button"
          aria-label="查看全文"
          @click="scrollPoemDetail"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6.7 9.3 12 14.6l5.3-5.3 1.4 1.4-6.7 6.7-6.7-6.7z" />
          </svg>
        </button>
      </section>

      <section
        v-if="runtime.hasContent.value"
        ref="detailRef"
        class="opened-poem-detail"
      >
        <article class="opened-poem-card">
          <h3>全文</h3>
          <h4>{{ runtime.activePoem.value.poemTitle }}</h4>
          <p class="opened-poem-author">
            {{ runtime.activePoem.value.dynasty }}⋅
            {{ runtime.activePoem.value.author }}
          </p>
          <div>
            <p
              v-for="(line, index) in runtime.activePoem.value.fullText"
              :key="`full-${index}-${line}`"
              class="opened-poem-line"
            >
              {{ line }}
            </p>
          </div>
        </article>

        <article class="opened-poem-card">
          <div class="opened-poem-block opened-poem-block-indented">
            <h3>译文</h3>
            <p
              v-for="(line, index) in runtime.activePoem.value.translation"
              :key="`translation-${index}-${line}`"
            >
              {{ line }}
            </p>
            <p v-if="runtime.activePoem.value.translation.length === 0">
              暂无译文
            </p>
          </div>
        </article>

        <article class="opened-poem-card">
          <h3>注释</h3>
          <p
            v-for="(line, index) in runtime.activePoem.value.annotations"
            :key="`annotation-${index}-${line}`"
          >
            {{ line }}
          </p>
          <p v-if="runtime.activePoem.value.annotations.length === 0">
            暂无注释
          </p>
        </article>

        <article class="opened-poem-card">
          <h3>序</h3>
          <p
            v-for="(line, index) in runtime.activePoem.value.preface"
            :key="`preface-${index}-${line}`"
            class="opened-poem-preface"
          >
            {{ line }}
          </p>
          <p
            v-if="runtime.activePoem.value.preface.length === 0"
            class="opened-poem-preface"
          >
            暂无序文
          </p>
        </article>
      </section>
    </div>
  </div>
</template>

<style scoped>
.itab-poem-opened-panel {
  position: relative;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(
    --poem-bg,
    var(--sd-theme-itab-poem-poem-opened-panel-surface-01)
  );
  color: var(--sd-theme-itab-poem-poem-opened-panel-text-01);
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Helvetica Neue",
    sans-serif;
  scrollbar-width: none;
}

.itab-poem-opened-panel::-webkit-scrollbar {
  display: none;
}

:global([data-sd-scheme="dark"] .itab-poem-opened-panel),
:global([data-sd-theme="dark"] .itab-poem-opened-panel) {
  --poem-bg: var(
    --sd-theme-itab-poem-poem-opened-panel-surface-01
  ) !important;
  --poem-wave-back: color-mix(
    in srgb,
    var(--sd-state-info) 18%,
    transparent
  ) !important;
  --poem-wave-middle: color-mix(
    in srgb,
    var(--sd-state-info) 22%,
    transparent
  ) !important;
  --poem-wave-front: color-mix(
    in srgb,
    var(--sd-state-info) 26%,
    transparent
  ) !important;
}

.opened-poem-wrap {
  position: relative;
  width: 100%;
  min-height: 100%;
  overflow: visible;
  color: var(--sd-theme-itab-poem-poem-opened-panel-text-01);
}

.opened-poem-hero {
  position: relative;
  z-index: 2;
  min-height: 550px;
  box-sizing: border-box;
  overflow: visible;
  text-align: left;
}

.opened-poem-quotes {
  position: relative;
  z-index: 2;
  box-sizing: border-box;
  min-height: 303px;
  padding: 154px 30px 0;
  overflow: hidden;
  text-align: center;
}

.opened-poem-quotes h2 {
  margin: 0;
  color: var(--sd-theme-itab-poem-poem-opened-panel-text-01);
  font-family: KaiTi, STKaiti, "Kaiti SC", serif;
  font-size: 36px;
  font-weight: 400;
  line-height: 54px;
}

.opened-poem-quotes p {
  margin: 0 0 20px;
  color: var(--sd-theme-itab-poem-poem-opened-panel-text-02);
  font-size: 14px;
  line-height: 21px;
}

.opened-poem-quotes button:not(.opened-poem-chevron) {
  width: 100px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--sd-theme-itab-poem-poem-opened-panel-border-01);
  border-radius: 5px;
  background: var(--sd-theme-itab-poem-poem-opened-panel-surface-02);
  color: var(--sd-theme-itab-poem-poem-opened-panel-text-01);
  font-size: 13px;
  line-height: 32px;
}

.opened-poem-quotes button:not(.opened-poem-chevron):hover {
  background: var(--sd-theme-itab-poem-poem-opened-panel-surface-03);
}

.opened-poem-hero button:disabled {
  cursor: default;
  opacity: 0.58;
}

.opened-poem-waves {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  width: 100%;
  height: auto;
  pointer-events: none;
}

.opened-poem-detail {
  position: relative;
  z-index: 1;
  max-width: 700px;
  margin: 120px auto 0;
  padding: 0 0 50px;
  color: var(--sd-theme-itab-poem-poem-opened-panel-text-03);
  line-height: 1.6;
  text-align: start;
}

.opened-poem-card {
  width: 700px;
  box-sizing: border-box;
  margin: 0 0 50px;
  padding: 20px;
  overflow: hidden;
  border: 1px solid var(--sd-theme-itab-poem-poem-opened-panel-border-02);
  border-radius: 4px;
  background: var(--sd-theme-itab-poem-poem-opened-panel-surface-04);
  box-shadow: none;
}

.opened-poem-detail h3 {
  margin: 0 0 20px;
  color: var(--sd-theme-itab-poem-poem-opened-panel-text-03);
  font-size: 20px;
  font-weight: 400;
  line-height: 32px;
}

.opened-poem-detail h4 {
  margin: 0;
  color: var(--sd-theme-itab-poem-poem-opened-panel-text-03);
  font-size: 14px;
  font-weight: 700;
  line-height: 22.4px;
}

.opened-poem-author {
  margin: 0 0 20px;
  color: var(--sd-theme-itab-poem-poem-opened-panel-text-04);
  font-size: 12px;
  line-height: 19.2px;
}

.opened-poem-detail p {
  margin: 0 0 20px;
  color: var(--sd-theme-itab-poem-poem-opened-panel-text-03);
  font-size: 14px;
  line-height: 22.4px;
}

.opened-poem-detail .opened-poem-line {
  margin-bottom: 10px;
}

.opened-poem-block {
  margin: 0 0 50px;
  text-align: left;
}

.opened-poem-block-indented p,
.opened-poem-preface {
  text-indent: 2em;
}

.opened-poem-chevron {
  position: absolute;
  left: 50%;
  top: 500px;
  z-index: 4;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--sd-theme-itab-poem-poem-opened-panel-text-05);
  transform: translateX(-50%);
}

.opened-poem-chevron svg {
  display: block;
  width: 24px;
  height: 24px;
  fill: currentColor;
}
</style>
