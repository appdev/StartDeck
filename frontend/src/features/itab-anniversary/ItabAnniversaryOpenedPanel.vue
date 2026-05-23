<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import type { WidgetConfig } from "@/types";
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";
import ItabAnniversaryCard from "./ItabAnniversaryCard.vue";
import { normalizeItabAnniversaryWidgetData } from "./itabAnniversaryModel";
import {
  anniversaryBackgroundColors,
  anniversaryBackgroundImages,
  anniversaryCommonEvents,
  anniversaryEditorSizes,
  anniversaryPreviewSizes,
  anniversaryRepeatOptions,
  anniversaryTemplateWithSize,
  anniversaryTemplates,
  anniversaryTextColors,
  daysInAnniversaryMonth,
  formatAnniversaryDateParts,
  parseAnniversaryDateParts,
  useItabAnniversaryRuntime,
} from "./useItabAnniversaryRuntime";
import type {
  ItabAnniversaryBackgroundMode,
  ItabAnniversaryTemplate,
  ItabAnniversaryWidgetData,
} from "./itabAnniversaryTypes";

const props = defineProps<{
  widget: WidgetConfig;
}>();

const emit = defineEmits<{
  addData: [data: ItabAnniversaryWidgetData];
  close: [];
  updateData: [data: ItabAnniversaryWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useItabAnniversaryRuntime(widgetRef);
const activeTemplateId = ref("life");
const activePreviewSize = ref<ItabWidgetSizeKey>("2x2");
const asideCollapsed = ref(false);
const repeatDropdownOpen = ref(false);
const datePickerOpen = ref(false);
const editor = reactive<ItabAnniversaryWidgetData>(
  normalizeItabAnniversaryWidgetData(props.widget.data),
);

const syncEditor = (data: ItabAnniversaryWidgetData) => {
  Object.assign(editor, data);
  activePreviewSize.value = data.sizeKey;
  repeatDropdownOpen.value = false;
  datePickerOpen.value = false;
};

watch(
  () => runtime.data.value,
  (data) => syncEditor(data),
  { immediate: true },
);

const templateList = computed(() =>
  anniversaryTemplates.filter((template) =>
    ["life", "payday", "love"].includes(template.id),
  ),
);
const carouselDots = computed(() =>
  anniversaryPreviewSizes.map((_, index) => index),
);
const editorTemplate = computed<ItabAnniversaryTemplate>(() => ({
  ...editor,
  id: activeTemplateId.value || "editor",
}));
const previewTemplate = computed(() =>
  anniversaryTemplateWithSize(editorTemplate.value, activePreviewSize.value),
);
const maskPercent = computed(() =>
  Math.max(0, Math.min(100, Number(editor.mask) || 0)),
);
const dateParts = computed(() => parseAnniversaryDateParts(editor.date));
const dayOptions = computed(() => {
  const { year, month } = dateParts.value;
  return Array.from(
    { length: daysInAnniversaryMonth(year, month) },
    (_, index) => index + 1,
  );
});
interface AnniversaryWheelSlot {
  key: string;
  value: number | null;
}

const wheelWindow = (
  options: number[],
  selected: number,
  keyPrefix: string,
): AnniversaryWheelSlot[] => {
  const selectedIndex = Math.max(0, options.indexOf(selected));
  return Array.from({ length: 7 }, (_, index) => {
    const value = options[selectedIndex - 3 + index] ?? null;
    return {
      key:
        value === null
          ? `${keyPrefix}-empty-${index}`
          : `${keyPrefix}-${value}`,
      value,
    };
  });
};
const yearOptions = Array.from({ length: 282 }, (_, index) => 1820 + index);
const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);
const visibleYearOptions = computed(() =>
  wheelWindow(yearOptions, dateParts.value.year, "year"),
);
const visibleMonthOptions = computed(() =>
  wheelWindow(monthOptions, dateParts.value.month, "month"),
);
const visibleDayOptions = computed(() =>
  wheelWindow(dayOptions.value, dateParts.value.day, "day"),
);
const templateCardWithSize = (template: ItabAnniversaryTemplate) =>
  anniversaryTemplateWithSize(template, editor.sizeKey);
const templateThumbnail = (template: ItabAnniversaryTemplate) =>
  template.id === "life"
    ? anniversaryTemplates.find((item) => item.id === "plain-life") || template
    : template;
const thumbnailWithSize = (template: ItabAnniversaryTemplate) =>
  anniversaryTemplateWithSize(templateThumbnail(template), editor.sizeKey);
const isTemplateActive = (template: ItabAnniversaryTemplate) =>
  template.id === activeTemplateId.value ||
  (activeTemplateId.value === "plain-life" && template.id === "life");
const isDotActive = (index: number) =>
  anniversaryPreviewSizes[index % anniversaryPreviewSizes.length] ===
  activePreviewSize.value;

const selectTemplate = (template: ItabAnniversaryTemplate) => {
  const sizeKey = editor.sizeKey;
  const next = normalizeItabAnniversaryWidgetData({
    ...template,
    sizeKey,
  });
  Object.assign(editor, next);
  activeTemplateId.value = template.id;
  activePreviewSize.value = sizeKey;
  repeatDropdownOpen.value = false;
  datePickerOpen.value = false;
};

const setEditorSize = (sizeKey: Extract<ItabWidgetSizeKey, "2x2" | "2x4">) => {
  editor.sizeKey = sizeKey;
};

const shiftPreview = (direction: -1 | 1) => {
  const currentIndex = Math.max(
    0,
    anniversaryPreviewSizes.indexOf(activePreviewSize.value),
  );
  const nextIndex =
    (currentIndex + direction + anniversaryPreviewSizes.length) %
    anniversaryPreviewSizes.length;
  activePreviewSize.value = anniversaryPreviewSizes[nextIndex] || "2x2";
};

const selectDot = (index: number) => {
  activePreviewSize.value =
    anniversaryPreviewSizes[index % anniversaryPreviewSizes.length] || "2x2";
};

const toggleAside = () => {
  asideCollapsed.value = !asideCollapsed.value;
};

const closeFloatingControls = () => {
  (
    editor as ItabAnniversaryWidgetData & { showCommonEvents?: boolean }
  ).showCommonEvents = false;
  repeatDropdownOpen.value = false;
  datePickerOpen.value = false;
};

const handleOutsidePointerDown = (event: PointerEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    closeFloatingControls();
    return;
  }
  if (
    target.closest(
      ".anniversary-common-trigger,.anniversary-event-popover,.anniversary-date-trigger,.anniversary-date-popper,.anniversary-repeat-select",
    )
  ) {
    return;
  }
  closeFloatingControls();
};

