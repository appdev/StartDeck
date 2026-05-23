<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { WidgetConfig } from "@/types";
import {
  getItabPanelActions,
  resolveItabWidgetViewModel,
} from "@/features/itab-widgets/itabAdapters";
import type { ItabDataKind } from "@/features/itab-widgets/itabWidgetRegistry";
import { ITAB_INTERACTION_GEOMETRY } from "@/features/itab-widgets/generated/itabInteractionGeometry.generated";
import {
  getItabRuntimeResources,
  validateItabDynamicBindings,
} from "@/features/itab-widgets/itabDynamicBindings";
import {
  getItabCloneSkin,
  getItabSemanticExpectation,
  resolveItabMode,
  type ItabDataMode,
  type ItabVisualMode,
} from "@/features/itab-widgets/itabCloneSkin";

const props = defineProps<{
  widget: WidgetConfig | null;
  returnFocusEl?: HTMLElement | null;
  visualMode?: ItabVisualMode;
  dataMode?: ItabDataMode;
  qaOverlay?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const closeButtonRef = ref<HTMLButtonElement | null>(null);
const actionLog = ref<string[]>([]);
const textInput = ref("123.00");
const counter = ref(2);
const timerRunning = ref(false);
const gameScore = ref(2048);
const tasks = ref(["评审实现", "补充测试"]);
const vm = computed(() =>
  props.widget ? resolveItabWidgetViewModel(props.widget) : undefined,
);
const mode = computed(() =>
  resolveItabMode({
    visualMode: props.visualMode,
    dataMode: props.dataMode,
  }),
);
const actions = computed(() => (vm.value ? getItabPanelActions(vm.value) : []));
const panelGeometry = computed(() =>
  vm.value
    ? ITAB_INTERACTION_GEOMETRY.find(
        (record) => record.captureIndex === vm.value?.entry.captureIndex,
      )
    : undefined,
);
const openedResources = computed(() =>
  vm.value
    ? getItabRuntimeResources(vm.value.entry.type, "live", { state: "opened" })
    : [],
);
const bindingStatus = computed(() =>
  validateItabDynamicBindings("live", vm.value?.entry.type),
);
const cloneSkin = computed(() =>
  vm.value &&
  (mode.value.visualMode === "clone-skin" ||
    mode.value.visualMode === "panel-skin")
    ? getItabCloneSkin(vm.value.entry.type, "opened")
    : undefined,
);
const semanticExpectation = computed(() =>
  vm.value
    ? getItabSemanticExpectation(vm.value.entry.type, "opened")
    : undefined,
);
const openedPrimaryHotspot = computed(() =>
  semanticExpectation.value?.requiredHotspots.find(
    (hotspot: { hotspotId: string }) =>
      hotspot.hotspotId === "opened-primary-action",
  ),
);

const panelKindByDataKind: Record<ItabDataKind, string> = {
  weather: "weather",
  calendar: "calendar",
  hotsearch: "feed",
  countdown: "timer",
  memo: "editor",
  movieCalendar: "movieCalendar",
  offwork: "timer",
  nextHoliday: "timer",
  dailyQuote: "reader",
  poem: "reader",
  woodenFish: "counter",
  clock: "clock",
  speedTest: "metric",
  dailyEnglish: "reader",
  foodPicker: "picker",
  wallpaper: "wallpaper",
  todo: "editor",
  stock: "metric",
  game2048: "game",
  qwertyLearner: "trainer",
  exchangeRate: "converter",
  gradient: "creative",
  habit: "editor",
  timestamp: "converter",
  pomodoro: "timer",
  ipLookup: "metric",
  worldClock: "clock",
  avatarGenerator: "creative",
  relativeCalculator: "converter",
  converterSuite: "converter",
  numberUppercase: "converter",
};

const panelKind = computed(() => {
  const kind = vm.value?.fixture.kind;
  return kind ? panelKindByDataKind[kind] : "tool";
});

const px = (value: number) => `${Math.round(value * 1000) / 1000}px`;

const panelStyle = computed(() => {
  const geometry = panelGeometry.value;
  const base = vm.value ? { "--itab-accent": vm.value.fixture.accent } : {};
  if (!geometry) return base;
  return {
    ...base,
    width: `min(${px(geometry.panel.rect.width)}, calc(100vw - 80px))`,
    minHeight: `min(${px(geometry.panel.rect.height)}, calc(100vh - 96px))`,
    borderRadius:
      geometry.panel.style.borderRadius &&
      geometry.panel.style.borderRadius !== "0px"
        ? geometry.panel.style.borderRadius
        : undefined,
  };
});

const panelCropSkinStyle = computed(() => {
  const geometry = panelGeometry.value;
  const skin = cloneSkin.value;
  if (!geometry || !skin || mode.value.visualMode !== "panel-skin") return {};
  const cropX = Math.max(
    0,
    (skin.outerRect.width - geometry.panel.rect.width) / 2,
  );
  const cropY = Math.max(
    0,
    (skin.outerRect.height - geometry.panel.rect.height) / 2,
  );
  return {
    width: px(skin.outerRect.width),
    height: px(skin.outerRect.height),
    transform: `translate(${-cropX}px, ${-cropY}px)`,
  };
});

const captureElementStyle = (element: {
  rect: { x: number; y: number; w: number; h: number };
  style?: Record<string, string>;
}) => ({
  left: px(element.rect.x),
  top: px(element.rect.y),
  width: px(element.rect.w),
  height: px(element.rect.h),
  color: element.style?.color,
  background:
    element.style?.backgroundColor &&
    element.style.backgroundColor !== "rgba(0, 0, 0, 0)"
      ? element.style.backgroundColor
      : undefined,
  borderRadius: element.style?.borderRadius,
  fontSize: element.style?.fontSize,
  fontWeight: element.style?.fontWeight,
  lineHeight: element.style?.lineHeight,
  opacity: element.style?.opacity,
});

const convertedValue = computed(() => {
  const raw = Number.parseFloat(textInput.value);
  if (vm.value?.fixture.kind === "exchangeRate")
    return Number.isFinite(raw)
      ? `${(raw * 0.1466).toFixed(2)} USD`
      : "请输入数字";
  if (vm.value?.fixture.kind === "timestamp")
    return /^\d+$/.test(textInput.value)
      ? "2026-05-20 23:40:00"
      : "请输入时间戳";
  if (vm.value?.fixture.kind === "relativeCalculator")
    return textInput.value ? "姑妈" : "请输入称呼链";
  if (vm.value?.fixture.kind === "numberUppercase")
    return Number.isFinite(raw) ? "壹佰贰拾叁元整" : "请输入数字";
  return textInput.value ? "已换算" : "请输入内容";
});

watch(
  () => props.widget?.id,
  async (id) => {
    actionLog.value = [];
    timerRunning.value = false;
    if (!id) return;
    await nextTick();
    closeButtonRef.value?.focus();
  },
);

watch(
  () => Boolean(props.widget),
  (isOpen) => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("itab-panel-open", isOpen);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("itab-panel-open");
});

