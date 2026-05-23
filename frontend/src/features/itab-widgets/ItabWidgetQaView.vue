<script setup lang="ts">
import ItabWidgetRenderer from "@/features/itab-widgets/ItabWidgetRenderer.vue";
import ItabWidgetPanelHost from "@/features/itab-widgets/ItabWidgetPanelHost.vue";
import { ITAB_WIDGET_REGISTRY } from "@/features/itab-widgets/itabWidgetRegistry";
import {
  ITAB_WIDGET_SIZE_CANDIDATES,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { buildItabPersistedData } from "@/features/itab-widgets/itabAdapters";
import { computed, ref } from "vue";
import type { WidgetConfig } from "@/types";
import type {
  ItabDataMode,
  ItabVisualMode,
} from "@/features/itab-widgets/itabCloneSkin";
import type { ItabWidgetRegistryEntry } from "@/features/itab-widgets/itabWidgetRegistry";

type ItabQaOverlayMode = "clean" | "markers";

const fixtureNow = "2026-05-20T23:40:00+08:00";
const openedIndex = ref<number | null>(null);
const returnFocusEl = ref<HTMLElement | null>(null);
const liveMutationLog = ref<string[]>([]);
const query = new URLSearchParams(
  typeof window === "undefined" ? "" : window.location.search,
);
const visualMode = computed<ItabVisualMode>(() =>
  query.get("visualMode") === "dom-native"
    ? "dom-native"
    : query.get("visualMode") === "panel-skin"
      ? "panel-skin"
      : "clone-skin",
);
const dataMode = computed<ItabDataMode>(() =>
  query.get("dataMode") === "live" ? "live" : "fixture",
);
const qaOverlayMode = computed<ItabQaOverlayMode>(() =>
  query.get("qaOverlay") === "markers" ? "markers" : "clean",
);
const showQaMarkers = computed(() => qaOverlayMode.value === "markers");
const referencePixels: Record<
  ItabWidgetSizeKey,
  { width: number; height: number }
> = {
  "1x1": { width: 76, height: 76 },
  "1x2": { width: 166, height: 76 },
  "2x1": { width: 76, height: 166 },
  "2x2": { width: 166, height: 166 },
  "2x4": { width: 346, height: 166 },
};

const makeWidget = (entry: ItabWidgetRegistryEntry): WidgetConfig => ({
  id: `qa-${entry.id}`,
  type: entry.type,
  enable: true,
  isPublic: true,
  colSpan: 2,
  rowSpan: 2,
  w: 2,
  h: 2,
  data: buildItabPersistedData(entry),
});

const widgets = ref<WidgetConfig[]>(ITAB_WIDGET_REGISTRY.map(makeWidget));

const widgetByCaptureIndex = computed(() => {
  const pairs = ITAB_WIDGET_REGISTRY.map(
    (entry, index) => [entry.captureIndex, widgets.value[index]] as const,
  );
  return new Map(pairs);
});

const openWidget = computed(() => {
  if (openedIndex.value === null) return null;
  return widgets.value[openedIndex.value] || null;
});

const handleOpenPanel = (payload: {
  captureIndex: number;
  element: HTMLElement;
}) => {
  openedIndex.value = payload.captureIndex;
  returnFocusEl.value = payload.element;
};

const liveMutationDomains = [
  {
    id: "weather",
    label: "Weather",
    dataKinds: ["weather"],
    token: "QA-WEATHER-31",
  },
  {
    id: "wallpaper",
    label: "Wallpaper",
    dataKinds: ["wallpaper"],
    token: "QA-WALLPAPER-AURORA",
  },
  {
    id: "movie",
    label: "Movie",
    dataKinds: ["movieCalendar"],
    token: "QA-MOVIE-NEBULA",
  },
  {
    id: "calendar",
    label: "Calendar",
    dataKinds: ["calendar", "nextHoliday"],
    token: "QA-CALENDAR-0521",
  },
  {
    id: "todo",
    label: "Todo",
    dataKinds: ["todo", "memo", "habit"],
    token: "QA-TODO-SHIPPED",
  },
  {
    id: "clock",
    label: "Clock",
    dataKinds: ["clock", "worldClock"],
    token: "QA-CLOCK-20:26",
  },
  {
    id: "rate",
    label: "Rate",
    dataKinds: ["exchangeRate"],
    token: "QA-RATE-7.31",
  },
  { id: "stock", label: "Stock", dataKinds: ["stock"], token: "QA-STOCK-1888" },
  {
    id: "countdown",
    label: "Countdown",
    dataKinds: ["countdown", "offwork", "pomodoro"],
    token: "QA-COUNTDOWN-99",
  },
  {
    id: "quote",
    label: "Quote",
    dataKinds: ["dailyEnglish", "poem"],
    token: "QA-QUOTE-VERIFIED",
  },
  {
    id: "converter",
    label: "Converter",
    dataKinds: [
      "converterSuite",
      "timestamp",
      "relativeCalculator",
      "numberUppercase",
    ],
    token: "QA-CONVERT-456",
  },
  {
    id: "tool",
    label: "Tool",
    dataKinds: [
      "woodenFish",
      "speedTest",
      "foodPicker",
      "game2048",
      "qwertyLearner",
      "gradient",
      "ipLookup",
      "avatarGenerator",
    ],
    token: "QA-TOOL-ACTION",
  },
] as const;

const mutateLiveDomain = (domain: (typeof liveMutationDomains)[number]) => {
  const entryIndex = ITAB_WIDGET_REGISTRY.findIndex((entry) =>
    (domain.dataKinds as readonly string[]).includes(entry.dataKind),
  );
  const entry = ITAB_WIDGET_REGISTRY[entryIndex];
  const widget = widgets.value[entryIndex];
  if (!entry || !widget) return;
  const state = {
    hero: domain.token,
    subline: `${entry.title} live ${domain.id}`,
    meta: `Updated ${fixtureNow}`,
    lines: [
      `${domain.token} line 1`,
      `${domain.token} line 2`,
      `${domain.token} line 3`,
    ],
    chips: [domain.label, "Live", "QA"],
    progress: 0.72,
    updatedAt: fixtureNow,
  };
  widgets.value[entryIndex] = {
    ...widget,
    data: {
      ...(widget.data || {}),
      itab: {
        ...(widget.data?.itab || {}),
        state,
      },
    },
  };
  liveMutationLog.value = [
    `${entry.captureIndex}:${domain.id}:${domain.token}`,
    ...liveMutationLog.value,
  ].slice(0, 12);
};

const sizeStyle = (sizeKey: ItabWidgetSizeKey) => {
  const size = referencePixels[sizeKey];
  return {
    width: `${size.width}px`,
    height: `${size.height}px`,
  };
};
</script>

<template>
  <main
    class="itab-qa-page"
    data-itab-qa-root
    :data-fixture-time="fixtureNow"
    :data-itab-qa-overlay="qaOverlayMode"
  >
    <header class="itab-qa-header">
      <h1>iTab widgets QA</h1>
      <p>36 entries · 5 sizes · 180 body states · 36 opened states</p>
      <div
        v-if="dataMode === 'live'"
        class="itab-qa-live-controls"
        data-itab-qa-live-controls
      >
        <button
          v-for="domain in liveMutationDomains"
          :key="domain.id"
          type="button"
          :data-itab-qa-mutate="domain.id"
          :data-itab-qa-token="domain.token"
          @click="mutateLiveDomain(domain)"
        >
          {{ domain.label }}
        </button>
        <output data-itab-qa-live-log>{{ liveMutationLog.join(" | ") }}</output>
      </div>
    </header>

    <section class="itab-qa-section" data-itab-qa-body-section>
      <article
        v-for="entry in ITAB_WIDGET_REGISTRY"
        :key="entry.id"
        class="itab-qa-entry"
        :data-capture-index="entry.captureIndex"
      >
        <h2>
          {{ String(entry.captureIndex).padStart(2, "0") }} {{ entry.title }}
        </h2>
        <div class="itab-qa-size-row">
          <div
            v-for="size in ITAB_WIDGET_SIZE_CANDIDATES"
            :key="`${entry.id}-${size.key}`"
            class="itab-qa-state"
            :style="sizeStyle(size.key)"
            :data-itab-body-state="`${entry.captureIndex}-${size.key}`"
            :data-capture-index="entry.captureIndex"
            :data-size-key="size.key"
          >
            <ItabWidgetRenderer
              :widget="widgetByCaptureIndex.get(entry.captureIndex)"
              :type="entry.type"
              :size-key="size.key"
              :render-mode="dataMode"
              :visual-mode="visualMode"
              :data-mode="dataMode"
              :qa-overlay="showQaMarkers"
              preview
              qa-mode
              @open-panel="handleOpenPanel"
            />
          </div>
        </div>
      </article>
    </section>

    <section class="itab-qa-section" data-itab-qa-open-section>
      <button
        v-for="(entry, index) in ITAB_WIDGET_REGISTRY"
        :key="`open-${entry.id}`"
        type="button"
        class="itab-qa-open-button"
        :data-itab-open-trigger="entry.captureIndex"
        @click="openedIndex = index"
      >
        打开 {{ String(entry.captureIndex).padStart(2, "0") }} {{ entry.title }}
      </button>
    </section>

    <ItabWidgetPanelHost
      :widget="openWidget"
      :return-focus-el="returnFocusEl"
      :visual-mode="visualMode"
      :data-mode="dataMode"
      :qa-overlay="showQaMarkers"
      @close="openedIndex = null"
    />
  </main>
</template>

<style scoped>
:global(*) {
  animation-duration: 0s !important;
  transition-duration: 0s !important;
}

.itab-qa-page {
  min-height: 100vh;
  background: #eef2f7;
  color: #0f172a;
  padding: 24px;
}

.itab-qa-header h1,
.itab-qa-header p,
.itab-qa-entry h2 {
  margin: 0;
}

.itab-qa-header {
  display: grid;
  gap: 6px;
  margin-bottom: 24px;
}

.itab-qa-header p {
  color: #64748b;
}

.itab-qa-live-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.itab-qa-live-controls button {
  border: 0;
  border-radius: 999px;
  background: #155e75;
  color: #fff;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 800;
}

.itab-qa-live-controls output {
  min-width: 220px;
  color: #334155;
  font-size: 12px;
}

.itab-qa-section,
.itab-qa-entry {
  display: grid;
  gap: 14px;
}

.itab-qa-entry {
  padding: 16px 0;
  border-top: 1px solid #cbd5e1;
}

.itab-qa-entry h2 {
  font-size: 16px;
}

.itab-qa-size-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
}

.itab-qa-state {
  position: relative;
  flex: 0 0 auto;
  box-sizing: border-box;
  padding: 8px;
  background:
    radial-gradient(
      circle at 18% 16%,
      rgba(75, 107, 136, 0.5),
      transparent 32%
    ),
    #070b14;
  overflow: visible;
}

.itab-qa-open-button {
  width: max-content;
  border: 0;
  border-radius: 999px;
  background: #0f172a;
  color: white;
  padding: 8px 12px;
}
</style>