const selectCommonEvent = (eventName: string) => {
  editor.eventName = eventName;
  editor.label = eventName;
  (
    editor as ItabAnniversaryWidgetData & { showCommonEvents?: boolean }
  ).showCommonEvents = false;
  datePickerOpen.value = false;
};

const toggleCommonEvents = () => {
  (
    editor as ItabAnniversaryWidgetData & { showCommonEvents?: boolean }
  ).showCommonEvents = !(
    editor as ItabAnniversaryWidgetData & { showCommonEvents?: boolean }
  ).showCommonEvents;
  repeatDropdownOpen.value = false;
  datePickerOpen.value = false;
};

const commonEventsOpen = computed(() =>
  Boolean(
    (editor as ItabAnniversaryWidgetData & { showCommonEvents?: boolean })
      .showCommonEvents,
  ),
);

const toggleRepeatDropdown = () => {
  repeatDropdownOpen.value = !repeatDropdownOpen.value;
  (
    editor as ItabAnniversaryWidgetData & { showCommonEvents?: boolean }
  ).showCommonEvents = false;
  datePickerOpen.value = false;
};

const selectRepeat = (option: ItabAnniversaryWidgetData["repeat"]) => {
  editor.repeat = option;
  repeatDropdownOpen.value = false;
  datePickerOpen.value = false;
};

const toggleDatePicker = () => {
  datePickerOpen.value = !datePickerOpen.value;
  repeatDropdownOpen.value = false;
  (
    editor as ItabAnniversaryWidgetData & { showCommonEvents?: boolean }
  ).showCommonEvents = false;
};

const setDatePart = (part: "year" | "month" | "day", value: number) => {
  const current = dateParts.value;
  const next = {
    year: part === "year" ? value : current.year,
    month: part === "month" ? value : current.month,
    day: part === "day" ? value : current.day,
  };
  next.day = Math.min(next.day, daysInAnniversaryMonth(next.year, next.month));
  editor.date = formatAnniversaryDateParts(next.year, next.month, next.day);
};

const stepDatePart = (part: "year" | "month" | "day", direction: -1 | 1) => {
  const options =
    part === "year"
      ? yearOptions
      : part === "month"
        ? monthOptions
        : dayOptions.value;
  const current = dateParts.value[part];
  const currentIndex = Math.max(0, options.indexOf(current));
  const next =
    options[
      Math.min(Math.max(currentIndex + direction, 0), options.length - 1)
    ];
  if (next !== undefined) setDatePart(part, next);
};

const handleDateWheel = (part: "year" | "month" | "day", event: WheelEvent) => {
  stepDatePart(part, event.deltaY > 0 ? 1 : -1);
};

const setTextColor = (color: string) => {
  editor.textColor = color;
};