const close = async () => {
  emit("close");
  await nextTick();
  props.returnFocusEl?.focus?.();
};

const log = (label: string) => {
  const now = new Date("2026-05-20T23:40:00+08:00").toLocaleTimeString(
    "zh-CN",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
  actionLog.value = [`${now} ${label}`, ...actionLog.value].slice(0, 5);
};

const runAction = (label: string) => {
  if (panelKind.value === "counter" && label.includes("敲")) counter.value += 1;
  if (panelKind.value === "timer" && /开始|暂停/.test(label))
    timerRunning.value = !timerRunning.value;
  if (panelKind.value === "game" && /新局|继续/.test(label))
    gameScore.value += 128;
  if (panelKind.value === "picker" && label.includes("开始"))
    textInput.value = "牛肉面";
  log(label);
};

const addTask = () => {
  const value = textInput.value.trim();
  if (!value) return;
  tasks.value = [value, ...tasks.value].slice(0, 5);
  textInput.value = "";
  log("添加项目");
};

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
</script>

<template>
  <Teleport to="body">
    <div
      v-if="widget && vm"
      class="itab-panel-backdrop"
      :class="[
        `is-visual-${mode.visualMode}`,
        `is-data-${mode.dataMode}`,
        { 'has-qa-markers': qaOverlay },
      ]"
      data-itab-panel-backdrop
      :data-itab-visual-mode="mode.visualMode"
      :data-itab-data-mode="mode.dataMode"
      :data-itab-qa-overlay="qaOverlay ? 'markers' : 'clean'"
      @click.self="close"
    >
      <img
        v-if="cloneSkin && mode.visualMode === 'clone-skin'"
        class="itab-opened-clone-skin-layer"
        :src="cloneSkin.assetUrl"
        :width="cloneSkin.outerRect.width"
        :height="cloneSkin.outerRect.height"
        :alt="`${vm.entry.title} opened clone skin`"
        aria-hidden="true"
        draggable="false"
      />
      <section
        class="itab-panel"
        :class="[
          `is-panel-${panelKind}`,
          `is-visual-${mode.visualMode}`,
          `is-data-${mode.dataMode}`,
          { 'has-qa-markers': qaOverlay },
        ]"
        role="dialog"
        aria-modal="true"
        :aria-label="`${vm.entry.title} 面板`"
        :data-itab-panel="widget.type"
        :data-itab-component-id="widget.type"
        :data-capture-index="vm.entry.captureIndex"
        :data-itab-capture-index="vm.entry.captureIndex"
        data-itab-state="opened"
        :data-itab-visual-mode="mode.visualMode"
        :data-itab-data-mode="mode.dataMode"
        :data-itab-qa-overlay="qaOverlay ? 'markers' : 'clean'"
        :data-itab-skin-id="cloneSkin?.skinId"
        :data-itab-resource-policy="bindingStatus.ok ? 'ok' : 'invalid'"
        :data-itab-resource-count="openedResources.length"
        data-itab-hotspot-id="opened-root"
        data-itab-action="panel-present"
        :style="panelStyle"
        @keydown.esc.prevent.stop="close"
      >
        <img
          v-if="cloneSkin && mode.visualMode === 'panel-skin'"
          class="itab-opened-panel-skin-layer"
          :src="cloneSkin.assetUrl"
          :width="cloneSkin.outerRect.width"
          :height="cloneSkin.outerRect.height"
          :style="panelCropSkinStyle"
          :alt="`${vm.entry.title} panel clone skin`"
          aria-hidden="true"
          draggable="false"
        />
        <div
          v-if="panelGeometry"
          class="itab-panel-capture-elements"
          aria-hidden="true"
        >
          <span
            v-for="element in panelGeometry.elements.slice(0, 120)"
            :key="element.key"
            :class="[
              'itab-panel-capture-element',
              { 'has-text': element.text },
            ]"
            :style="captureElementStyle(element)"
            >{{ element.text }}</span
          >
        </div>
        <header class="itab-panel-head">
          <div>
            <p>{{ vm.entry.title }}</p>
            <h2>{{ vm.fixture.panelTitle }}</h2>
          </div>
          <button
            ref="closeButtonRef"
            type="button"
            class="itab-panel-close"
            data-itab-inner-control
            data-itab-hotspot-id="opened-close"
            data-itab-action="close-panel"
            @click="close"
          >
            关闭
          </button>
        </header>
        <span
          v-for="(slot, index) in semanticExpectation?.requiredSlots || []"
          :key="slot.slotId"
          class="itab-panel-semantic-slot"
          :style="{
            left: `${slot.rect.x}px`,
            top: `${slot.rect.y}px`,
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
          v-if="openedPrimaryHotspot"
          type="button"
          class="itab-panel-primary-hotspot"
          data-itab-inner-control
          data-itab-hotspot-id="opened-primary-action"
          data-itab-action="mutate-opened-state"
          :style="{
            left: `${openedPrimaryHotspot.rect.x}px`,
            top: `${openedPrimaryHotspot.rect.y}px`,
            width: `${openedPrimaryHotspot.rect.width}px`,
            height: `${openedPrimaryHotspot.rect.height}px`,
          }"
          @click="runAction('主要操作')"
        >
          主要操作
        </button>

        <div class="itab-panel-hero">
          <strong>{{
            panelKind === "counter"
              ? `已敲 ${counter} 次`
              : panelKind === "game"
                ? `Score ${gameScore}`
                : vm.hero
          }}</strong>
          <span>{{ vm.subline }}</span>
          <em>{{ vm.meta }}</em>
        </div>

        <div class="itab-panel-body">
          <section v-if="panelKind === 'weather'" class="weather-panel">
            <div v-for="line in vm.lines" :key="line">
              <span>{{ line }}</span
              ><b />
            </div>
          </section>

          <section v-else-if="panelKind === 'calendar'" class="calendar-panel">
            <button
              v-for="day in 35"
              :key="day"
              type="button"
              :class="{ today: day === 20 }"
            >
              {{ day }}
            </button>
          </section>

          <section v-else-if="panelKind === 'feed'" class="feed-panel">
            <button
              v-for="provider in ['百度', '微博', '抖音']"
              :key="provider"
              type="button"
              @click="log(`切换 ${provider}`)"
            >
              {{ provider }}
            </button>
            <p v-for="(line, index) in vm.lines" :key="line">
              <b>{{ index + 1 }}</b
              >{{ line }}
            </p>
          </section>

          <section v-else-if="panelKind === 'timer'" class="timer-panel">
            <div class="timer-ring">
              <span>{{ timerRunning ? "运行中" : vm.hero }}</span>
            </div>
            <button
              type="button"
              @click="runAction(timerRunning ? '暂停' : '开始')"
            >
              {{ timerRunning ? "暂停" : "开始" }}
            </button>
          </section>

          <section v-else-if="panelKind === 'editor'" class="editor-panel">
            <input
              v-model="textInput"
              data-itab-inner-control
              placeholder="新增内容"
              @keydown.enter="addTask"
            />
            <button type="button" @click="addTask">添加</button>
            <p v-for="task in tasks" :key="task"><i />{{ task }}</p>
          </section>

          <section v-else-if="panelKind === 'reader'" class="reader-panel">
            <blockquote>{{ vm.hero }}，{{ vm.subline }}</blockquote>
            <p v-for="line in vm.lines" :key="line">{{ line }}</p>
          </section>

          <section
            v-else-if="panelKind === 'movieCalendar'"
            class="movie-calendar-panel"
          >
            <span class="movie-calendar-panel-bg" aria-hidden="true"></span>
            <aside class="movie-calendar-panel-poster" aria-hidden="true">
              <span>{{ vm.lines[0] || vm.entry.title }}</span>
            </aside>
            <div class="movie-calendar-panel-copy">
              <h3>{{ vm.lines[0] || vm.entry.title }}</h3>
              <span class="movie-calendar-panel-rating">{{ vm.subline }}</span>
              <p class="movie-calendar-panel-meta">
                {{ vm.lines[1] || "剧情/动作/武侠2018中国大陆 中国香港" }}
              </p>
              <p class="movie-calendar-panel-director">
                {{ vm.lines[2] || "导演：张艺谋" }}
              </p>
              <p class="movie-calendar-panel-quote">“ {{ vm.meta }} ”</p>
              <p class="movie-calendar-panel-intro">
                {{ vm.lines[3] || vm.privacyNote }}
              </p>
              <button
                type="button"
                data-itab-inner-control
                data-itab-hotspot-id="movie-source"
                data-itab-action="open-source"
                @click="runAction('查看电影源')"
              >
                {{ vm.chips[0] || "查看电影源→" }}
              </button>
            </div>
          </section>

          <section v-else-if="panelKind === 'counter'" class="counter-panel">
            <button type="button" @click="runAction('敲一下')">敲一下</button>
            <button
              type="button"
              @click="
                counter = 0;
                log('重置');
              "
            >
              重置
            </button>
          </section>

          <section v-else-if="panelKind === 'metric'" class="metric-panel">
            <p v-for="line in vm.lines" :key="line">
              <span>{{ line }}</span
              ><strong>{{ vm.state }}</strong>
            </p>
          </section>

          <section v-else-if="panelKind === 'game'" class="game-panel">
            <button
              v-for="(cell, index) in [
                2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 0, 0, 0,
                0,
              ]"
              :key="`${index}-${cell}`"
              type="button"
            >
              {{ cell || "" }}
            </button>
          </section>

          <section v-else-if="panelKind === 'trainer'" class="trainer-panel">
            <strong>abandon</strong>
            <input value="abandon" data-itab-inner-control />
            <div><i v-for="key in 26" :key="key" /></div>
          </section>

          <section
            v-else-if="panelKind === 'converter'"
            class="converter-panel"
          >
            <input v-model="textInput" data-itab-inner-control />
            <output>{{ convertedValue }}</output>
          </section>

          <section
            v-else-if="panelKind === 'wallpaper'"
            class="wallpaper-panel"
          >
            <div class="wallpaper-large"></div>
            <button type="button" @click="runAction('应用壁纸')">
              应用壁纸
            </button>
          </section>

          <section v-else class="creative-panel">
            <div class="avatar-preview">{{ vm.entry.glyph }}</div>
            <input v-model="textInput" data-itab-inner-control />
            <button type="button" @click="runAction('生成')">生成</button>
          </section>

          <aside class="action-panel">
            <button
              v-for="action in actions"
              :key="action"
              type="button"
              data-itab-inner-control
              :data-itab-hotspot-id="`opened-action-${action}`"
              :data-itab-action="action"
              @click="runAction(action)"
            >
              {{ action }}
            </button>
          </aside>
        </div>

        <footer class="itab-panel-foot">
          <span>{{ vm.privacyNote }}</span>
          <div v-if="actionLog.length" class="itab-panel-log">
            <i v-for="item in actionLog" :key="item">{{ item }}</i>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
