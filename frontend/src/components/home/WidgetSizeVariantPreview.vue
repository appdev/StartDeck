<script setup lang="ts">
import { computed } from "vue";
import {
  resolveWidgetFunctionalFace,
  type CatalogWidgetSizeKey,
} from "@/utils/widgetSizePresets";
import type { WidgetCatalogSizePreset } from "@/utils/widgetCatalog";
import { SD_WEATHER_WIDGET_TYPE } from "@/features/sd-weather/sdWeatherTypes";
import { SD_TODO_WIDGET_TYPE } from "@/features/sd-todo/sdTodoTypes";
import { SD_CLOCK_WIDGET_TYPE } from "@/features/sd-clock/sdClockTypes";
import { SD_POMODORO_WIDGET_TYPE } from "@/features/sd-pomodoro/sdPomodoroTypes";
import { SD_ANNIVERSARY_WIDGET_TYPE } from "@/features/sd-anniversary/sdAnniversaryTypes";

const props = defineProps<{
  type: string;
  title: string;
  glyph: string;
  size: WidgetCatalogSizePreset;
  disabled?: boolean;
  reason?: string;
  previewRole?: "variant" | "hero";
}>();

const sizeClass = computed(() => `is-size-${props.size.key.replace(".", "_")}`);
const functionalFace = computed(() =>
  props.type === SD_WEATHER_WIDGET_TYPE
    ? undefined
    : resolveWidgetFunctionalFace(
        props.type,
        props.size.key as CatalogWidgetSizeKey,
      ),
);
const previewMode = computed(() => {
  if (props.type === SD_CLOCK_WIDGET_TYPE) return "clock";
  if (props.type === SD_WEATHER_WIDGET_TYPE) return "weather";
  if (props.type === "custom-css") return "code";
  if (props.type === SD_ANNIVERSARY_WIDGET_TYPE) return "timer";
  if (props.type === SD_POMODORO_WIDGET_TYPE) return "timer";
  if (props.type === SD_TODO_WIDGET_TYPE) return "checklist";
  if (props.type === "docker") return "status-list";
  if (props.type === "system-status") return "metrics";
  return "card";
});

const isCompactSize = computed(() => props.size.key === "1x1");

const rowsByFace: Record<string, string[]> = {
  "custom-mini-preview": ["自定义预览", "HTML", "CSS"],
  "custom-editor-preview": ["编辑预览", "样式", "保存"],
  "custom-code-split": ["代码分栏", "HTML", "CSS"],
  "custom-workbench": ["工作台", "预览", "片段"],
  "docker-compact-containers": ["41 Running", "CPU 12%", "内存"],
  "docker-container-list": ["容器列表", "startdeck", "healthy"],
  "docker-ports-stats": ["端口统计", "23100", "负载"],
  "system-status-cpu-memory": ["CPU 28%", "内存 62%", "磁盘"],
  "system-status-telemetry-strip": ["遥测条", "CPU", "内存"],
  "system-status-gauge-board": ["仪表盘", "CPU", "磁盘"],
};

const contentRows = computed(() => {
  const face = functionalFace.value;
  if (face && rowsByFace[face]) return rowsByFace[face];

  const baseRows: Record<string, string[]> = {
    [SD_CLOCK_WIDGET_TYPE]: ["08:12", "周二"],
    [SD_WEATHER_WIDGET_TYPE]: ["27° 阴", "深圳 龙华", "7日预报"],
    [SD_TODO_WIDGET_TYPE]: ["评审 UI", "补充 QA", "发布"],
    [SD_POMODORO_WIDGET_TYPE]: ["番茄时钟", "25:00", "海浪"],
    [SD_ANNIVERSARY_WIDGET_TYPE]: ["你在世界已经", "10461 天", "1997-10-1"],
    "custom-css": ["自定义 HTML", "CSS 生效", "预览"],
    docker: ["41 Running", "CPU 12%", "内存 2.4G"],
    "system-status": ["CPU 28%", "内存 62%", "磁盘 41%"],
  };
  const rows = baseRows[props.type] || [props.title, "状态", "详情"];
  if (props.size.key === "1x1") return rows.slice(0, 2);
  if (props.size.key === "1x2") return rows.slice(0, 2);
  if (props.size.key === "2x1") return rows.slice(0, 2);
  if (props.size.key === "2x2") return rows.slice(0, 3);
  if (props.size.key === "2x4") return [...rows, "历史", "操作"].slice(0, 6);
  return rows;
});

