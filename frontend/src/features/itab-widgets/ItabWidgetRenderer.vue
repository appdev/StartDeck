<script setup lang="ts">
import { computed } from "vue";
import type { WidgetConfig } from "@/types";
import ItabWidgetShell from "@/features/itab-widgets/ItabWidgetShell.vue";
import {
  resolveItabWidgetViewModel,
  type ItabWidgetViewModel,
} from "@/features/itab-widgets/itabAdapters";
import {
  resolveItabWidgetEntry,
  type ItabDataKind,
} from "@/features/itab-widgets/itabWidgetRegistry";
import {
  toItabWidgetSizeKey,
  type ItabWidgetSizeKey,
} from "@/features/itab-widgets/itabSizePresets";
import { getItabCaptureLayout } from "@/features/itab-widgets/itabCaptureLayout";
import {
  getItabRuntimeResources,
  resolveItabResourceUrlById,
  validateItabDynamicBindings,
  type ItabRenderMode,
} from "@/features/itab-widgets/itabDynamicBindings";
import type { ItabCaptureLayoutElement } from "@/features/itab-widgets/itabCaptureLayout";
import {
  getItabCloneSkin,
  getItabSemanticExpectation,
  resolveItabMode,
  type ItabDataMode,
  type ItabVisualMode,
} from "@/features/itab-widgets/itabCloneSkin";

const props = withDefaults(
  defineProps<{
    widget?: WidgetConfig;
    type?: string;
    sizeKey?: ItabWidgetSizeKey;
    preview?: boolean;
    isEditMode?: boolean;
    isDragging?: boolean;
    isResizing?: boolean;
    renderMode?: ItabRenderMode;
    visualMode?: ItabVisualMode;
    dataMode?: ItabDataMode;
    qaMode?: boolean;
    qaOverlay?: boolean;
  }>(),
  {
    preview: false,
    isEditMode: false,
    isDragging: false,
    isResizing: false,
    renderMode: "live",
    qaMode: false,
    qaOverlay: false,
  },
);

const emit = defineEmits<{
  openPanel: [
    payload: {
      widgetId?: string;
      type: string;
      captureIndex: number;
      element: HTMLElement;
    },
  ];
}>();

const widgetLike = computed<Pick<WidgetConfig, "type" | "data">>(() => ({
  type: props.widget?.type || props.type || "",
  data: props.widget?.data,
}));

const entry = computed(() => resolveItabWidgetEntry(widgetLike.value.type));
const mode = computed(() =>
  resolveItabMode({
    renderMode: props.renderMode,
    visualMode: props.visualMode,
    dataMode: props.dataMode,
  }),
);
const vm = computed<ItabWidgetViewModel | undefined>(() => {
  const resolved = resolveItabWidgetViewModel(widgetLike.value);
  if (resolved) return resolved;
  const fallback = entry.value;
  if (!fallback) return undefined;
  return resolveItabWidgetViewModel({
    type: fallback.type,
    data: {
      itab: {
        captureIndex: fallback.captureIndex,
        catalogId: fallback.id,
      },
    },
  });
});

const sizeKey = computed<ItabWidgetSizeKey>(() => {
  if (props.sizeKey) return props.sizeKey;
  const fromWidget = toItabWidgetSizeKey({
    colSpan: props.widget?.w ?? props.widget?.colSpan,
    rowSpan: props.widget?.h ?? props.widget?.rowSpan,
  });
  return fromWidget || entry.value?.defaultSize || "2x2";
});

const visualGroupByKind: Record<ItabDataKind, string> = {
  weather: "weather",
  calendar: "calendar",
  hotsearch: "feed",
  countdown: "countdown",
  memo: "note",
  movieCalendar: "movieCalendar",
  offwork: "countdown",
  nextHoliday: "countdown",
  dailyQuote: "quote",
  poem: "quote",
  woodenFish: "ritual",
  clock: "clock",
  speedTest: "metric",
  dailyEnglish: "quote",
  foodPicker: "tool",
  wallpaper: "wallpaper",
  todo: "note",
  stock: "metric",
  game2048: "game",
  qwertyLearner: "qwerty",
  exchangeRate: "metric",
  gradient: "creative",
  habit: "note",
  timestamp: "tool",
  pomodoro: "countdown",
  ipLookup: "metric",
  worldClock: "clock",
  avatarGenerator: "creative",
  relativeCalculator: "tool",
  converterSuite: "tool",
  numberUppercase: "tool",
};

const visualGroup = computed(() => {
  const kind = vm.value?.fixture.kind;
  return kind ? visualGroupByKind[kind] : "tool";
});

const isCompact = computed(() => sizeKey.value === "1x1");
const isHorizontal = computed(
  () => sizeKey.value === "1x2" || sizeKey.value === "2x4",
);
const isVertical = computed(() => sizeKey.value === "2x1");
const isWide = computed(() => sizeKey.value === "2x4");

const visibleLines = computed(() => {
  const lines = vm.value?.lines || [];
  if (sizeKey.value === "1x1") return lines.slice(0, 1);
  if (sizeKey.value === "1x2" || sizeKey.value === "2x1")
    return lines.slice(0, 2);
  if (sizeKey.value === "2x2") return lines.slice(0, 3);
  return lines.slice(0, 5);
});

const compactText = computed(() => {
  if (!vm.value) return "";
  if (visualGroup.value === "calendar") return "周三 20";
  if (visualGroup.value === "weather") return "龙华 25°";
  if (visualGroup.value === "feed") return "热搜";
  if (visualGroup.value === "clock") return vm.value.hero;
  if (visualGroup.value === "game") return "2048";
  return vm.value.hero;
});

const movieCalendarDay = computed(() => vm.value?.hero.split(/\s+/)[0] || "");
const movieCalendarMonth = computed(
  () => vm.value?.hero.split(/\s+/).slice(1).join(" ") || "",
);