const setBackgroundColor = (color: string) => {
  editor.backgroundColor = color;
  editor.backgroundMode = "color";
};

const setBackgroundMode = (mode: ItabAnniversaryBackgroundMode) => {
  editor.backgroundMode = mode;
  if (mode === "image" && !editor.backgroundImage) {
    editor.backgroundImage = anniversaryBackgroundImages[11]?.full || "";
  }
};

const setBackgroundImage = (
  image: (typeof anniversaryBackgroundImages)[number],
) => {
  editor.backgroundImage = image.full;
  editor.backgroundMode = "image";
};

const buildEditorData = () =>
  normalizeItabAnniversaryWidgetData({
    ...editor,
    label: editor.eventName || editor.label,
    sizeKey: activePreviewSize.value,
  });

const commit = () => {
  emit("updateData", buildEditorData());
  emit("close");
};

const addWidget = () => {
  emit("addData", buildEditorData());
  emit("close");
};

onMounted(() => {
  document.addEventListener("pointerdown", handleOutsidePointerDown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
});
</script>

<template>
  <div
    class="opened-anniversary-panel"
    :class="{ 'is-aside-collapsed': asideCollapsed }"
    data-itab-anniversary-opened-panel
    data-grid-drag-ignore="true"
  >
    <section class="anniversary-template-pane">
      <p class="anniversary-editor-tip">
        此列表为模板，选中后可修改文字和日期可以改变成任何类型的倒计时，添加后可以在桌面右键编辑/删除
      </p>
      <div class="anniversary-template-divider"></div>
      <div class="anniversary-editor-heading">
        <strong>组件模板列表</strong>
      </div>
      <div class="anniversary-size-row" aria-label="组件尺寸">
        <button
          v-for="size in anniversaryEditorSizes"
          :key="`anniversary-size-${size}`"
          type="button"
          :class="{ active: editor.sizeKey === size }"
          @click="setEditorSize(size)"
        >
          {{ size }}
        </button>
      </div>
      <div
        class="anniversary-template-grid"
        :class="`size-${editor.sizeKey.replace('x', '-')}`"
      >
        <div
          v-for="template in templateList"
          :key="template.id"
          class="anniversary-template-card"
          role="button"
          tabindex="0"
          :class="[
            `size-${editor.sizeKey.replace('x', '-')}`,
            { active: isTemplateActive(template) },
          ]"
          @click="selectTemplate(template)"
          @keydown.enter.prevent="selectTemplate(template)"
          @keydown.space.prevent="selectTemplate(template)"
        >
          <span class="anniversary-template-size">{{ editor.sizeKey }}</span>
          <ItabAnniversaryCard
            :template="thumbnailWithSize(template)"
            :size-key="editor.sizeKey"
            variant="mini"
          />
          <b>{{ template.title }}</b>
        </div>
      </div>
    </section>

    <section class="anniversary-preview-pane">
      <button
        type="button"
        class="anniversary-preview-arrow previous"
        aria-label="上一个尺寸"
        @click="shiftPreview(-1)"
      >
        ‹
      </button>
      <div
        class="anniversary-preview-stage"
        :class="`size-${activePreviewSize.replace('x', '-')}`"
      >
        <ItabAnniversaryCard
          :template="previewTemplate"
          :size-key="activePreviewSize"
          variant="preview"
          current
        />
      </div>
      <button
        type="button"
        class="anniversary-preview-arrow next"
        aria-label="下一个尺寸"
        @click="shiftPreview(1)"
      >
        ›
      </button>
      <div
        class="anniversary-carousel-dots"
        role="tablist"
        aria-label="组件模板列表"
      >
        <span
          v-for="dot in carouselDots.slice(0, 5)"
          :key="`anniversary-dot-${dot}`"
          role="button"
          tabindex="0"
          :class="{ active: isDotActive(dot) }"
          :aria-label="`模板 ${dot + 1}`"
          @click="selectDot(dot)"
          @keydown.enter.prevent="selectDot(dot)"
          @keydown.space.prevent="selectDot(dot)"
        ></span>
      </div>
      <strong class="anniversary-preview-name">{{ editor.title }}</strong>
    </section>

    <button
      type="button"
      class="anniversary-collapse-arrow"
      :class="{ active: asideCollapsed }"
      :aria-label="asideCollapsed ? '展开模板列表' : '收起模板列表'"
      @click="toggleAside"
    >
      {{ asideCollapsed ? "›" : "‹" }}
    </button>

    <section class="anniversary-settings-pane">
      <div class="anniversary-field-row">
        <span>组件名称</span>
        <input v-model="editor.title" aria-label="组件名称" />
      </div>
      <div class="anniversary-field-row">
        <span>事件名称</span>
        <label class="anniversary-inline-input">
          <input v-model="editor.eventName" aria-label="事件名称" />
          <button
            type="button"
            class="anniversary-common-trigger"
            :class="{ active: commonEventsOpen }"
            @click="toggleCommonEvents"
          >
            常用事件
          </button>
        </label>
        <div v-if="commonEventsOpen" class="anniversary-event-popover">
          <div
            v-for="eventName in anniversaryCommonEvents"
            :key="eventName"
            role="button"
            tabindex="0"
            :class="{ active: editor.eventName === eventName }"
            @click="selectCommonEvent(eventName)"
            @keydown.enter.prevent="selectCommonEvent(eventName)"
            @keydown.space.prevent="selectCommonEvent(eventName)"
          >
            {{ eventName }}
          </div>
        </div>
      </div>
      <div class="anniversary-field-row anniversary-date-row">
        <span>日期</span>
        <div class="anniversary-date-input">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M4 1.5a.75.75 0 0 1 .75.75V3h6.5v-.75a.75.75 0 0 1 1.5 0V3H14a1.5 1.5 0 0 1 1.5 1.5V13A1.5 1.5 0 0 1 14 14.5H2A1.5 1.5 0 0 1 .5 13V4.5A1.5 1.5 0 0 1 2 3h1.25v-.75A.75.75 0 0 1 4 1.5ZM2 6v7h12V6H2Z"
            />
          </svg>
          <button
            type="button"
            class="anniversary-date-trigger"
            :class="{ active: datePickerOpen }"
            aria-label="日期"
            @click="toggleDatePicker"
            @keydown.enter.prevent="toggleDatePicker"
            @keydown.space.prevent="toggleDatePicker"
          >
            {{ editor.date }}
          </button>
          <div
            v-if="datePickerOpen"
            class="anniversary-date-popper"
            role="dialog"
            aria-label="日期选择"
          >
            <div class="anniversary-date-wheel">
              <div class="anniversary-picker-select"></div>
              <div class="anniversary-picker-mask"></div>
              <div
                class="anniversary-picker-column"
                @wheel.prevent="handleDateWheel('year', $event)"
              >
                <button
                  v-for="slot in visibleYearOptions"
                  :key="slot.key"
                  type="button"
                  :disabled="slot.value === null"
                  :class="{
                    'is-select': slot.value === dateParts.year,
                    'is-empty': slot.value === null,
                  }"
                  @click="
                    slot.value !== null && setDatePart('year', slot.value)
                  "
                >
                  {{ slot.value ?? "" }}
                </button>
              </div>
              <div
                class="anniversary-picker-column"
                @wheel.prevent="handleDateWheel('month', $event)"
              >
                <button
                  v-for="slot in visibleMonthOptions"
                  :key="slot.key"
                  type="button"
                  :disabled="slot.value === null"
                  :class="{
                    'is-select': slot.value === dateParts.month,
                    'is-empty': slot.value === null,
                  }"
                  @click="
                    slot.value !== null && setDatePart('month', slot.value)
                  "
                >
                  {{
                    slot.value === null
                      ? ""
                      : String(slot.value).padStart(2, "0")
                  }}
                </button>
              </div>
              <div
                class="anniversary-picker-column"
                @wheel.prevent="handleDateWheel('day', $event)"
              >
                <button
                  v-for="slot in visibleDayOptions"
                  :key="slot.key"
                  type="button"
                  :disabled="slot.value === null"
                  :class="{
                    'is-select': slot.value === dateParts.day,
                    'is-empty': slot.value === null,
                  }"
                  @click="slot.value !== null && setDatePart('day', slot.value)"
                >
                  {{
                    slot.value === null
                      ? ""
                      : String(slot.value).padStart(2, "0")
                  }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="anniversary-select-wrap anniversary-repeat-select">
          <div
            class="anniversary-select-trigger"
            role="button"
            tabindex="0"
            aria-label="不重复"
            :class="{ active: repeatDropdownOpen }"
            @click="toggleRepeatDropdown"
            @keydown.enter.prevent="toggleRepeatDropdown"
            @keydown.space.prevent="toggleRepeatDropdown"
          >
            <span>{{ editor.repeat }}</span>
            <i></i>
          </div>
          <div
            v-if="repeatDropdownOpen"
            class="anniversary-select-popper anniversary-repeat-popper"
          >
            <div
              v-for="option in anniversaryRepeatOptions"
              :key="option"
              role="button"
              tabindex="0"
              :class="{ selected: editor.repeat === option }"
              @click="selectRepeat(option)"
              @keydown.enter.prevent="selectRepeat(option)"
              @keydown.space.prevent="selectRepeat(option)"
            >
              {{ option }}
            </div>
          </div>
        </div>
      </div>
      <div class="anniversary-field-row anniversary-swatch-row">
        <span>字体颜色</span>
        <div class="anniversary-color-swatches">
          <span
            v-for="color in anniversaryTextColors"
            :key="`anniversary-text-${color}`"
            role="button"
            tabindex="0"
            :class="{
              active: editor.textColor.toLowerCase() === color.toLowerCase(),
            }"
            :style="{ '--swatch-color': color }"
            :aria-label="`字体颜色 ${color}`"
            @click="setTextColor(color)"
            @keydown.enter.prevent="setTextColor(color)"
            @keydown.space.prevent="setTextColor(color)"
          ></span>
          <span
            class="anniversary-gradient-swatch"
            role="button"
            tabindex="0"
            aria-label="更多字体颜色"
            @click="setTextColor('#ffffff')"
            @keydown.enter.prevent="setTextColor('#ffffff')"
            @keydown.space.prevent="setTextColor('#ffffff')"
          ></span>
        </div>
      </div>
      <div class="anniversary-field-row anniversary-background-row">
        <span>背景</span>
        <div class="anniversary-background-mode" aria-label="背景">
          <button
            type="button"
            :class="{ active: editor.backgroundMode === 'color' }"
            @click="setBackgroundMode('color')"
          >
            颜色
          </button>
          <button
            type="button"
            :class="{ active: editor.backgroundMode === 'image' }"
            @click="setBackgroundMode('image')"
          >
            图片
          </button>
        </div>
      </div>
      <div
        v-if="editor.backgroundMode === 'color'"
        class="anniversary-field-row anniversary-swatch-row anniversary-bg-swatches-row"
      >
        <span></span>
        <div class="anniversary-color-swatches">
          <span
            v-for="color in anniversaryBackgroundColors"
            :key="`anniversary-bg-${color}`"
            role="button"
            tabindex="0"
            :class="{
              active:
                editor.backgroundColor.toLowerCase() === color.toLowerCase() &&
                editor.backgroundMode === 'color',
            }"
            :style="{ '--swatch-color': color }"
            :aria-label="`背景颜色 ${color}`"
            @click="setBackgroundColor(color)"
            @keydown.enter.prevent="setBackgroundColor(color)"
            @keydown.space.prevent="setBackgroundColor(color)"
          ></span>
          <span
            class="anniversary-gradient-swatch"
            role="button"
            tabindex="0"
            aria-label="更多背景颜色"
            @click="setBackgroundColor('#ffffff')"
            @keydown.enter.prevent="setBackgroundColor('#ffffff')"
            @keydown.space.prevent="setBackgroundColor('#ffffff')"
          ></span>
        </div>
      </div>
      <div v-else class="anniversary-field-row anniversary-image-row">
        <div class="anniversary-image-panel">
          <div class="anniversary-image-strip-clip">
            <div class="anniversary-image-strip">
              <button
                v-for="image in anniversaryBackgroundImages"
                :key="image.id"
                type="button"
                :class="{ active: editor.backgroundImage === image.full }"
                :aria-label="`背景图片 ${image.id}`"
                @click="setBackgroundImage(image)"
              >
                <img alt="" :src="image.thumb" />
              </button>
            </div>
          </div>
          <div class="anniversary-mask-row">
            <span>蒙版</span>
            <label
              class="anniversary-mask-control"
              :style="{ '--anniversary-mask-progress': `${maskPercent}%` }"
            >
              <input
                v-model.number="editor.mask"
                type="range"
                min="0"
                max="100"
                step="1"
                aria-label="蒙版"
              />
              <output>{{ maskPercent }} %</output>
            </label>
          </div>
        </div>
      </div>
    </section>

    <section class="anniversary-action-row">
      <button type="button" @click="commit">修改完成</button>
      <button type="button" @click="addWidget">添加</button>
    </section>
  </div>