:global(html.itab-panel-open),
:global(html.itab-panel-open body) {
  overflow: hidden;
}

.itab-panel-backdrop {
  position: fixed;
  inset: 0;
  z-index: 85;
  display: grid;
  place-items: center;
  background:
    radial-gradient(
      circle at 14% 56%,
      rgba(181, 117, 17, 0.7),
      transparent 18%
    ),
    radial-gradient(
      circle at 56% 10%,
      rgba(177, 72, 18, 0.54),
      transparent 22%
    ),
    radial-gradient(
      circle at 87% 50%,
      rgba(17, 112, 177, 0.64),
      transparent 26%
    ),
    rgba(4, 8, 14, 0.88);
  backdrop-filter: blur(14px);
  padding: 24px;
}

.itab-panel-backdrop.is-visual-clone-skin {
  place-items: start;
  background: transparent;
  backdrop-filter: none;
  padding: 0;
}

.itab-panel-backdrop.is-visual-panel-skin {
  background:
    radial-gradient(
      circle at 16% 56%,
      rgba(181, 117, 17, 0.42),
      transparent 18%
    ),
    radial-gradient(
      circle at 58% 12%,
      rgba(177, 72, 18, 0.34),
      transparent 22%
    ),
    radial-gradient(
      circle at 88% 52%,
      rgba(17, 112, 177, 0.46),
      transparent 26%
    ),
    rgba(4, 8, 14, 0.78);
  backdrop-filter: blur(14px);
}

