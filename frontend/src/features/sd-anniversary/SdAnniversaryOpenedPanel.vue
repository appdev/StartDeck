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
import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";
import SdAnniversaryCard from "./SdAnniversaryCard.vue";
import { normalizeSdAnniversaryWidgetData } from "./sdAnniversaryModel";
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
  useSdAnniversaryRuntime,
} from "./useSdAnniversaryRuntime";
import type {
  SdAnniversaryBackgroundMode,
  SdAnniversaryTemplate,
  SdAnniversaryWidgetData,
} from "./sdAnniversaryTypes";

const props = defineProps<{
  widget: WidgetConfig;
}>();

const emit = defineEmits<{
  addData: [data: SdAnniversaryWidgetData];
  close: [];
  updateData: [data: SdAnniversaryWidgetData];
}>();

const widgetRef = computed(() => props.widget);
const runtime = useSdAnniversaryRuntime(widgetRef);
const activeTemplateId = ref("life");
const activePreviewSize = ref<SdWidgetSizeKey>("2x2");
const asideCollapsed = ref(false);
const repeatDropdownOpen = ref(false);
const datePickerOpen = ref(false);
type AnniversaryColorPickerTarget = "text" | "background";

const toHexColor = (hex: string) => `#${hex}`;
const colorPickerDefaultHex = toHexColor("ffffff");
const colorPickerTarget = ref<AnniversaryColorPickerTarget | null>(null);
const colorPickerHue = ref(0);
const colorPickerSaturation = ref(100);
const colorPickerValue = ref(100);
const colorPickerHex = ref(colorPickerDefaultHex);
const colorPickerPresets = [
  "ff4b0a",
  "ff8a00",
  "ffcc00",
  "7ee681",
  "11c5c8",
  "1890ff",
  "c91586",
].map(toHexColor);
const editor = reactive<SdAnniversaryWidgetData>(
  normalizeSdAnniversaryWidgetData(props.widget.data),
);

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);

const normalizeHexColor = (value: string) => {
  const cleaned = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return `#${cleaned
      .split("")
      .map((character) => `${character}${character}`)
      .join("")
      .toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toLowerCase()}`;
  }
  return null;
};