</template>

<style scoped>
.opened-anniversary-panel {
  position: relative;
  display: grid;
  height: 100%;
  grid-template-areas:
    "templates preview"
    "templates settings"
    "templates actions";
  grid-template-columns: 374px minmax(0, 1fr);
  grid-template-rows: 194px 340px 66px;
  padding: 0;
  overflow: hidden;
  background: linear-gradient(
    90deg,
    rgb(255, 255, 255) 0 374px,
    rgb(245, 245, 245) 374px 100%
  );
  color: rgb(34, 34, 34);
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.opened-anniversary-panel.is-aside-collapsed {
  grid-template-columns: 70px minmax(0, 1fr);
  background: linear-gradient(
    90deg,
    rgb(255, 255, 255) 0 70px,
    rgb(245, 245, 245) 70px 100%
  );
}

.anniversary-template-pane,
.anniversary-preview-pane,
.anniversary-settings-pane {
  min-width: 0;
}

.anniversary-template-pane {
  grid-area: templates;
  display: grid;
  width: 374px;
  height: 600px;
  grid-template-rows: auto 1px auto auto minmax(0, 1fr);
  gap: 12px;
  overflow: hidden auto;
  padding: 30px 30px 0;
  transition:
    padding 0.18s ease,
    width 0.18s ease;
}

.opened-anniversary-panel.is-aside-collapsed .anniversary-template-pane {
  width: 70px;
  padding-right: 0;
  padding-left: 0;
}

.opened-anniversary-panel.is-aside-collapsed .anniversary-template-pane > * {
  opacity: 0;
  pointer-events: none;
}

.anniversary-editor-tip {
  margin: 0;
  color: rgba(0, 0, 0, 0.42);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.anniversary-template-divider {
  width: 300px;
  height: 1px;
  margin: 0 0 4px;
  background: rgba(0, 0, 0, 0.1);
}

.anniversary-editor-heading {
  display: flex;
  min-height: 28px;
  align-items: center;
}

.anniversary-editor-heading strong {
  color: rgba(0, 0, 0, 0.55);
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
}

.anniversary-size-row {
  position: relative;
  display: grid;
  height: 28px;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.1);
}

.anniversary-size-row::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  width: calc(50% - 2px);
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.28);
  content: "";
  transition: transform 0.18s ease;
}