.itab-opened-clone-skin-layer {
  position: fixed;
  inset: 0;
  z-index: 1;
  display: block;
  width: 100vw;
  height: 100vh;
  max-width: none;
  object-fit: fill;
  pointer-events: none;
  user-select: none;
}

.itab-opened-panel-skin-layer {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  display: block;
  max-width: none;
  object-fit: fill;
  pointer-events: none;
  user-select: none;
}

.itab-panel {
  --itab-accent: #4f46e5;
  position: relative;
  z-index: 2;
  width: min(1000px, calc(100vw - 80px));
  min-height: min(560px, calc(100vh - 96px));
  max-height: min(720px, calc(100vh - 48px));
  overflow: auto;
  border-radius: 16px;
  background: #f8f4ed;
  color: #0f172a;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.54);
  padding: 22px;
}

.itab-panel
  > :not(.itab-panel-capture-elements):not(.itab-opened-panel-skin-layer) {
  position: relative;
  z-index: 2;
}

.itab-panel-capture-elements {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}

.itab-panel-capture-element {
  position: absolute;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.itab-panel-capture-element.has-text {
  opacity: 0.18;
}

.itab-panel-semantic-slot {
  position: absolute;
  z-index: 5;
  overflow: hidden;
  color: currentColor;
  font-size: 13px;
  line-height: 18px;
  white-space: nowrap;
  pointer-events: none;
}

.itab-panel > .itab-panel-semantic-slot,
.itab-panel > .itab-panel-primary-hotspot {
  position: absolute;
}

.itab-panel-primary-hotspot {
  z-index: 6;
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.26);
  color: transparent;
  padding: 0;
}