const rankRows = computed(() =>
  visibleLines.value.map((line, index) => ({ line, rank: index + 1 })),
);
const gameCells = computed(() => [2, 4, 8, 16, 32, 64, 128, 256]);
const captureLayout = computed(() => {
  if (!entry.value) return undefined;
  return getItabCaptureLayout(entry.value.captureIndex, sizeKey.value);
});
const cloneSkin = computed(() =>
  entry.value && mode.value.visualMode === "clone-skin"
    ? getItabCloneSkin(entry.value.type, "body", sizeKey.value)
    : undefined,
);
const semanticExpectation = computed(() =>
  entry.value
    ? getItabSemanticExpectation(entry.value.type, "body", sizeKey.value)
    : undefined,
);
const bodyActionHotspots = computed(() =>
  (semanticExpectation.value?.requiredHotspots || []).filter(
    (item: { hotspotId: string }) => item.hotspotId !== "root-open",
  ),
);
const qaSuppressionProbes = [
  { id: "edit", className: "widget-move-handle", action: "edit-affordance" },
  {
    id: "resize",
    className: "widget-resize-grip",
    action: "resize-affordance",
  },
  { id: "drag", className: "widget-move-handle", action: "drag-affordance" },
  { id: "context", className: "context-menu-probe", action: "context-menu" },
  { id: "size-strip", className: "widget-size-strip", action: "size-strip" },
  {
    id: "form-control",
    className: "form-control-probe",
    action: "form-control",
  },
];
const runtimeResources = computed(() =>
  entry.value
    ? getItabRuntimeResources(entry.value.type, props.renderMode, {
        state: "body",
        sizeKey: sizeKey.value,
      })
    : [],
);
const bindingStatus = computed(() =>
  validateItabDynamicBindings(props.renderMode, entry.value?.type),
);
const semanticSlotText = (index: number) => {
  if (!vm.value) return "";
  const values = [
    vm.value.hero,
    vm.value.subline,
    vm.value.meta,
    ...vm.value.lines,
    ...vm.value.chips,
  ];
  return values[index % Math.max(values.length, 1)] || vm.value.entry.title;
};

const visualResourceStyle = (element: ItabCaptureLayoutElement) => {
  const resourceUrl = resolveItabResourceUrlById(
    element.resourceRef,
    props.renderMode,
  );
  if (!resourceUrl) return element.style;
  return {
    ...element.style,
    backgroundImage: `url("${resourceUrl}")`,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
  };
};
</script>