const rgbToHex = (red: number, green: number, blue: number) =>
  `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;

const hsvToHex = (hue: number, saturation: number, value: number) => {
  const chroma = (value / 100) * (saturation / 100);
  const huePrime = (((hue % 360) + 360) % 360) / 60;
  const secondary = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = value / 100 - chroma;
  const [red, green, blue] =
    huePrime < 1
      ? [chroma, secondary, 0]
      : huePrime < 2
        ? [secondary, chroma, 0]
        : huePrime < 3
          ? [0, chroma, secondary]
          : huePrime < 4
            ? [0, secondary, chroma]
            : huePrime < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];

  return rgbToHex(
    Math.round((red + match) * 255),
    Math.round((green + match) * 255),
    Math.round((blue + match) * 255),
  );
};

const hexToHsv = (hex: string) => {
  const normalized = normalizeHexColor(hex) || colorPickerDefaultHex;
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const hue =
    delta === 0
      ? 0
      : max === red
        ? 60 * (((green - blue) / delta) % 6)
        : max === green
          ? 60 * ((blue - red) / delta + 2)
          : 60 * ((red - green) / delta + 4);

  return {
    hue: Math.round((hue + 360) % 360),
    saturation: max === 0 ? 0 : Math.round((delta / max) * 100),
    value: Math.round(max * 100),
  };
};

const syncColorPickerHex = () => {
  colorPickerHex.value = hsvToHex(
    colorPickerHue.value,
    colorPickerSaturation.value,
    colorPickerValue.value,
  );
};

const setColorPickerFromHex = (hex: string) => {
  const normalized = normalizeHexColor(hex) || colorPickerDefaultHex;
  const hsv = hexToHsv(normalized);
  colorPickerHue.value = hsv.hue;
  colorPickerSaturation.value = hsv.saturation;
  colorPickerValue.value = hsv.value;
  colorPickerHex.value = normalized;
};

const colorPickerDraftColor = computed(
  () =>
    normalizeHexColor(colorPickerHex.value) ||
    hsvToHex(
      colorPickerHue.value,
      colorPickerSaturation.value,
      colorPickerValue.value,
    ),
);

const colorPickerPaletteStyle = computed(() => ({
  "--picker-hue-color": `hsl(${colorPickerHue.value} 100% 50%)`,
}));

const colorPickerPointerStyle = computed(() => ({
  left: `${colorPickerSaturation.value}%`,
  top: `${100 - colorPickerValue.value}%`,
}));

const colorPickerHuePointerStyle = computed(() => ({
  top: `${(colorPickerHue.value / 360) * 100}%`,
}));

const syncEditor = (data: SdAnniversaryWidgetData) => {
  Object.assign(editor, data);
  activePreviewSize.value = data.sizeKey;
  repeatDropdownOpen.value = false;
  datePickerOpen.value = false;
  colorPickerTarget.value = null;
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
const editorTemplate = computed<SdAnniversaryTemplate>(() => ({
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
const templateThumbnail = (template: SdAnniversaryTemplate) =>
  template.id === "life"
    ? anniversaryTemplates.find((item) => item.id === "plain-life") || template
    : template;
const thumbnailWithSize = (template: SdAnniversaryTemplate) =>
  anniversaryTemplateWithSize(templateThumbnail(template), editor.sizeKey);
const isTemplateActive = (template: SdAnniversaryTemplate) =>
  template.id === activeTemplateId.value ||
  (activeTemplateId.value === "plain-life" && template.id === "life");
const isDotActive = (index: number) =>
  anniversaryPreviewSizes[index % anniversaryPreviewSizes.length] ===
  activePreviewSize.value;

const isEditorSize = (
  sizeKey: SdWidgetSizeKey,
): sizeKey is Extract<SdWidgetSizeKey, "2x2" | "2x4"> =>
  anniversaryEditorSizes.some((candidate) => candidate === sizeKey);

const selectPreviewSize = (sizeKey: SdWidgetSizeKey) => {
  activePreviewSize.value = sizeKey;
  if (isEditorSize(sizeKey)) {
    editor.sizeKey = sizeKey;
  }
};

const selectTemplate = (template: SdAnniversaryTemplate) => {
  const sizeKey = editor.sizeKey;
  const next = normalizeSdAnniversaryWidgetData({
    ...template,
    sizeKey,
  });
  Object.assign(editor, next);
  activeTemplateId.value = template.id;
  activePreviewSize.value = sizeKey;
  repeatDropdownOpen.value = false;
  datePickerOpen.value = false;
};

const setEditorSize = (sizeKey: Extract<SdWidgetSizeKey, "2x2" | "2x4">) => {
  selectPreviewSize(sizeKey);
};

const shiftPreview = (direction: -1 | 1) => {
  const currentIndex = Math.max(
    0,
    anniversaryPreviewSizes.indexOf(activePreviewSize.value),
  );
  const nextIndex =
    (currentIndex + direction + anniversaryPreviewSizes.length) %
    anniversaryPreviewSizes.length;
  selectPreviewSize(anniversaryPreviewSizes[nextIndex] || "2x2");
};

const selectDot = (index: number) => {
  selectPreviewSize(
    anniversaryPreviewSizes[index % anniversaryPreviewSizes.length] || "2x2",
  );
};

const toggleAside = () => {
  asideCollapsed.value = !asideCollapsed.value;
};

const closeFloatingControls = () => {
  (
    editor as SdAnniversaryWidgetData & { showCommonEvents?: boolean }
  ).showCommonEvents = false;
  repeatDropdownOpen.value = false;
  datePickerOpen.value = false;
  colorPickerTarget.value = null;
};

const handleOutsidePointerDown = (event: PointerEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    closeFloatingControls();
    return;
  }
  if (
    target.closest(
      ".anniversary-common-trigger,.anniversary-event-popover,.anniversary-date-trigger,.anniversary-date-popper,.anniversary-repeat-select,.anniversary-gradient-swatch,.anniversary-color-picker-popover",
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
    editor as SdAnniversaryWidgetData & { showCommonEvents?: boolean }
  ).showCommonEvents = false;
  datePickerOpen.value = false;
};

const toggleCommonEvents = () => {
  (
    editor as SdAnniversaryWidgetData & { showCommonEvents?: boolean }
  ).showCommonEvents = !(
    editor as SdAnniversaryWidgetData & { showCommonEvents?: boolean }
  ).showCommonEvents;
  repeatDropdownOpen.value = false;
  datePickerOpen.value = false;
};

const commonEventsOpen = computed(() =>
  Boolean(
    (editor as SdAnniversaryWidgetData & { showCommonEvents?: boolean })
      .showCommonEvents,
  ),
);

const toggleRepeatDropdown = () => {
  repeatDropdownOpen.value = !repeatDropdownOpen.value;
  (
    editor as SdAnniversaryWidgetData & { showCommonEvents?: boolean }
  ).showCommonEvents = false;
  datePickerOpen.value = false;
};

const selectRepeat = (option: SdAnniversaryWidgetData["repeat"]) => {
  editor.repeat = option;
  repeatDropdownOpen.value = false;
  datePickerOpen.value = false;
};

const toggleDatePicker = () => {
  datePickerOpen.value = !datePickerOpen.value;
  repeatDropdownOpen.value = false;
  (
    editor as SdAnniversaryWidgetData & { showCommonEvents?: boolean }
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

const isPresetColor = (colors: string[], color: string) =>
  colors.some((candidate) => candidate.toLowerCase() === color.toLowerCase());

const openColorPicker = (target: AnniversaryColorPickerTarget) => {
  const color = target === "text" ? editor.textColor : editor.backgroundColor;
  setColorPickerFromHex(color);
  colorPickerTarget.value = target;
  repeatDropdownOpen.value = false;
  datePickerOpen.value = false;
  (
    editor as SdAnniversaryWidgetData & { showCommonEvents?: boolean }
  ).showCommonEvents = false;
};

const setColorPickerHsv = (hue: number, saturation: number, value: number) => {
  colorPickerHue.value = Math.min(Math.max(hue, 0), 360);
  colorPickerSaturation.value = clampPercent(saturation);
  colorPickerValue.value = clampPercent(value);
  syncColorPickerHex();
};

const setColorPickerPreset = (color: string) => {
  setColorPickerFromHex(color);
};

const handleColorPickerHexInput = (value: string) => {
  colorPickerHex.value = value;
  const normalized = normalizeHexColor(value);
  if (normalized) {
    setColorPickerFromHex(normalized);
  }
};

const commitColorPickerHex = () => {
  setColorPickerFromHex(colorPickerHex.value);
};

const clearColorPickerDraft = () => {
  setColorPickerFromHex(colorPickerDefaultHex);
};

const applyColorPickerDraft = () => {
  const color = colorPickerDraftColor.value;
  if (colorPickerTarget.value === "text") {
    setTextColor(color);
  } else if (colorPickerTarget.value === "background") {
    setBackgroundColor(color);
  }
  colorPickerTarget.value = null;
};

const updateColorPickerSvFromPointer = (
  element: HTMLElement,
  event: PointerEvent,
) => {
  const rect = element.getBoundingClientRect();
  const saturation = ((event.clientX - rect.left) / rect.width) * 100;
  const value = 100 - ((event.clientY - rect.top) / rect.height) * 100;
  setColorPickerHsv(colorPickerHue.value, saturation, value);
};

const startColorPickerSvDrag = (event: PointerEvent) => {
  const element = event.currentTarget as HTMLElement;
  updateColorPickerSvFromPointer(element, event);
  const handlePointerMove = (moveEvent: PointerEvent) =>
    updateColorPickerSvFromPointer(element, moveEvent);
  const handlePointerUp = () => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  };
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  event.preventDefault();
};

const updateColorPickerHueFromPointer = (
  element: HTMLElement,
  event: PointerEvent,
) => {
  const rect = element.getBoundingClientRect();
  const hue = ((event.clientY - rect.top) / rect.height) * 360;
  setColorPickerHsv(hue, colorPickerSaturation.value, colorPickerValue.value);
};

const startColorPickerHueDrag = (event: PointerEvent) => {
  const element = event.currentTarget as HTMLElement;
  updateColorPickerHueFromPointer(element, event);
  const handlePointerMove = (moveEvent: PointerEvent) =>
    updateColorPickerHueFromPointer(element, moveEvent);
  const handlePointerUp = () => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  };
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  event.preventDefault();
};

const setTextColor = (color: string) => {
  editor.textColor = color;
  colorPickerTarget.value = null;
};

const setBackgroundColor = (color: string) => {
  editor.backgroundColor = color;
  editor.backgroundMode = "color";
  colorPickerTarget.value = null;
};

const setBackgroundMode = (mode: SdAnniversaryBackgroundMode) => {
  editor.backgroundMode = mode;
  colorPickerTarget.value = null;
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
  normalizeSdAnniversaryWidgetData({
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
    data-sd-anniversary-opened-panel
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
          <SdAnniversaryCard
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
        <SdAnniversaryCard
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
            :class="{
              active:
                colorPickerTarget === 'text' ||
                !isPresetColor(anniversaryTextColors, editor.textColor),
            }"
            aria-label="更多字体颜色"
            @click="openColorPicker('text')"
            @keydown.enter.prevent="openColorPicker('text')"
            @keydown.space.prevent="openColorPicker('text')"
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
            :class="{
              active:
                colorPickerTarget === 'background' ||
                (editor.backgroundMode === 'color' &&
                  !isPresetColor(
                    anniversaryBackgroundColors,
                    editor.backgroundColor,
                  )),
            }"
            aria-label="更多背景颜色"
            @click="openColorPicker('background')"
            @keydown.enter.prevent="openColorPicker('background')"
            @keydown.space.prevent="openColorPicker('background')"
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

    <div
      v-if="colorPickerTarget"
      class="anniversary-color-picker-popover"
      data-sd-anniversary-color-picker
      @pointerdown.stop
    >
      <div class="anniversary-color-picker-main">
        <button
          type="button"
          class="anniversary-color-picker-palette"
          :style="colorPickerPaletteStyle"
          aria-label="颜色明度和饱和度"
          @pointerdown="startColorPickerSvDrag"
        >
          <span
            class="anniversary-color-picker-point"
            :style="colorPickerPointerStyle"
          ></span>
        </button>
        <button
          type="button"
          class="anniversary-color-picker-hue"
          aria-label="颜色色相"
          @pointerdown="startColorPickerHueDrag"
        >
          <span :style="colorPickerHuePointerStyle"></span>
        </button>
      </div>
      <div class="anniversary-color-picker-presets">
        <button
          v-for="color in colorPickerPresets"
          :key="`anniversary-picker-${color}`"
          type="button"
          :class="{ active: colorPickerDraftColor === color }"
          :style="{ '--picker-preset-color': color }"
          :aria-label="`预设颜色 ${color}`"
          @click="setColorPickerPreset(color)"
        ></button>
      </div>
      <div class="anniversary-color-picker-footer">
        <input
          :value="colorPickerHex"
          aria-label="颜色值"
          spellcheck="false"
          @input="
            handleColorPickerHexInput(($event.target as HTMLInputElement).value)
          "
          @change="commitColorPickerHex"
          @keydown.enter.prevent="applyColorPickerDraft"
        />
        <button type="button" @click="clearColorPickerDraft">清空</button>
        <button type="button" @click="applyColorPickerDraft">确定</button>
      </div>
    </div>

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
    var(--sd-theme-anniversary-anniversary-opened-panel-surface-01) 0 374px,
    var(--sd-theme-anniversary-anniversary-opened-panel-surface-02) 374px
      100%
  );
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-01);
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
    var(--sd-theme-anniversary-anniversary-opened-panel-surface-01) 0 70px,
    var(--sd-theme-anniversary-anniversary-opened-panel-surface-02) 70px
      100%
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
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-02);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.anniversary-template-divider {
  width: 300px;
  height: 1px;
  margin: 0 0 4px;
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-03
  );
}

.anniversary-editor-heading {
  display: flex;
  min-height: 28px;
  align-items: center;
}

.anniversary-editor-heading strong {
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-03);
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
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-03
  );
}

.anniversary-size-row::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  width: calc(50% - 2px);
  border-radius: 14px;
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-04
  );
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
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-04);
  font-size: 14px;
  line-height: 28px;
}

.anniversary-size-row button.active {
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-05);
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
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-01);
  cursor: pointer;
  text-align: center;
}

.anniversary-template-card b {
  overflow: hidden;
  max-width: 125px;
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-01);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.anniversary-template-card.active :deep(.sd-anniversary-card) {
  box-shadow:
    0 0 0 1px
      var(--sd-theme-anniversary-anniversary-opened-panel-shadow-01),
    0 0 0 3px
      var(--sd-theme-anniversary-anniversary-opened-panel-shadow-02),
    0 0 10px 3px
      var(--sd-theme-anniversary-anniversary-opened-panel-shadow-03);
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
  border: 1px solid
    var(--sd-theme-anniversary-anniversary-opened-panel-border-04);
  border-radius: 50%;
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-17
  );
  box-shadow: 0 6px 18px
    var(--sd-theme-anniversary-anniversary-opened-panel-shadow-06);
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-01);
  font-size: 30px;
  line-height: 26px;
  text-shadow: 0 1px 2px
    var(--sd-theme-anniversary-anniversary-opened-panel-shadow-05);
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
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-06
  );
  cursor: pointer;
}

.anniversary-carousel-dots span.active {
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-07
  );
  transform: scale(1.4);
}

.anniversary-preview-name {
  margin-top: 3px;
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-01);
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
  border: 1px solid
    var(--sd-theme-anniversary-anniversary-opened-panel-border-04);
  border-radius: 50%;
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-17
  );
  box-shadow: 0 6px 18px
    var(--sd-theme-anniversary-anniversary-opened-panel-shadow-06);
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-01);
  font-size: 30px;
  line-height: 26px;
  text-shadow: 0 1px 2px
    var(--sd-theme-anniversary-anniversary-opened-panel-shadow-05);
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
  scrollbar-color: var(--sd-scrollbar-thumb) var(--sd-scrollbar-track);
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
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-08);
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
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-01
  );
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-09);
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
  color: var(
    --sd-theme-anniversary-anniversary-opened-panel-accent-text-01
  );
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
  fill: var(--sd-theme-anniversary-anniversary-opened-panel-fill-01);
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
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-09
  );
  box-shadow:
    0 0 1px var(--sd-theme-anniversary-anniversary-opened-panel-shadow-04),
    0 8px 24px
      var(--sd-theme-anniversary-anniversary-opened-panel-shadow-05);
}

.anniversary-date-popper::before {
  position: absolute;
  top: -5px;
  left: 154px;
  width: 10px;
  height: 10px;
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-09
  );
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
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-10
  );
}

.anniversary-picker-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: linear-gradient(
    180deg,
    var(--sd-theme-anniversary-anniversary-opened-panel-surface-09) 0%,
    var(--sd-theme-anniversary-anniversary-opened-panel-surface-11) 20%,
    var(--sd-theme-anniversary-anniversary-opened-panel-surface-12) 42%,
    var(--sd-theme-anniversary-anniversary-opened-panel-surface-12) 58%,
    var(--sd-theme-anniversary-anniversary-opened-panel-surface-11) 80%,
    var(--sd-theme-anniversary-anniversary-opened-panel-surface-09) 100%
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
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-10);
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
  border: 1px solid
    var(--sd-theme-anniversary-anniversary-opened-panel-border-01);
  border-radius: 14px;
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-01
  );
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-11);
  cursor: pointer;
}

.anniversary-select-trigger.active {
  border-color: var(
    --sd-theme-anniversary-anniversary-opened-panel-border-02
  );
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
  border: 1px solid
    var(--sd-theme-anniversary-anniversary-opened-panel-border-03);
  border-radius: 4px;
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-13
  );
  box-shadow: 0 2px 12px
    var(--sd-theme-anniversary-anniversary-opened-panel-shadow-03);
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-12);
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
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-14
  );
  color: var(
    --sd-theme-anniversary-anniversary-opened-panel-accent-text-01
  );
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
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-09
  );
  box-shadow:
    0 0 1px var(--sd-theme-anniversary-anniversary-opened-panel-shadow-04),
    0 8px 24px
      var(--sd-theme-anniversary-anniversary-opened-panel-shadow-05);
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-13);
  font-size: 12px;
  line-height: 24px;
}

.anniversary-event-popover::before {
  position: absolute;
  top: 13px;
  left: 13px;
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-13);
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
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-09
  );
  content: "";
  transform: rotate(45deg);
}

.anniversary-event-popover > div {
  height: 24px;
  padding: 0 10px;
  border: 1px solid
    var(--sd-theme-anniversary-anniversary-opened-panel-border-04);
  border-radius: 20px;
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-15
  );
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-14);
  cursor: pointer;
  white-space: nowrap;
}

.anniversary-event-popover > div:hover,
.anniversary-event-popover > div.active {
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-16
  );
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-15);
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
  box-shadow: 0 0 0 1px
    var(--sd-theme-anniversary-anniversary-opened-panel-shadow-06);
}

.anniversary-color-swatches span.active::after {
  position: absolute;
  inset: -2px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-17
  );
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-16);
  content: "✓";
  font-size: 14px;
  font-weight: 700;
}

.anniversary-gradient-swatch {
  background: conic-gradient(
    from 180deg,
    var(--sd-theme-anniversary-anniversary-opened-panel-accent-surface-01),
    var(--sd-theme-anniversary-anniversary-opened-panel-accent-surface-02),
    var(--sd-theme-anniversary-anniversary-opened-panel-accent-surface-03),
    var(--sd-theme-anniversary-anniversary-opened-panel-accent-surface-04),
    var(--sd-theme-anniversary-anniversary-opened-panel-accent-surface-05),
    var(--sd-theme-anniversary-anniversary-opened-panel-accent-surface-01)
  ) !important;
}

.anniversary-color-picker-popover {
  position: absolute;
  right: 24px;
  bottom: 52px;
  z-index: 20;
  width: 344px;
  padding: 12px;
  border: 1px solid
    var(--sd-theme-anniversary-anniversary-opened-panel-border-04);
  border-radius: 4px;
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-09
  );
  box-shadow:
    0 0 1px var(--sd-theme-anniversary-anniversary-opened-panel-shadow-04),
    0 12px 30px
      var(--sd-theme-anniversary-anniversary-opened-panel-shadow-05);
}

.anniversary-color-picker-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 12px;
  gap: 8px;
}

.anniversary-color-picker-palette,
.anniversary-color-picker-hue,
.anniversary-color-picker-presets button,
.anniversary-color-picker-footer button {
  padding: 0;
  border: 0;
  cursor: pointer;
}

.anniversary-color-picker-palette {
  position: relative;
  height: 190px;
  overflow: hidden;
  background:
    linear-gradient(to top, black, transparent),
    linear-gradient(to right, white, var(--picker-hue-color));
}

.anniversary-color-picker-point {
  position: absolute;
  width: 8px;
  height: 8px;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow:
    0 0 0 1px
      var(--sd-theme-anniversary-anniversary-opened-panel-shadow-04),
    0 1px 4px
      var(--sd-theme-anniversary-anniversary-opened-panel-shadow-06);
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.anniversary-color-picker-hue {
  position: relative;
  overflow: hidden;
  background: linear-gradient(
    to bottom,
    red,
    yellow,
    lime,
    cyan,
    blue,
    magenta,
    red
  );
}

.anniversary-color-picker-hue span {
  position: absolute;
  left: -2px;
  width: 16px;
  height: 4px;
  border: 1px solid white;
  border-radius: 4px;
  background: transparent;
  box-shadow: 0 1px 3px
    var(--sd-theme-anniversary-anniversary-opened-panel-shadow-06);
  pointer-events: none;
  transform: translateY(-50%);
}

.anniversary-color-picker-presets {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.anniversary-color-picker-presets button {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--picker-preset-color);
  box-shadow: 0 0 0 1px
    var(--sd-theme-anniversary-anniversary-opened-panel-shadow-06);
}

.anniversary-color-picker-presets button.active {
  box-shadow:
    0 0 0 2px
      var(--sd-theme-anniversary-anniversary-opened-panel-surface-09),
    0 0 0 4px
      var(
        --sd-theme-anniversary-anniversary-opened-panel-accent-surface-06
      );
}

.anniversary-color-picker-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px 48px;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.anniversary-color-picker-footer input {
  width: 100%;
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: 13px;
  outline: none;
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-01
  );
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-09);
  font-size: 13px;
}

.anniversary-color-picker-footer button {
  height: 26px;
  border-radius: 13px;
  background: transparent;
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-08);
  font-size: 13px;
}

.anniversary-color-picker-footer button:last-child {
  border: 1px solid
    var(--sd-theme-anniversary-anniversary-opened-panel-border-01);
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-01
  );
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-01);
  font-weight: 600;
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
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-02);
  font-size: 13px;
  line-height: 16px;
}

.anniversary-background-mode button.active {
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-06
  );
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-17);
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
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-01
  );
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
  border: 2px solid
    var(--sd-theme-anniversary-anniversary-opened-panel-accent-border-01);
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
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-01);
  line-height: 24px;
}

.anniversary-mask-row > span {
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-01);
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
    var(--sd-theme-anniversary-anniversary-opened-panel-accent-surface-06)
      0 var(--anniversary-mask-progress),
    var(--sd-theme-anniversary-anniversary-opened-panel-surface-18)
      var(--anniversary-mask-progress) 100%
  );
}

.anniversary-mask-control input[type="range"]::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  border: 3px solid
    var(--sd-theme-anniversary-anniversary-opened-panel-accent-border-01);
  border-radius: 50%;
  appearance: none;
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-13
  );
  margin-top: -6px;
}

.anniversary-mask-control output {
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-11);
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
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-accent-surface-06
  );
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-05);
  font-size: 14px;
  line-height: 31px;
}

.anniversary-action-row button:last-child {
  border: 1px solid
    var(--sd-theme-anniversary-anniversary-opened-panel-border-05);
  background: var(
    --sd-theme-anniversary-anniversary-opened-panel-surface-01
  );
  color: var(--sd-theme-anniversary-anniversary-opened-panel-text-09);
}
</style>