.itab-panel.is-visual-clone-skin {
  width: 100vw !important;
  height: 100vh;
  min-height: 100vh !important;
  max-height: 100vh !important;
  overflow: hidden;
  border-radius: 0 !important;
  background: transparent;
  box-shadow: none;
  padding: 0;
  pointer-events: none;
}

.itab-panel.is-visual-panel-skin {
  overflow: hidden;
  background: transparent;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
  padding: 0;
}

.itab-panel.is-visual-clone-skin.is-data-fixture.has-qa-markers {
  outline: 1px solid rgba(14, 165, 233, 0.28);
  outline-offset: -1px;
}

.itab-panel.is-visual-clone-skin .itab-panel-close {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9;
  width: 48px;
  height: 36px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.52);
  color: #fff;
  padding: 0;
}

.itab-panel.is-visual-panel-skin .itab-panel-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 9;
  width: 34px;
  height: 34px;
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: transparent;
  padding: 0;
}

.itab-panel.is-visual-clone-skin .itab-panel-close,
.itab-panel.is-visual-clone-skin .itab-panel-primary-hotspot,
.itab-panel.is-visual-clone-skin button,
.itab-panel.is-visual-clone-skin input,
.itab-panel.is-visual-clone-skin select,
.itab-panel.is-visual-clone-skin textarea,
.itab-panel.is-visual-clone-skin a {
  pointer-events: auto;
}

.itab-panel.is-visual-panel-skin .itab-panel-close,
.itab-panel.is-visual-panel-skin .itab-panel-primary-hotspot,
.itab-panel.is-visual-panel-skin button,
.itab-panel.is-visual-panel-skin input,
.itab-panel.is-visual-panel-skin select,
.itab-panel.is-visual-panel-skin textarea,
.itab-panel.is-visual-panel-skin a {
  pointer-events: auto;
}

.itab-panel.is-visual-panel-skin .itab-panel-capture-elements,
.itab-panel.is-visual-panel-skin .itab-panel-head > div,
.itab-panel.is-visual-panel-skin .itab-panel-hero,
.itab-panel.is-visual-panel-skin .itab-panel-body,
.itab-panel.is-visual-panel-skin .action-panel,
.itab-panel.is-visual-panel-skin .itab-panel-foot {
  border-color: transparent !important;
  background: transparent !important;
  box-shadow: none !important;
  color: transparent !important;
  text-shadow: none !important;
}

.itab-panel.is-visual-panel-skin .itab-panel-head > div *,
.itab-panel.is-visual-panel-skin .itab-panel-hero *,
.itab-panel.is-visual-panel-skin .itab-panel-body *,
.itab-panel.is-visual-panel-skin .action-panel *,
.itab-panel.is-visual-panel-skin .itab-panel-foot * {
  border-color: transparent !important;
  background: transparent !important;
  box-shadow: none !important;
  color: transparent !important;
  text-shadow: none !important;
}

.itab-panel.is-visual-panel-skin .itab-panel-semantic-slot {
  border: 0;
  background: transparent;
  color: transparent;
  font-size: 0;
  opacity: 1;
  padding: 0;
}

.itab-panel.is-visual-panel-skin .itab-panel-primary-hotspot {
  border: 0;
  background: transparent;
  color: transparent;
  font-size: 0;
  opacity: 1;
  box-shadow: none;
}

.itab-panel.is-visual-clone-skin.is-data-fixture .itab-panel-capture-elements {
  display: none;
}