<template>
  <ItabWidgetShell
    v-if="entry && vm"
    :type="entry.type"
    :widget-id="widget?.id"
    :title="entry.title"
    :capture-index="entry.captureIndex"
    :size-key="sizeKey"
    :is-edit-mode="isEditMode"
    :is-dragging="isDragging"
    :is-resizing="isResizing"
    :visual-mode="mode.visualMode"
    :data-mode="mode.dataMode"
    :skin-id="cloneSkin?.skinId"
    @open-panel="emit('openPanel', $event)"
  >
    <div
      v-if="captureLayout"
      :class="[
        captureLayout.className,
        {
          'has-capture-images': captureLayout.images.length > 0,
          'has-capture-text': captureLayout.texts.length > 0,
          'is-capture-media-only': captureLayout.texts.length === 0,
          'has-clone-skin': Boolean(cloneSkin),
          'has-qa-markers': qaOverlay,
        },
      ]"
      :style="captureLayout.rootStyle"
      :data-itab-render-mode="renderMode"
      :data-itab-component-id="entry.type"
      :data-itab-capture-index="entry.captureIndex"
      data-itab-state="body"
      :data-itab-size-key="sizeKey"
      :data-itab-visual-mode="mode.visualMode"
      :data-itab-data-mode="mode.dataMode"
      :data-itab-qa-overlay="qaOverlay ? 'markers' : 'clean'"
      :data-itab-skin-id="cloneSkin?.skinId"
      :data-itab-resource-policy="bindingStatus.ok ? 'ok' : 'invalid'"
      :data-itab-resource-count="runtimeResources.length"
    >
      <img
        v-if="cloneSkin"
        class="itab-clone-skin-layer"
        :src="cloneSkin.assetUrl"
        :width="cloneSkin.outerRect.width"
        :height="cloneSkin.outerRect.height"
        :alt="`${entry.title} clone skin`"
        draggable="false"
        aria-hidden="true"
      />
      <div
        v-for="layer in captureLayout.layers"
        :key="layer.key"
        :class="layer.className"
        :style="visualResourceStyle(layer)"
        :data-visual-resource-id="layer.resourceRef"
        aria-hidden="true"
      ></div>
      <div
        v-for="image in captureLayout.images"
        :key="image.key"
        :class="image.className"
        :style="visualResourceStyle(image)"
        :data-visual-resource-id="image.resourceRef"
        aria-hidden="true"
      ></div>
      <span
        v-for="text in captureLayout.texts"
        :key="text.key"
        :class="text.className"
        :style="text.style"
        :data-itab-semantic-slot-id="`capture-${text.key}`"
        :data-itab-field-binding-id="`${entry.type}.body.capture-${text.key}`"
        >{{ text.text }}</span
      >
      <span
        v-for="(slot, index) in semanticExpectation?.requiredSlots || []"
        :key="slot.slotId"
        class="itab-semantic-slot"
        :style="{
          left: `${slot.rect.x - 8}px`,
          top: `${slot.rect.y - 8}px`,
          width: `${slot.rect.width}px`,
          height: `${slot.rect.height}px`,
        }"
        :role="slot.role"
        :aria-label="slot.accessibleName || semanticSlotText(index)"
        :data-itab-semantic-slot-id="slot.slotId"
        :data-itab-field-binding-id="slot.fieldBindingId"
        >{{ semanticSlotText(index) }}</span
      >
      <button
        v-for="hotspot in bodyActionHotspots"
        :key="hotspot.hotspotId"
        type="button"
        class="itab-body-hotspot"
        data-itab-inner-control
        :data-itab-hotspot-id="hotspot.hotspotId"
        :data-itab-action="hotspot.expectedAction"
        :style="{
          left: `${hotspot.rect.x - 8}px`,
          top: `${hotspot.rect.y - 8}px`,
          width: `${hotspot.rect.width}px`,
          height: `${hotspot.rect.height}px`,
        }"
        @click.stop
      >
        {{ vm.entry.glyph }}
      </button>
      <button
        v-for="(probe, index) in qaMode ? qaSuppressionProbes : []"
        :key="probe.id"
        type="button"
        class="itab-qa-suppression-probe"
        :class="probe.className"
        data-itab-inner-control
        :data-itab-qa-suppression="probe.id"
        :data-itab-hotspot-id="`qa-suppression-${probe.id}`"
        :data-itab-action="probe.action"
        :style="{
          left: `${6 + index * 9}px`,
          top: `${Math.max(6, (captureLayout?.base.height || 60) - 12)}px`,
          width: '8px',
          height: '8px',
        }"
      >
        {{ probe.id }}
      </button>
    </div>

    <div
      v-else
      class="itab-card"
      :class="[
        `is-${visualGroup}`,
        `is-kind-${vm.fixture.kind}`,
        `is-size-${sizeKey}`,
        {
          'is-compact': isCompact,
          'is-horizontal': isHorizontal,
          'is-vertical': isVertical,
          'is-wide': isWide,
          'is-preview': preview,
        },
      ]"
      :style="{ '--itab-accent': vm.fixture.accent }"
    >
      <template v-if="isCompact && visualGroup !== 'movieCalendar'">
        <span class="compact-mark" aria-hidden="true"></span>
        <strong>{{ compactText }}</strong>
      </template>

      <template v-else-if="visualGroup === 'weather'">
        <div class="weather-sky" aria-hidden="true"><i /><i /><i /></div>
        <div class="weather-top">
          <span>{{ vm.hero }}</span>
          <em>小雨</em>
        </div>
        <div class="weather-bottom">
          <span>{{ vm.subline }}</span>
          <span>{{ vm.meta }}</span>
        </div>
      </template>

      <template v-else-if="visualGroup === 'calendar'">
        <div class="calendar-band">{{ isWide ? "2026年5月" : "五月" }}</div>
        <div class="calendar-date">20</div>
        <div class="calendar-info">
          <span>周三</span>
          <span>第140天</span>
          <span>四月初四</span>
        </div>
      </template>

      <template v-else-if="visualGroup === 'feed'">
        <div class="feed-tabs">
          <span>百度</span><span>微博</span><span>抖音</span>
        </div>
        <div class="feed-list">
          <p v-for="row in rankRows" :key="row.line">
            <b>{{ row.rank }}</b
            ><span>{{ row.line }}</span>
          </p>
        </div>
      </template>

      <template v-else-if="visualGroup === 'countdown'">
        <div class="countdown-main">
          <span>{{ vm.subline }}</span>
          <strong>{{ vm.hero }}</strong>
          <em>{{ vm.meta }}</em>
        </div>
        <div class="countdown-track">
          <i :style="{ width: `${Math.round(vm.progress * 100)}%` }" />
        </div>
        <div class="countdown-list">
          <span v-for="line in visibleLines" :key="line">{{ line }}</span>
        </div>
      </template>

      <template v-else-if="visualGroup === 'note'">
        <div class="note-title">{{ vm.hero }}</div>
        <div class="note-lines">
          <p v-for="line in visibleLines" :key="line"><i />{{ line }}</p>
        </div>
      </template>

      <template v-else-if="visualGroup === 'movieCalendar'">
        <div class="movie-calendar-bg" aria-hidden="true"></div>
        <div v-if="isCompact" class="movie-calendar-icon-card">
          <span class="movie-calendar-icon-date">{{ movieCalendarDay }}</span>
        </div>
        <div v-else class="movie-calendar-content">
          <div
            v-if="sizeKey === '2x2' || sizeKey === '2x4'"
            class="movie-calendar-date"
          >
            <strong>{{ movieCalendarDay }}</strong>
            <span>{{ movieCalendarMonth }}</span>
          </div>
          <div class="movie-calendar-copy">
            <strong>《{{ vm.lines[0] || vm.entry.title }}》</strong>
            <span class="movie-calendar-rating">{{ vm.subline }}</span>
            <p>{{ vm.meta }}</p>
          </div>
        </div>
      </template>

      <template v-else-if="visualGroup === 'quote'">
        <div class="quote-symbol">“</div>
        <strong>{{ vm.hero }}</strong>
        <span>{{ vm.subline }}</span>
        <em>{{ vm.meta }}</em>
      </template>

      <template v-else-if="visualGroup === 'ritual'">
        <div class="fish-bowl"><span>木</span></div>
        <strong>{{ vm.hero }}</strong>
        <span>{{ vm.subline }}</span>
      </template>

      <template v-else-if="visualGroup === 'clock'">
        <div class="clock-face">
          <strong>{{ vm.hero }}</strong>
          <span>{{ vm.subline }}</span>
        </div>
        <div class="clock-zones">
          <span v-for="line in visibleLines" :key="line">{{ line }}</span>
        </div>
      </template>

      <template v-else-if="visualGroup === 'metric'">
        <div class="metric-head">
          <strong>{{ vm.hero }}</strong>
          <span>{{ vm.subline }}</span>
        </div>
        <div class="metric-list">
          <p v-for="line in visibleLines" :key="line">
            <span>{{ line }}</span
            ><b />
          </p>
        </div>
      </template>

      <template v-else-if="visualGroup === 'game'">
        <div class="game-head">
          <strong>2048</strong><span>Score 2048</span>
        </div>
        <div class="game-grid">
          <span v-for="cell in gameCells" :key="cell">{{ cell }}</span>
        </div>
      </template>

      <template v-else-if="visualGroup === 'qwerty'">
        <div class="qwerty-word">{{ vm.hero }}</div>
        <div class="qwerty-sub">{{ vm.subline }}</div>
        <div class="qwerty-keys"><i v-for="key in 9" :key="key" /></div>
      </template>

      <template v-else-if="visualGroup === 'wallpaper'">
        <div class="wallpaper-photo"></div>
        <div class="wallpaper-caption">
          <strong>{{ vm.hero }}</strong>
          <span>{{ vm.subline }}</span>
        </div>
      </template>

      <template v-else-if="visualGroup === 'creative'">
        <div
          v-if="vm.fixture.kind === 'gradient'"
          class="creative-gradient-only"
          aria-label="渐变色"
        ></div>
        <template v-else>
          <div class="creative-symbol">{{ vm.entry.glyph }}</div>
          <strong>{{ vm.hero }}</strong>
          <span>{{ vm.subline }}</span>
        </template>
      </template>

      <template v-else>
        <div class="tool-head">
          <strong>{{ vm.hero }}</strong>
          <span>{{ vm.subline }}</span>
        </div>
        <div class="tool-buttons">
          <span v-for="chip in vm.chips.slice(0, isWide ? 4 : 3)" :key="chip">{{
            chip
          }}</span>
        </div>
        <div class="tool-lines">
          <span v-for="line in visibleLines" :key="line">{{ line }}</span>
        </div>
      </template>
    </div>
  </ItabWidgetShell>