.anniversary-size-row:has(button:nth-child(2).active)::before {
  transform: translateX(100%);
}

.anniversary-size-row button {
  position: relative;
  z-index: 1;
  height: 28px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: rgba(0, 0, 0, 0.6);
  font-size: 14px;
  line-height: 28px;
}

.anniversary-size-row button.active {
  color: #fff;
}

.anniversary-template-grid {
  display: grid;
  grid-template-columns: repeat(2, 125px);
  align-content: start;
  justify-content: start;
  gap: 10px 32px;
  overflow: auto;
  padding: 8px 0 4px 17px;
}

.anniversary-template-grid.size-2-4 {
  grid-template-columns: 275px;
  gap: 0px;
}

.anniversary-template-card {
  position: relative;
  display: grid;
  min-height: 170px;
  align-content: start;
  justify-items: center;
  gap: 9px;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  color: rgb(34, 34, 34);
  cursor: pointer;
  text-align: center;
}

.anniversary-template-card b {
  overflow: hidden;
  max-width: 125px;
  color: rgb(34, 34, 34);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.anniversary-template-card.active :deep(.itab-anniversary-card) {
  box-shadow:
    0 0 0 1px rgb(255, 255, 255),
    0 0 0 3px rgb(24, 144, 255),
    0 0 10px 3px rgba(0, 0, 0, 0.1);
}

.anniversary-template-size {
  display: none;
}

.anniversary-preview-pane {
  position: relative;
  display: grid;
  grid-area: preview;
  align-content: start;
  justify-items: center;
  overflow: visible;
  padding-top: 17px;
}

.anniversary-preview-stage {
  position: relative;
  width: 330px;
  height: 143px;
  perspective: 900px;
}

.anniversary-preview-stage.size-1-1,
.anniversary-preview-stage.size-1-2,
.anniversary-preview-stage.size-2-1 {
  height: 164px;
}

.anniversary-preview-stage.size-2-4 {
  width: 330px;
  height: 150px;
}

.anniversary-preview-arrow {
  position: absolute;
  top: 81px;
  z-index: 4;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  color: rgb(238, 238, 238);
  font-size: 30px;
  line-height: 26px;
}

.anniversary-preview-arrow.previous {
  left: 33px;
}

.anniversary-preview-arrow.next {
  right: 34px;
}

.anniversary-carousel-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin-top: 12px;
}