.itab-panel.is-visual-clone-skin.is-data-fixture .itab-panel-head > div,
.itab-panel.is-visual-clone-skin.is-data-fixture .itab-panel-hero,
.itab-panel.is-visual-clone-skin.is-data-fixture .itab-panel-body,
.itab-panel.is-visual-clone-skin.is-data-fixture .action-panel,
.itab-panel.is-visual-clone-skin.is-data-fixture .itab-panel-foot {
  border-color: transparent !important;
  background: transparent !important;
  box-shadow: none !important;
  color: transparent !important;
  text-shadow: none !important;
}

.itab-panel.is-visual-clone-skin.is-data-fixture .itab-panel-head > div *,
.itab-panel.is-visual-clone-skin.is-data-fixture .itab-panel-hero *,
.itab-panel.is-visual-clone-skin.is-data-fixture .itab-panel-body *,
.itab-panel.is-visual-clone-skin.is-data-fixture .action-panel *,
.itab-panel.is-visual-clone-skin.is-data-fixture .itab-panel-foot * {
  border-color: transparent !important;
  background: transparent !important;
  box-shadow: none !important;
  color: transparent !important;
  text-shadow: none !important;
}

.itab-panel.is-visual-clone-skin.is-data-fixture .itab-panel-semantic-slot {
  border: 0;
  background: transparent;
  color: transparent;
  font-size: 0;
  opacity: 1;
  padding: 0;
}

.itab-panel.is-visual-clone-skin.is-data-fixture .itab-panel-primary-hotspot,
.itab-panel.is-visual-clone-skin.is-data-fixture .itab-panel-close {
  border: 0;
  background: transparent;
  color: transparent;
  font-size: 0;
  opacity: 1;
  box-shadow: none;
}

.itab-panel.is-visual-clone-skin.is-data-fixture.has-qa-markers
  .itab-panel-primary-hotspot,
.itab-panel.is-visual-clone-skin.is-data-fixture.has-qa-markers
  .itab-panel-close {
  box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.72);
}

.itab-panel.is-visual-clone-skin.is-data-fixture.has-qa-markers
  .itab-panel-semantic-slot::after,
.itab-panel.is-visual-clone-skin.is-data-fixture.has-qa-markers
  .itab-panel-primary-hotspot::after,
.itab-panel.is-visual-clone-skin.is-data-fixture.has-qa-markers
  .itab-panel-close::after {
  position: absolute;
  left: 0;
  top: 0;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.78);
  content: "";
}

.itab-panel.is-visual-clone-skin.is-data-live .itab-panel-semantic-slot {
  border: 0;
  background: transparent;
  color: transparent;
  font-size: 0;
  opacity: 1;
  padding: 0;
}

.itab-panel.is-visual-clone-skin.is-data-live .itab-panel-primary-hotspot,
.itab-panel.is-visual-clone-skin.is-data-live .itab-panel-close {
  border: 0;
  background: transparent;
  color: transparent;
  font-size: 0;
  opacity: 1;
  box-shadow: none;
}

.is-panel-weather,
.is-panel-clock,
.is-panel-converter,
.is-panel-creative {
  background: #1f222b;
  color: white;
}

.is-panel-game {
  background: #f8f4ed;
  color: #776e65;
}

.is-panel-reader {
  background:
    radial-gradient(
      circle at 30% 40%,
      rgba(245, 158, 11, 0.14),
      transparent 32%
    ),
    #111217;
  color: white;
}

.itab-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.itab-panel-head p,
.itab-panel-head h2 {
  margin: 0;
}

.itab-panel-head p {
  color: color-mix(in srgb, var(--itab-accent) 72%, #64748b);
  font-size: 13px;
  font-weight: 800;
}

.itab-panel-head h2 {
  margin-top: 4px;
  font-size: 24px;
  line-height: 1.15;
}

.itab-panel-close,
.itab-panel button {
  border: 0;
  border-radius: 999px;
  background: #0f172a;
  color: white;
  font-size: 13px;
  font-weight: 800;
  padding: 8px 12px;
}

.is-panel-weather .itab-panel-close,
.is-panel-clock .itab-panel-close,
.is-panel-converter .itab-panel-close,
.is-panel-creative .itab-panel-close,
.is-panel-movieCalendar .itab-panel-close,
.is-panel-reader .itab-panel-close,
.is-panel-weather button,
.is-panel-clock button,
.is-panel-converter button,
.is-panel-creative button,
.is-panel-movieCalendar button,
.is-panel-reader button {
  background: rgba(255, 255, 255, 0.16);
}

.itab-panel-hero {
  display: grid;
  gap: 5px;
  margin-top: 18px;
  border-radius: 18px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--itab-accent) 22%, white),
    white
  );
  color: #0f172a;
  padding: 18px;
}