</template>

<style scoped>
.itab-card {
  --itab-accent: #4f46e5;
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 18px;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Helvetica Neue",
    sans-serif;
  letter-spacing: 0;
}

.itab-capture-card {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #fff;
  color: #111827;
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Helvetica Neue",
    sans-serif;
  letter-spacing: 0;
}

.itab-capture-card.has-clone-skin {
  overflow: visible;
}

.itab-clone-skin-layer {
  position: absolute;
  left: -8px;
  top: -8px;
  z-index: 20;
  display: block;
  width: calc(100% + 16px);
  height: calc(100% + 16px);
  max-width: none;
  object-fit: fill;
  pointer-events: none;
  user-select: none;
}

.capture-layer,
.capture-image,
.capture-text,
.itab-semantic-slot,
.itab-body-hotspot {
  position: absolute;
  box-sizing: border-box;
  min-width: 0;
  margin: 0;
}

.capture-layer,
.capture-image,
.capture-text {
  pointer-events: none;
}

.capture-layer {
  z-index: 1;
}

.capture-image {
  z-index: 2;
  display: block;
  overflow: hidden;
}

.capture-text {
  z-index: 3;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.itab-semantic-slot {
  z-index: 30;
  overflow: hidden;
  color: #fff;
  font-size: 12px;
  line-height: 14px;
  white-space: nowrap;
  pointer-events: none;
}

.itab-body-hotspot {
  z-index: 35;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.16);
  color: currentColor;
  padding: 0;
}

.itab-qa-suppression-probe {
  position: absolute;
  z-index: 36;
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.24);
  color: transparent;
  padding: 0;
}

.has-clone-skin .itab-semantic-slot {
  border: 0;
  background: transparent;
  color: transparent;
  font-size: 0;
  opacity: 1;
  padding: 0;
}

.has-clone-skin .itab-body-hotspot,
.has-clone-skin .itab-qa-suppression-probe {
  border: 0;
  background: transparent;
  color: transparent;
  font-size: 0;
  opacity: 1;
}

.has-clone-skin.has-qa-markers .itab-semantic-slot::after,
.has-clone-skin.has-qa-markers .itab-body-hotspot::after,
.has-clone-skin.has-qa-markers .itab-qa-suppression-probe::after {
  position: absolute;
  left: 0;
  top: 0;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.78);
  content: "";
}

.capture-text.d-elip,
.capture-text.whitespace-nowrap,
.capture-text.overflow-hidden {
  white-space: nowrap !important;
}

.capture-text.b,
.capture-text.font-bold {
  font-weight: 700 !important;
}

.capture-text.weekend,
.capture-text .weekend {
  color: #ff5a5d !important;
}

.capture-layer.top-tag.active,
.capture-layer.money,
.capture-layer.eat-button {
  background: rgba(255, 255, 255, 0.2);
}