const detailRows = computed(() => contentRows.value.slice(1));
</script>

<template>
  <div
    class="widget-size-variant-preview"
    :class="[sizeClass, { 'is-disabled': disabled }]"
    :aria-disabled="disabled ? 'true' : 'false'"
    :title="disabled ? reason : `${title} ${size.label}`"
    :data-widget-type="type"
    :data-size-key="size.key"
    :data-functional-face="functionalFace || 'unsupported'"
    :data-preview-role="previewRole || 'variant'"
  >
    <div class="widget-size-variant-head">
      <span class="widget-size-variant-glyph">{{ glyph }}</span>
      <span>{{ size.label }}</span>
    </div>

    <div v-if="previewMode === 'clock'" class="widget-size-clock-preview">
      <strong>{{ contentRows[0] }}</strong>
      <span>{{ contentRows[1] }}</span>
      <div v-if="!isCompactSize" class="widget-size-chip-row">
        <span>数字</span>
        <span>模拟</span>
      </div>
    </div>

    <div
      v-else-if="previewMode === 'weather'"
      class="widget-size-weather-preview"
    >
      <strong>{{ contentRows[0] }}</strong>
      <span>{{ contentRows[1] }}</span>
      <div v-if="!isCompactSize" class="widget-size-hourly-strip">
        <i v-for="row in contentRows.slice(1, 4)" :key="row">{{ row }}</i>
      </div>
    </div>

    <div v-else-if="previewMode === 'code'" class="widget-size-code-preview">
      <strong>{{ contentRows[0] }}</strong>
      <span v-for="row in detailRows" :key="row">{{ row }}</span>
    </div>

    <div v-else-if="previewMode === 'timer'" class="widget-size-timer-preview">
      <span>{{ contentRows[0] }}</span>
      <strong>{{ contentRows[1] }}</strong>
      <em v-if="!isCompactSize">{{ contentRows[2] }}</em>
    </div>

    <div
      v-else-if="previewMode === 'metrics'"
      class="widget-size-metric-preview"
    >
      <span v-for="row in contentRows" :key="row">{{ row }}</span>
    </div>

    <div
      v-else-if="previewMode === 'status-list'"
      class="widget-size-status-list-preview"
    >
      <span v-for="row in contentRows" :key="row">{{ row }}</span>
    </div>

    <div v-else class="widget-size-card-preview">
      <strong>{{ contentRows[0] }}</strong>
      <span v-for="row in detailRows" :key="row">{{ row }}</span>
    </div>

    <div v-if="disabled" class="widget-size-variant-disabled">不可用</div>
  </div>
</template>

<style scoped>
.widget-size-variant-preview {
  position: relative;
  display: grid;
  min-width: 7.5rem;
  min-height: 6.5rem;
  gap: 0.5rem;
  align-content: start;
  overflow: hidden;
  border: 1px solid var(--sd-widget-border);
  border-radius: calc(var(--sd-widget-radius) * 0.75);
  background: var(--sd-widget-surface);
  color: var(--sd-widget-text-primary);
  padding: 0.625rem;
  box-shadow: 0 1px 2px
    color-mix(in srgb, var(--sd-widget-text-primary) 7%, transparent);
}

.widget-size-variant-preview.is-size-1x2 {
  min-width: 10.5rem;
}

.widget-size-variant-preview.is-size-2x1 {
  min-height: 8.5rem;
}

.widget-size-variant-preview.is-size-2x4 {
  min-width: 15rem;
}

.widget-size-variant-preview.is-size-2x2,
.widget-size-variant-preview.is-size-2x4 {
  min-height: 8.5rem;
}

.widget-size-variant-preview.is-disabled {
  background:
    linear-gradient(
      135deg,
      transparent 0 46%,
      color-mix(in srgb, var(--sd-widget-disabled-text) 54%, transparent) 47%
        53%,
      transparent 54%
    ),
    var(--sd-widget-disabled-bg);
  color: var(--sd-widget-disabled-text);
}

.widget-size-variant-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--sd-widget-text-secondary);
  font-size: 0.75rem;
  font-weight: 800;
}