.is-panel-weather .itab-panel-hero,
.is-panel-clock .itab-panel-hero,
.is-panel-converter .itab-panel-hero,
.is-panel-creative .itab-panel-hero,
.is-panel-movieCalendar .itab-panel-hero,
.is-panel-reader .itab-panel-hero {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.is-panel-converter .itab-panel-head,
.is-panel-creative .itab-panel-head {
  justify-content: center;
}

.is-panel-converter .itab-panel-head > div,
.is-panel-creative .itab-panel-head > div {
  text-align: center;
}

.is-panel-converter .itab-panel-head p,
.is-panel-creative .itab-panel-head p {
  display: inline-block;
  border-radius: 2px;
  background: #f8c51c;
  color: #1f222b;
  font-size: 26px;
  padding: 8px 14px;
}

.is-panel-converter .itab-panel-head h2,
.is-panel-creative .itab-panel-head h2 {
  display: none;
}

.is-panel-converter .itab-panel-close,
.is-panel-creative .itab-panel-close {
  position: absolute;
  right: 20px;
  top: 18px;
  width: 14px;
  height: 14px;
  overflow: hidden;
  border-radius: 999px;
  background: #ff5f57;
  color: transparent;
  padding: 0;
}

.is-panel-converter .itab-panel-close::before,
.is-panel-creative .itab-panel-close::before {
  content: "";
  position: absolute;
  right: 28px;
  top: 0;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: #28c840;
}

.itab-panel-hero strong {
  font-size: 36px;
  line-height: 1.05;
}

.itab-panel-hero span,
.itab-panel-hero em {
  color: currentColor;
  font-style: normal;
  opacity: 0.72;
}

.itab-panel-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 14px;
  margin-top: 14px;
}

.itab-panel-body section,
.action-panel {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
  padding: 14px;
}

.is-panel-weather .itab-panel-body section,
.is-panel-clock .itab-panel-body section,
.is-panel-converter .itab-panel-body section,
.is-panel-creative .itab-panel-body section,
.is-panel-movieCalendar .itab-panel-body section,
.is-panel-reader .itab-panel-body section,
.is-panel-weather .action-panel,
.is-panel-clock .action-panel,
.is-panel-converter .action-panel,
.is-panel-creative .action-panel,
.is-panel-movieCalendar .action-panel,
.is-panel-reader .action-panel {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.1);
}

.is-panel-converter .itab-panel-hero,
.is-panel-creative .itab-panel-hero {
  margin: 90px auto 0;
  width: min(520px, 80%);
  background: transparent;
  text-align: center;
}

.is-panel-converter .itab-panel-hero strong,
.is-panel-creative .itab-panel-hero strong {
  color: rgba(255, 255, 255, 0.82);
  font-size: 56px;
  font-weight: 300;
}

.is-panel-converter .itab-panel-body,
.is-panel-creative .itab-panel-body {
  grid-template-columns: 1fr;
  width: min(520px, 80%);
  margin: 100px auto 0;
}

.is-panel-converter .action-panel,
.is-panel-creative .action-panel {
  display: none;
}

.is-panel-converter .converter-panel,
.is-panel-creative .creative-panel {
  border: 0;
  background: transparent;
  justify-items: center;
}

.is-panel-converter .converter-panel input,
.is-panel-creative .creative-panel input {
  width: 180px;
  border: 0;
  border-bottom: 2px solid #f4b400;
  border-radius: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.62);
  text-align: center;
  font-size: 28px;
}

.is-panel-converter .converter-panel output {
  display: none;
}

.action-panel button {
  width: max-content;
  background: color-mix(in srgb, var(--itab-accent) 20%, #e2e8f0);
  color: #0f172a;
}

.weather-panel div,
.metric-panel p,
.feed-panel p,
.editor-panel p {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 0;
  color: inherit;
  font-size: 13px;
}

.weather-panel b {
  width: 80px;
  height: 7px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--itab-accent), transparent);
}

.calendar-panel {
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.calendar-panel button,
.game-panel button {
  aspect-ratio: 1;
  border-radius: 10px;
  background: #f1f5f9;
  color: #0f172a;
  padding: 0;
}

.calendar-panel .today {
  background: #ef4444;
  color: white;
}

.feed-panel {
  grid-template-columns: repeat(3, auto) 1fr;
}

.feed-panel p {
  grid-column: 1 / -1;
}

.timer-panel,
.counter-panel,
.wallpaper-panel,
.creative-panel {
  justify-items: start;
}

.timer-ring {
  display: grid;
  width: 140px;
  height: 140px;
  place-items: center;
  border: 10px solid color-mix(in srgb, var(--itab-accent) 46%, #e2e8f0);
  border-radius: 999px;
  font-weight: 900;
}

.editor-panel input,
.converter-panel input,
.trainer-panel input,
.creative-panel input {
  min-width: 0;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  background: white;
  color: #0f172a;
  padding: 9px 11px;
}

.reader-panel blockquote {
  margin: 0;
  border-left: 4px solid var(--itab-accent);
  padding-left: 12px;
  font-size: 20px;
  line-height: 1.45;
}

.is-panel-movieCalendar {
  overflow: hidden;
  background: #000;
  color: #fff;
  padding: 1px;
}

.is-panel-movieCalendar .itab-panel-capture-elements,
.is-panel-movieCalendar .itab-panel-head,
.is-panel-movieCalendar .itab-panel-hero,
.is-panel-movieCalendar .action-panel,
.is-panel-movieCalendar .itab-panel-foot {
  display: none;
}

.is-panel-movieCalendar .itab-panel-body {
  display: block;
  margin: 0;
}

.is-panel-movieCalendar .movie-calendar-panel {
  position: relative;
  display: block;
  width: 858px;
  height: 550px;
  max-width: calc(100vw - 82px);
  max-height: calc(100vh - 98px);
  box-sizing: border-box;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: #000;
  color: #fff;
  padding: 50px;
}

.movie-calendar-panel-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 20, 0, 0.4)),
    radial-gradient(
      circle at 24% 42%,
      rgba(245, 158, 11, 0.34),
      transparent 26%
    ),
    radial-gradient(
      circle at 68% 18%,
      rgba(255, 255, 255, 0.18),
      transparent 28%
    ),
    #182016;
}