.capture-layer.eat-button {
  background: linear-gradient(135deg, #fb7185, #f97316);
}

.capture-layer.icon-index,
.capture-layer.d-felx-center,
.capture-layer.d-flex-center {
  display: grid;
  place-items: center;
}

.capture-image::before,
.capture-image::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.is-capture-0,
.is-capture-19 {
  background:
    radial-gradient(
      circle at 78% 22%,
      rgba(255, 255, 255, 0.2),
      transparent 18%
    ),
    linear-gradient(180deg, #154280, #071326 78%) !important;
}

.is-capture-19 {
  background:
    radial-gradient(
      circle at 38% 34%,
      rgba(143, 172, 115, 0.36),
      transparent 28%
    ),
    radial-gradient(
      circle at 70% 18%,
      rgba(192, 210, 166, 0.18),
      transparent 24%
    ),
    linear-gradient(180deg, rgba(21, 40, 32, 0.72), rgba(21, 38, 35, 0.92)),
    #172a24 !important;
}

.is-capture-19::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    linear-gradient(
      110deg,
      transparent 0 8%,
      rgba(255, 255, 255, 0.18) 9%,
      transparent 10% 42%,
      rgba(255, 255, 255, 0.12) 43%,
      transparent 44%
    ),
    repeating-linear-gradient(
      100deg,
      transparent 0 16px,
      rgba(255, 255, 255, 0.08) 17px,
      transparent 19px
    );
  opacity: 0.75;
}

.is-capture-19 .capture-layer {
  background: transparent !important;
}

.is-capture-19 .capture-text {
  color: #fff !important;
  overflow: visible !important;
  text-overflow: clip !important;
}

.is-capture-0 .capture-image:not(.app-item-img)::before,
.is-capture-19 .capture-image:not(.app-item-img)::before {
  inset: 12% 8%;
  background:
    linear-gradient(
      115deg,
      transparent 10%,
      rgba(255, 255, 255, 0.65) 12%,
      transparent 15%
    ),
    linear-gradient(
      115deg,
      transparent 42%,
      rgba(255, 255, 255, 0.5) 44%,
      transparent 47%
    ),
    rgba(255, 255, 255, 0.12);
}

.is-capture-2,
.is-capture-23 {
  background:
    radial-gradient(
      circle at 18% 18%,
      rgba(88, 107, 255, 0.42),
      transparent 34%
    ),
    radial-gradient(
      circle at 84% 76%,
      rgba(233, 90, 118, 0.24),
      transparent 36%
    ),
    #111522 !important;
}

.is-capture-3 {
  background:
    linear-gradient(135deg, rgba(67, 56, 202, 0.75), rgba(15, 23, 42, 0.92)),
    #1f2937 !important;
}

.is-capture-7 {
  background:
    radial-gradient(
      circle at 12% 20%,
      rgba(255, 255, 255, 0.12),
      transparent 26%
    ),
    linear-gradient(135deg, #253447, #0f172a) !important;
}

.is-capture-11 {
  background: #f1f1f1 !important;
}

.is-capture-11 .capture-image::before {
  inset: 8%;
  border-radius: 48% 52% 44% 56%;
  background:
    radial-gradient(
      circle at 42% 36%,
      rgba(241, 196, 125, 0.95),
      transparent 18%
    ),
    radial-gradient(circle at 52% 58%, rgba(164, 95, 39, 0.9), transparent 36%),
    linear-gradient(135deg, #8b4b22, #d39a53);
  box-shadow: inset 0 10px 18px rgba(255, 255, 255, 0.25);
}

.is-capture-12,
.is-capture-35 {
  background: #111 !important;
}

.is-capture-12 .capture-text {
  display: none;
}

.is-capture-12::before,
.is-capture-12::after {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 4;
  color: #fff;
  text-align: center;
  pointer-events: none;
}

.is-capture-12::before {
  content: "16:06:08";
  top: 42%;
  transform: translateY(-50%);
  font-size: 34px;
  font-weight: 700;
  line-height: 1;
}

.is-capture-12::after {
  content: "05/20 周三";
  top: 58%;
  font-size: 16px;
  line-height: 24px;
}

.is-capture-12.is-capture-size-1x1::before {
  content: "16:06";
  top: 43%;
  font-size: 18px;
}

.is-capture-12.is-capture-size-1x1::after,
.is-capture-12.is-capture-size-1x2::after,
.is-capture-12.is-capture-size-2x1::after {
  font-size: 11px;
  line-height: 16px;
}

.is-capture-12.is-capture-size-1x2::before,
.is-capture-12.is-capture-size-2x1::before {
  content: "16:06";
  font-size: 24px;
}

.is-capture-13,
.is-capture-30 {
  background: linear-gradient(135deg, #3f68ff, #3867f4) !important;
}

.is-capture-13 .capture-image.app-item-img::before {
  inset: 18% 16%;
  border: 2px solid rgba(75, 255, 211, 0.45);
  border-bottom-color: transparent;
  border-radius: 999px 999px 18px 18px;
}

.is-capture-30 .capture-image.app-item-img {
  background: linear-gradient(135deg, #3f68ff, #3867f4) !important;
}

.is-capture-30 .capture-image.app-item-img::before {
  inset: calc(50% - 12px) auto auto calc(50% - 10px);
  width: 20px;
  height: 24px;
  border-radius: 999px 999px 999px 0;
  background: #fff;
  transform: rotate(-45deg);
}

.is-capture-30 .capture-image.app-item-img::after {
  inset: calc(50% - 4px) auto auto calc(50% - 4px);
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #3f68ff;
}

.is-capture-16,
.is-capture-25 {
  background: #fff !important;
}

.is-capture-16 .capture-image.app-item-img,
.is-capture-25 .capture-image.app-item-img {
  background: #fff !important;
  border-radius: 0 !important;
}

.is-capture-16 .capture-image.app-item-img::before,
.is-capture-25 .capture-image.app-item-img::before {
  inset: 0;
  width: min(45%, 150px);
  height: 100%;
  margin: 0 auto;
  background:
    linear-gradient(
      135deg,
      transparent 0 48%,
      rgba(112, 224, 216, 0.92) 49% 58%,
      transparent 59%
    ),
    linear-gradient(105deg, #a8fabb, #dff69a);
  border-radius: 0 !important;
}

.is-capture-16.is-capture-size-1x1 .capture-image.app-item-img::before,
.is-capture-25.is-capture-size-1x1 .capture-image.app-item-img::before,
.is-capture-16.is-capture-size-2x1 .capture-image.app-item-img::before,
.is-capture-25.is-capture-size-2x1 .capture-image.app-item-img::before {
  width: 100%;
}

.is-capture-17::before,
.is-capture-26::before {
  content: "+";
  position: absolute;
  left: 15px;
  bottom: 19px;
  z-index: 5;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #3267ff;
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 25px;
  font-weight: 300;
  line-height: 28px;
  box-shadow: 0 4px 10px rgba(50, 103, 255, 0.28);
  pointer-events: none;
}

.is-capture-17.is-capture-size-1x1::before,
.is-capture-17.is-capture-size-1x2::before,
.is-capture-17.is-capture-size-2x1::before,
.is-capture-26.is-capture-size-1x1::before,
.is-capture-26.is-capture-size-1x2::before,
.is-capture-26.is-capture-size-2x1::before {
  width: 22px;
  height: 22px;
  left: 11px;
  bottom: 13px;
  font-size: 20px;
  line-height: 22px;
}

.is-capture-17 .capture-text.d-elip.d-layout-content,
.is-capture-26 .capture-text.d-elip.d-layout-content {
  overflow: visible !important;
}

.is-capture-17 .capture-text.d-elip.d-layout-content::before,
.is-capture-26 .capture-text.d-elip.d-layout-content::before {
  content: "";
  position: absolute;
  left: -10px;
  top: 4px;
  width: 3px;
  height: 12px;
  border-radius: 999px;
  background: #c4c4c4;
}

.is-capture-20 {
  background: #f59563 !important;
}

.is-capture-20 .capture-image.app-item-img::before {
  display: none;
}

.is-capture-20 .capture-image.app-item-img {
  background: #f59563 !important;
}

.is-capture-20::before {
  content: "2048";
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: clamp(24px, 28%, 56px);
  font-weight: 800;
  letter-spacing: 0;
  pointer-events: none;
}

.is-capture-21 {
  background:
    radial-gradient(
      circle at 74% 24%,
      rgba(59, 130, 246, 0.26),
      transparent 28%
    ),
    #111827 !important;
}

.is-capture-21 .capture-image.app-item-img::before {
  inset: 18%;
  border-radius: 16px;
  background:
    repeating-linear-gradient(
      0deg,
      transparent 0 10px,
      rgba(255, 255, 255, 0.1) 10px 12px
    ),
    #1f2937;
}

.is-capture-27,
.is-capture-33,
.is-capture-34 {
  background: #101216 !important;
}

.is-capture-27 .capture-image.app-item-img::before,
.is-capture-33 .capture-image.app-item-img::before,
.is-capture-34 .capture-image.app-item-img::before {
  inset: 18% 16%;
  border-radius: 12px;
  background:
    linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.55) 0 8%,
      transparent 8% 21%,
      rgba(255, 255, 255, 0.35) 21% 28%,
      transparent 28% 42%,
      rgba(255, 255, 255, 0.48) 42% 50%,
      transparent 50%
    ),
    repeating-linear-gradient(
      0deg,
      rgba(255, 255, 255, 0.24) 0 2px,
      transparent 2px 12px
    ),
    #101216;
}

.is-capture-34 .capture-image.app-item-img,
.is-capture-35 .capture-image.app-item-img {
  background: #101216 !important;
}

.is-capture-35::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 4;
  width: min(34%, 118px);
  height: min(18%, 42px);
  transform: translate(-50%, -50%);
  background:
    linear-gradient(#fff, #fff) 0 48% / 100% 18% no-repeat,
    linear-gradient(#fff, #fff) 0 78% / 100% 18% no-repeat,
    linear-gradient(#fff, #fff) 0 18% / 70% 18% no-repeat;
  pointer-events: none;
}

.is-capture-5,
.is-capture-28 {
  background:
    radial-gradient(
      circle at 66% 30%,
      rgba(183, 204, 208, 0.2),
      transparent 20%
    ),
    linear-gradient(
      135deg,
      rgba(18, 33, 42, 0.94),
      rgba(53, 68, 72, 0.78) 45%,
      rgba(13, 24, 30, 0.96)
    ),
    #101820 !important;
}

.is-capture-5 .capture-layer,
.is-capture-28 .capture-layer {
  background: transparent !important;
}

.is-capture-5 .capture-text,
.is-capture-28 .capture-text {
  color: rgba(255, 255, 255, 0.92) !important;
  overflow: visible !important;
  text-overflow: clip !important;
}

.is-capture-5 .capture-text.b,
.is-capture-28 .capture-text.b {
  color: #fff !important;
}

.is-capture-5 .capture-text.tag,
.is-capture-28 .capture-text.tag {
  color: #3b2b06 !important;
}

.is-capture-14 {
  background:
    radial-gradient(
      circle at 35% 60%,
      rgba(248, 109, 35, 0.28),
      transparent 28%
    ),
    radial-gradient(
      circle at 64% 36%,
      rgba(117, 63, 24, 0.22),
      transparent 28%
    ),
    #030303 !important;
}

.is-capture-14 .capture-layer {
  background: transparent !important;
}

.is-capture-14 .capture-text {
  color: #fff !important;
  overflow: visible !important;
  text-overflow: clip !important;
}

.is-capture-14 .capture-image.app-item-img {
  background:
    radial-gradient(
      circle at 34% 60%,
      rgba(255, 123, 42, 0.34),
      transparent 30%
    ),
    radial-gradient(
      circle at 58% 30%,
      rgba(128, 80, 30, 0.28),
      transparent 25%
    ),
    #030303 !important;
}

.is-capture-14.is-capture-size-1x1::before,
.is-capture-14.is-capture-size-1x2::before,
.is-capture-14.is-capture-size-2x1::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 45%;
  z-index: 4;
  width: min(32px, 42%);
  height: min(32px, 42%);
  transform: translate(-50%, -50%);
  border-radius: 6px;
  border: 2px solid rgba(255, 255, 255, 0.86);
  box-shadow: inset 0 -7px 0 rgba(255, 255, 255, 0.86);
  pointer-events: none;
}

.is-capture-32 {
  background:
    radial-gradient(circle at 50% 35%, #ffd7aa 0 16%, transparent 17%),
    radial-gradient(circle at 50% 76%, #60a5fa 0 24%, transparent 25%), #ffffff !important;
}

.is-capture-32 .capture-image.app-item-img::before {
  background:
    radial-gradient(circle at 50% 34%, #f8c894 0 16%, transparent 17%),
    radial-gradient(circle at 50% 75%, #2563eb 0 26%, transparent 27%), #fff;
}

.itab-card.is-size-2x2,
.itab-card.is-size-2x4 {
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
}

.itab-card strong,
.itab-card span,
.itab-card em,
.itab-card p {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.itab-card em {
  font-style: normal;
}

.is-compact {
  display: grid;
  place-items: center;
  padding: 8px;
  text-align: center;
  background: #fff;
  color: #111827;
}

.is-compact strong {
  position: relative;
  z-index: 1;
  max-width: 100%;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.15;
  white-space: normal;
}

.compact-mark {
  position: absolute;
  inset: 8px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--itab-accent) 14%, transparent);
}

.is-weather {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px;
  background:
    radial-gradient(
      circle at 20% 16%,
      rgba(84, 124, 189, 0.7),
      transparent 42%
    ),
    linear-gradient(180deg, #172338, #06080d 72%);
  color: white;
}

.weather-sky {
  position: absolute;
  inset: 0;
  opacity: 0.65;
}

.weather-sky::before {
  content: "";
  position: absolute;
  right: 14px;
  top: 18px;
  width: 46px;
  height: 28px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.28);
  box-shadow: -18px 8px 0 rgba(255, 255, 255, 0.18);
}

.weather-sky i {
  position: absolute;
  top: 56px;
  width: 2px;
  height: 28px;
  border-radius: 999px;
  background: rgba(147, 197, 253, 0.7);
  transform: rotate(18deg);
}

.weather-sky i:nth-child(1) {
  left: 45%;
}
.weather-sky i:nth-child(2) {
  left: 58%;
  top: 68px;
}
.weather-sky i:nth-child(3) {
  left: 70%;
}

.weather-top,
.weather-bottom,
.countdown-main,
.note-title,
.movie-calendar-bg,
.movie-calendar-content,
.movie-calendar-icon-card,
.quote-symbol,
.clock-face,
.metric-head,
.game-head,
.tool-head,
.wallpaper-caption {
  position: relative;
  z-index: 1;
}

.weather-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
  font-weight: 800;
}

.weather-top em,
.weather-bottom span {
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
}

.weather-bottom {
  display: grid;
  gap: 3px;
  font-size: 12px;
}

.is-calendar {
  display: grid;
  grid-template-rows: auto 1fr auto;
  background: #fff;
  color: #111827;
}

.calendar-band {
  background: #f24848;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  padding: 8px 10px;
}

.calendar-date {
  display: grid;
  place-items: center;
  color: #111827;
  font-size: clamp(32px, 28cqw, 78px);
  font-weight: 900;
  line-height: 1;
}

.calendar-info {
  display: flex;
  justify-content: space-around;
  gap: 4px;
  padding: 0 10px 10px;
  color: #6b7280;
  font-size: 11px;
  font-weight: 700;
}

.is-feed {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 7px;
  padding: 10px;
  background: #fff;
  color: #111827;
}

.feed-tabs {
  display: flex;
  gap: 5px;
}

.feed-tabs span {
  border-radius: 999px;
  background: #f2f3f5;
  color: #5f6570;
  font-size: 10px;
  font-weight: 800;
  padding: 4px 6px;
}

.feed-list {
  display: grid;
  align-content: start;
  gap: 5px;
  min-width: 0;
}

.feed-list p {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 5px;
  margin: 0;
  font-size: 11px;
  line-height: 1.25;
  white-space: nowrap;
}

.feed-list b {
  color: #ff4b33;
}

.is-countdown {
  display: grid;
  grid-template-rows: 1fr auto auto;
  gap: 7px;
  padding: 12px;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--itab-accent) 58%, #1f2937),
      #111827
    ),
    #111827;
  color: white;
}

.countdown-main {
  display: grid;
  align-content: center;
  gap: 3px;
}

.countdown-main strong {
  font-size: clamp(22px, 18cqw, 44px);
  line-height: 1;
}

.countdown-main span,
.countdown-main em,
.countdown-list span {
  color: rgba(255, 255, 255, 0.78);
  font-size: 11px;
}

.countdown-track {
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
}

.countdown-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: rgba(255, 255, 255, 0.82);
}

.countdown-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 10px;
}

.is-note {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 8px;
  padding: 12px;
  background: linear-gradient(180deg, #fff8cf, #fff4a8);
  color: #3a2f12;
}

.note-title {
  font-size: 14px;
  font-weight: 900;
}

.note-lines {
  display: grid;
  align-content: start;
  gap: 6px;
}

.note-lines p {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: rgba(58, 47, 18, 0.74);
  font-size: 11px;
  line-height: 1.25;
}

.note-lines i {
  width: 8px;
  height: 8px;
  border-radius: 3px;
  background: var(--itab-accent);
  flex: 0 0 auto;
}

.is-movieCalendar {
  display: block;
  padding: 10px;
  background: #4c4c3f;
  color: #f9f9f4;
}

.movie-calendar-bg {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(0deg, #4c4c3f, rgba(76, 76, 63, 0.18)),
    radial-gradient(
      circle at 65% 24%,
      rgba(255, 255, 255, 0.2),
      transparent 20%
    ),
    radial-gradient(circle at 28% 34%, rgba(15, 23, 42, 0.48), transparent 32%),
    #4c4c3f;
}

.movie-calendar-icon-card {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: #f7f2e9;
  color: #4c4c3f;
  font-size: 18px;
  font-weight: 900;
}

.movie-calendar-content {
  position: relative;
  z-index: 1;
  display: grid;
  height: 100%;
  align-content: end;
  gap: 7px;
}

.movie-calendar-date {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  justify-items: end;
  gap: 2px;
}

.movie-calendar-date strong {
  color: inherit;
  font-size: 34px;
  line-height: 1;
}

.movie-calendar-date span {
  font-size: 10px;
  line-height: 12px;
  opacity: 0.78;
}

.movie-calendar-copy {
  display: grid;
  max-width: 100%;
  gap: 5px;
}

.movie-calendar-copy strong {
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.movie-calendar-rating {
  width: fit-content;
  min-width: 49px;
  height: 12px;
  border-radius: 6px;
  background: #ffac2d;
  color: #4f0e03;
  font-size: 10px;
  line-height: 12px;
  text-align: center;
}

.movie-calendar-copy p {
  display: -webkit-box;
  margin: 0;
  color: rgba(249, 249, 244, 0.88);
  font-size: 12px;
  line-height: 18px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.is-movieCalendar.is-size-1x2 .movie-calendar-date,
.is-movieCalendar.is-size-2x1 .movie-calendar-date {
  display: none;
}

.is-movieCalendar.is-size-1x2 .movie-calendar-content {
  align-content: center;
}

.is-movieCalendar.is-size-2x1 .movie-calendar-copy strong {
  white-space: normal;
  writing-mode: vertical-lr;
}

.is-quote {
  display: grid;
  align-content: center;
  gap: 5px;
  padding: 13px;
  background: #fff;
  color: #111827;
}

.quote-symbol {
  position: absolute;
  left: 9px;
  top: -8px;
  color: color-mix(in srgb, var(--itab-accent) 20%, transparent);
  font-size: 70px;
  line-height: 1;
}

.is-quote strong {
  position: relative;
  z-index: 1;
  font-size: clamp(15px, 8cqw, 25px);
  line-height: 1.25;
  white-space: normal;
}

.is-quote span,
.is-quote em {
  color: #6b7280;
  font-size: 11px;
}

.is-ritual {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  background: radial-gradient(circle, #f5d68a, #8b5a2b);
  color: #3b240d;
  text-align: center;
  padding: 10px;
}

.fish-bowl {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
  box-shadow: inset 0 -8px 18px rgba(72, 40, 12, 0.26);
  font-weight: 900;
}

.is-clock {
  display: grid;
  align-content: center;
  gap: 9px;
  padding: 13px;
  background: #111827;
  color: white;
}

.clock-face strong {
  display: block;
  font-size: clamp(25px, 18cqw, 48px);
  line-height: 1;
}

.clock-face span,
.clock-zones span {
  color: rgba(255, 255, 255, 0.68);
  font-size: 11px;
}

.clock-zones {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 10px;
}

.is-metric {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 9px;
  padding: 12px;
  background: #fff;
  color: #111827;
}

.metric-head strong {
  display: block;
  font-size: 18px;
  line-height: 1.05;
}

.metric-head span {
  color: #ef4444;
  font-size: 12px;
  font-weight: 800;
}

.metric-list {
  display: grid;
  gap: 6px;
}

.metric-list p {
  display: grid;
  grid-template-columns: 1fr 34px;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: #475569;
  font-size: 11px;
}

.metric-list b {
  height: 5px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--itab-accent), transparent);
}

.is-game {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 8px;
  padding: 10px;
  background: #bbada0;
  color: #776e65;
}

.game-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  font-weight: 900;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}

.game-grid span {
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: #eee4da;
  color: #776e65;
  font-size: 10px;
  font-weight: 900;
}

.is-qwerty {
  display: grid;
  align-content: center;
  gap: 8px;
  padding: 12px;
  background: linear-gradient(135deg, #312e81, #4f46e5);
  color: white;
}

.qwerty-word {
  font-size: 20px;
  font-weight: 900;
}

.qwerty-sub {
  color: rgba(255, 255, 255, 0.72);
  font-size: 11px;
}

.qwerty-keys {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 3px;
}

.qwerty-keys i {
  height: 12px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.28);
}

.is-wallpaper {
  background: #111827;
  color: white;
}

.wallpaper-photo {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 28% 35%, #fde68a 0 10%, transparent 12%),
    radial-gradient(circle at 62% 38%, #f59e0b 0 8%, transparent 10%),
    linear-gradient(135deg, #166534, #65a30d 44%, #0f172a);
}

.wallpaper-caption {
  position: absolute;
  inset-inline: 10px;
  bottom: 10px;
  display: grid;
  gap: 3px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.55);
}

.wallpaper-caption strong {
  font-size: 15px;
}

.wallpaper-caption span {
  color: rgba(255, 255, 255, 0.78);
  font-size: 11px;
}

.is-tool {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 8px;
  padding: 12px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--itab-accent) 20%, white),
    #fff
  );
  color: #111827;
}

.is-creative {
  display: grid;
  place-items: center;
  padding: 0;
  background: #fff;
  color: #334155;
}

.creative-gradient-only {
  position: absolute;
  inset: 0;
  background: #fff url("/itab-live-assets/web-gradients.svg") center/contain
    no-repeat;
}

.creative-symbol {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.55);
  color: #0f172a;
  font-weight: 900;
  font-size: 22px;
}

.is-creative strong,
.is-creative span {
  position: relative;
  z-index: 1;
}

.tool-head strong {
  display: block;
  font-size: 18px;
  line-height: 1.1;
}

.tool-head span,
.tool-lines span {
  color: rgba(17, 24, 39, 0.66);
  font-size: 11px;
}

.is-creative .tool-head span,
.is-creative .tool-lines span {
  color: rgba(255, 255, 255, 0.78);
}

.tool-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.tool-buttons span {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  color: #111827;
  font-size: 10px;
  font-weight: 800;
  padding: 4px 7px;
}

.tool-lines {
  display: grid;
  align-content: start;
  gap: 4px;
}

.is-size-1x2 {
  grid-template-columns: 1fr 1fr;
}

.is-size-2x1 .feed-tabs,
.is-size-2x1 .calendar-info,
.is-size-2x1 .tool-buttons {
  flex-direction: column;
}

.is-wide.is-feed .feed-list,
.is-wide.is-metric .metric-list,
.is-wide.is-tool .tool-lines {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
</style>