.anniversary-carousel-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.16);
  cursor: pointer;
}

.anniversary-carousel-dots span.active {
  background: rgba(0, 0, 0, 0.45);
  transform: scale(1.4);
}

.anniversary-preview-name {
  margin-top: 3px;
  color: rgb(34, 34, 34);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.anniversary-collapse-arrow {
  position: absolute;
  top: 240px;
  left: 359px;
  z-index: 4;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.58);
  color: #fff;
  font-size: 30px;
  line-height: 26px;
  transition: left 0.18s ease;
}

.anniversary-collapse-arrow.active {
  left: 55px;
}

.anniversary-settings-pane {
  display: flex;
  grid-area: settings;
  max-height: 100%;
  flex-direction: column;
  gap: 13px;
  overflow: hidden auto;
  margin: 0 30px;
  padding: 16px;
  border-radius: 6px;
  background: transparent;
  scrollbar-color: rgba(0, 0, 0, 0.18) transparent;
  scrollbar-width: thin;
}

.anniversary-field-row {
  position: relative;
  display: grid;
  min-height: 30px;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.anniversary-field-row > span {
  color: rgba(0, 0, 0, 0.8);
  font-size: 14px;
  line-height: 22px;
}

.anniversary-settings-pane input,
.anniversary-date-trigger,
.anniversary-select-trigger {
  width: 100%;
  height: 24px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  outline: none;
  background: rgb(255, 255, 255);
  color: rgb(96, 98, 102);
  font-size: 12px;
}

.anniversary-inline-input,
.anniversary-date-input {
  position: relative;
  display: block;
}

.anniversary-inline-input input {
  padding-right: 72px;
}

.anniversary-common-trigger {
  position: absolute;
  top: 0;
  right: 7px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgb(33, 150, 243);
  font-size: 12px;
  line-height: 24px;
}

.anniversary-date-row {
  grid-template-columns: 88px 135px 80px;
}

.anniversary-date-trigger {
  padding-left: 30px;
  text-align: left;
  cursor: pointer;
}

.anniversary-date-input svg {
  position: absolute;
  top: 50%;
  left: 10px;
  z-index: 1;
  width: 13px;
  height: 13px;
  fill: rgba(0, 0, 0, 0.55);
  pointer-events: none;
  transform: translateY(-50%);
}

.anniversary-date-popper {
  position: absolute;
  top: 30px;
  left: -80px;
  z-index: 12;
  width: 324px;
  padding: 13px;
  border-radius: 10px;
  background: rgb(29, 30, 31);
  box-shadow:
    0 0 1px rgba(255, 255, 255, 0.15),
    0 8px 24px rgba(0, 0, 0, 0.32);
}

.anniversary-date-popper::before {
  position: absolute;
  top: -5px;
  left: 154px;
  width: 10px;
  height: 10px;
  background: rgb(29, 30, 31);
  content: "";
  transform: rotate(45deg);
}

.anniversary-date-wheel {
  position: relative;
  display: grid;
  width: 298px;
  height: 266px;
  grid-template-columns: repeat(3, 99px);
  overflow: hidden;
}

.anniversary-picker-select {
  position: absolute;
  top: 114px;
  left: 16px;
  width: 266px;
  height: 38px;
  border-radius: 6px;
  background: rgb(44, 44, 44);
}

.anniversary-picker-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: linear-gradient(
    180deg,
    rgb(29, 30, 31) 0%,
    rgba(29, 30, 31, 0.64) 20%,
    rgba(29, 30, 31, 0) 42%,
    rgba(29, 30, 31, 0) 58%,
    rgba(29, 30, 31, 0.64) 80%,
    rgb(29, 30, 31) 100%
  );
  pointer-events: none;
}