.movie-calendar-panel-poster {
  position: relative;
  z-index: 1;
  display: grid;
  float: left;
  width: 273px;
  height: 405px;
  place-items: center;
  margin: 0 10px 0 0;
  border-radius: 6px;
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.16), rgba(0, 0, 0, 0.3)),
    #4c4c3f;
  color: rgba(255, 255, 255, 0.9);
  font-size: 48px;
  font-weight: 700;
}

.movie-calendar-panel-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.movie-calendar-panel-copy h3 {
  margin: 0 0 8px;
  overflow: hidden;
  color: #fff;
  font-size: 34px;
  font-weight: 600;
  line-height: 42px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.movie-calendar-panel-rating {
  display: inline-block;
  margin-bottom: 12px;
  color: #fff;
  font-size: 18px;
  line-height: 18px;
}

.movie-calendar-panel-copy p {
  max-width: none;
  margin: 0 0 9px;
  color: rgba(255, 255, 255, 0.86);
  font-size: 14px;
  line-height: 22px;
}

.movie-calendar-panel-quote {
  margin-top: 18px;
  color: #fff;
  font-size: 19px;
  line-height: 30px;
}

.movie-calendar-panel-intro {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 7;
}

.movie-calendar-panel-copy button {
  margin-top: 8px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #f2cca4;
  font-size: 12px;
  line-height: 19.2px;
  padding: 10px 0 0;
}

.game-panel {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  background: #bbada0 !important;
}

.is-panel-game .itab-panel-head {
  position: absolute;
  left: calc(50% - 405px);
  top: 70px;
  width: 260px;
}

.is-panel-game .itab-panel-head p {
  display: none;
}

.is-panel-game .itab-panel-head h2 {
  color: #776e65;
  font-size: 52px;
  font-weight: 900;
}

.is-panel-game .itab-panel-close,
.is-panel-game .itab-panel-hero,
.is-panel-game .action-panel,
.is-panel-game .itab-panel-foot {
  display: none;
}

.is-panel-game .itab-panel-body {
  display: block;
  width: 500px;
  margin: 0 40px 0 auto;
}

.is-panel-game .game-panel {
  width: 500px;
  height: 500px;
  gap: 14px;
  padding: 14px;
  border-radius: 6px;
}

.itab-panel.is-visual-clone-skin .itab-panel-close {
  display: block;
}

.game-panel button {
  background: #eee4da;
  color: #776e65;
  font-weight: 900;
}

.trainer-panel div {
  display: grid;
  grid-template-columns: repeat(13, 1fr);
  gap: 4px;
}

.trainer-panel i {
  height: 16px;
  border-radius: 4px;
  background: #c7d2fe;
}

.converter-panel output {
  border-radius: 14px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 22px;
  font-weight: 900;
  padding: 16px;
}

.wallpaper-large {
  width: 100%;
  min-height: 200px;
  border-radius: 16px;
  background:
    radial-gradient(circle at 30% 35%, #fde68a 0 11%, transparent 13%),
    radial-gradient(circle at 64% 38%, #f59e0b 0 9%, transparent 11%),
    linear-gradient(135deg, #166534, #65a30d 44%, #0f172a);
}

.avatar-preview {
  display: grid;
  width: 120px;
  height: 120px;
  place-items: center;
  border-radius: 999px;
  background: linear-gradient(135deg, #7c3aed, #06b6d4);
  color: white;
  font-size: 42px;
  font-weight: 900;
}

.itab-panel-foot {
  display: grid;
  gap: 8px;
  margin-top: 14px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
}

.is-panel-weather .itab-panel-foot,
.is-panel-clock .itab-panel-foot {
  color: rgba(255, 255, 255, 0.66);
}

.itab-panel-log {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.itab-panel-log i {
  border-radius: 999px;
  background: #e0f2fe;
  color: #0369a1;
  font-style: normal;
  padding: 4px 8px;
}

@media (max-width: 640px) {
  .itab-panel-body {
    grid-template-columns: 1fr;
  }
}
</style>