.widget-size-variant-glyph {
  display: inline-flex;
  width: 1.5rem;
  height: 1.5rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: var(--sd-widget-control-bg);
  color: var(--sd-widget-accent);
  font-size: 0.6875rem;
}

.widget-size-variant-lines {
  display: grid;
  gap: 0.375rem;
}

.widget-size-variant-lines span {
  display: block;
  height: 0.625rem;
  border-radius: 999px;
  background: color-mix(
    in srgb,
    var(--sd-widget-accent) 18%,
    var(--sd-widget-surface-muted)
  );
}

.widget-size-variant-lines span:nth-child(2) {
  width: 74%;
  background: var(--sd-widget-surface-muted);
}

.widget-size-variant-lines span:nth-child(3),
.widget-size-variant-lines span:nth-child(4) {
  width: 58%;
  background: color-mix(
    in srgb,
    var(--sd-widget-success) 16%,
    var(--sd-widget-surface-muted)
  );
}

.widget-size-metric-preview,
.widget-size-status-list-preview,
.widget-size-clock-preview,
.widget-size-weather-preview,
.widget-size-code-preview,
.widget-size-timer-preview,
.widget-size-card-preview {
  display: grid;
  min-width: 0;
  gap: 0.375rem;
}

.widget-size-clock-preview strong,
.widget-size-weather-preview strong,
.widget-size-code-preview strong,
.widget-size-timer-preview strong,
.widget-size-card-preview strong {
  min-width: 0;
  color: var(--sd-widget-text-primary);
  font-size: 0.75rem;
  font-weight: 900;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.widget-size-clock-preview span,
.widget-size-weather-preview span,
.widget-size-code-preview span,
.widget-size-timer-preview span,
.widget-size-timer-preview em,
.widget-size-card-preview span {
  min-width: 0;
  color: var(--sd-widget-text-secondary);
  font-size: 0.6875rem;
  font-style: normal;
  font-weight: 750;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.widget-size-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.widget-size-chip-row span,
.widget-size-metric-preview span,
.widget-size-status-list-preview span,
.widget-size-hourly-strip i {
  min-width: 0;
  border: 1px solid var(--sd-widget-border);
  border-radius: 999px;
  background: var(--sd-widget-control-bg);
  color: var(--sd-widget-text-secondary);
  padding: 0.25rem 0.4375rem;
  font-size: 0.625rem;
  font-weight: 800;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.widget-size-metric-preview {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.widget-size-metric-preview span:first-child,
.widget-size-status-list-preview span:first-child {
  border-color: color-mix(in srgb, var(--sd-widget-accent) 32%, transparent);
  background: color-mix(
    in srgb,
    var(--sd-widget-accent) 14%,
    var(--sd-widget-control-bg)
  );
  color: var(--sd-widget-text-primary);
}

.widget-size-status-list-preview {
  gap: 0.25rem;
}

.widget-size-status-list-preview span {
  border-radius: 0.625rem;
}

.widget-size-clock-preview strong {
  font-size: 1.25rem;
  letter-spacing: 0;
}

.widget-size-weather-preview strong,
.widget-size-timer-preview strong {
  font-size: 1.1rem;
}

.widget-size-hourly-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.25rem;
}

.widget-size-code-preview {
  border-radius: 0.75rem;
  background: color-mix(
    in srgb,
    var(--sd-widget-text-primary) 6%,
    var(--sd-widget-control-bg)
  );
  padding: 0.5rem;
}

.widget-size-code-preview span {
  border-left: 2px solid var(--sd-widget-accent);
  padding-left: 0.375rem;
}

.widget-size-timer-preview {
  place-items: start;
}

.widget-size-timer-preview strong {
  border-radius: 0.75rem;
  background: color-mix(
    in srgb,
    var(--sd-widget-accent) 14%,
    var(--sd-widget-control-bg)
  );
  padding: 0.375rem 0.5rem;
}

.widget-size-card-preview {
  gap: 0.25rem;
}

.widget-size-card-preview span {
  min-width: 0;
  color: var(--sd-widget-text-secondary);
  font-size: 0.625rem;
  font-weight: 800;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.widget-size-variant-disabled {
  position: absolute;
  inset: auto 0.5rem 0.5rem auto;
  border-radius: 999px;
  background: var(--sd-widget-disabled-bg);
  color: var(--sd-widget-disabled-text);
  padding: 0.1875rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 800;
}
</style>