.anniversary-picker-column {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
}

.anniversary-picker-column button {
  width: 99px;
  height: 38px;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-weight: 700;
  line-height: 38px;
  text-align: center;
  transition: transform 0.14s ease;
}

.anniversary-picker-column button.is-empty {
  pointer-events: none;
}

.anniversary-picker-column button.is-select {
  transform: scale(1.2);
}

.anniversary-select-wrap {
  position: relative;
}

.anniversary-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 14px;
  background: rgb(255, 255, 255);
  color: rgba(0, 0, 0, 0.56);
  cursor: pointer;
}

.anniversary-select-trigger.active {
  border-color: rgba(0, 0, 0, 0.32);
}

.anniversary-select-trigger i {
  width: 8px;
  height: 8px;
  border-right: 1px solid currentColor;
  border-bottom: 1px solid currentColor;
  transform: translateY(-2px) rotate(45deg);
}

.anniversary-select-popper {
  position: absolute;
  top: 30px;
  right: 0;
  z-index: 8;
  min-width: 96px;
  overflow: hidden;
  padding: 6px 0;
  border: 1px solid rgb(228, 231, 237);
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  color: #606266;
  font-size: 14px;
  line-height: 34px;
}

.anniversary-select-popper > div {
  height: 34px;
  padding: 0 20px;
  cursor: pointer;
  white-space: nowrap;
}

.anniversary-select-popper > div:hover,
.anniversary-select-popper > div.selected {
  background: rgb(245, 247, 250);
  color: rgb(33, 150, 243);
}

.anniversary-event-popover {
  position: absolute;
  top: 30px;
  right: 0;
  z-index: 8;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  width: 274px;
  max-height: 246px;
  gap: 8px;
  overflow: hidden;
  padding: 41px 13px 13px;
  border-radius: 10px;
  background: rgb(29, 30, 31);
  box-shadow:
    0 0 1px rgba(255, 255, 255, 0.15),
    0 8px 24px rgba(0, 0, 0, 0.32);
  color: rgb(206, 207, 209);
  font-size: 12px;
  line-height: 24px;
}

.anniversary-event-popover::before {
  position: absolute;
  top: 13px;
  left: 13px;
  color: rgb(206, 207, 209);
  content: "常用事件";
  font-size: 12px;
  line-height: 18px;
}

.anniversary-event-popover::after {
  position: absolute;
  top: -5px;
  right: 26px;
  width: 10px;
  height: 10px;
  background: rgb(29, 30, 31);
  content: "";
  transform: rotate(45deg);
}

.anniversary-event-popover > div {
  height: 24px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.02);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.66);
  cursor: pointer;
  white-space: nowrap;
}

.anniversary-event-popover > div:hover,
.anniversary-event-popover > div.active {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
}

.anniversary-color-swatches {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  overflow: visible;
}

.anniversary-color-swatches span {
  position: relative;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--swatch-color);
  cursor: pointer;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.anniversary-color-swatches span.active::after {
  position: absolute;
  inset: -2px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.86);
  color: #888;
  content: "✓";
  font-size: 14px;
  font-weight: 700;
}

.anniversary-gradient-swatch {
  background: conic-gradient(
    from 180deg,
    #f04242,
    #ffb322,
    #77d24b,
    #3aa3ff,
    #8d4dff,
    #f04242
  ) !important;
}

.anniversary-background-row {
  grid-template-columns: auto auto 1fr;
  gap: 18px;
  min-height: 21px;
  align-items: start;
}

.anniversary-background-row > span {
  line-height: 21px;
}

.anniversary-background-mode {
  display: flex;
  align-items: center;
  gap: 10px;
}

.anniversary-background-mode button {
  height: 16px;
  padding: 0 4px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: rgba(0, 0, 0, 0.42);
  font-size: 13px;
  line-height: 16px;
}

.anniversary-background-mode button.active {
  background: rgba(0, 0, 0, 0.16);
  color: rgba(0, 0, 0, 0.86);
}

.anniversary-image-row {
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  min-height: 100px;
}

.anniversary-image-panel {
  width: 100%;
  height: 100px;
  overflow: hidden;
  padding: 8px 16px;
  border-radius: 12px;
  background: rgb(255, 255, 255);
}

.anniversary-image-strip-clip {
  width: 100%;
  height: 65px;
  overflow: hidden;
}

.anniversary-image-strip {
  display: inline-flex;
  width: max-content;
  height: 52px;
  overflow: visible;
  white-space: nowrap;
}

.anniversary-image-strip button {
  position: relative;
  flex: 0 0 auto;
  width: 42px;
  height: 52px;
  overflow: hidden;
  margin: 0 5px 0 0;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.anniversary-image-strip button.active::after {
  position: absolute;
  inset: 0;
  border: 2px solid rgb(33, 150, 243);
  border-radius: inherit;
  content: "";
  pointer-events: none;
}

.anniversary-image-strip img {
  display: block;
  width: 42px;
  height: 52px;
  object-fit: cover;
}

.anniversary-mask-row {
  display: grid;
  height: 24px;
  grid-template-columns: 60px minmax(0, 1fr);
  align-items: center;
  gap: 0;
  color: rgb(34, 34, 34);
  line-height: 24px;
}

.anniversary-mask-row > span {
  color: rgb(34, 34, 34);
  font-size: 14px;
  line-height: 24px;
}

.anniversary-mask-control {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) 54px;
  align-items: center;
  gap: 16px;
}

.anniversary-mask-control input[type="range"] {
  width: 100%;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  appearance: none;
  background: transparent;
  cursor: pointer;
  outline: none;
}

.anniversary-mask-control input[type="range"]::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    rgb(33, 150, 243) 0 var(--anniversary-mask-progress),
    rgba(255, 255, 255, 0.16) var(--anniversary-mask-progress) 100%
  );
}

.anniversary-mask-control input[type="range"]::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  border: 3px solid rgb(33, 150, 243);
  border-radius: 50%;
  appearance: none;
  background: #fff;
  margin-top: -6px;
}

.anniversary-mask-control output {
  color: rgba(0, 0, 0, 0.56);
  font-size: 12px;
  line-height: 18px;
  text-align: right;
}

.anniversary-action-row {
  display: grid;
  grid-area: actions;
  grid-template-columns: 1fr 1fr;
  align-items: end;
  gap: 20px;
  margin: 0 30px 20px;
}

.anniversary-action-row button {
  height: 31px;
  border: 0;
  border-radius: 16px;
  background: rgb(33, 150, 243);
  color: #fff;
  font-size: 14px;
  line-height: 31px;
}

.anniversary-action-row button:last-child {
  border: 1px solid rgb(220, 223, 230);
  background: rgb(255, 255, 255);
  color: rgb(96, 98, 102);
}
</style>
