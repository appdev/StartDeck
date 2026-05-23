<script setup lang="ts">
import { computed } from "vue";
import {
  resolveWidgetFunctionalFace,
  type CatalogWidgetSizeKey,
} from "@/utils/widgetSizePresets";
import type { WidgetCatalogSizePreset } from "@/utils/widgetCatalog";
import { ITAB_WEATHER_WIDGET_TYPE } from "@/features/itab-weather/itabWeatherTypes";
import { ITAB_TODO_WIDGET_TYPE } from "@/features/itab-todo/itabTodoTypes";
import { ITAB_CLOCK_WIDGET_TYPE } from "@/features/itab-clock/itabClockTypes";
import { ITAB_POMODORO_WIDGET_TYPE } from "@/features/itab-pomodoro/itabPomodoroTypes";
import { ITAB_ANNIVERSARY_WIDGET_TYPE } from "@/features/itab-anniversary/itabAnniversaryTypes";

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
  props.type === ITAB_WEATHER_WIDGET_TYPE
    ? undefined
    : resolveWidgetFunctionalFace(
        props.type,
        props.size.key as CatalogWidgetSizeKey,
      ),
);
const previewMode = computed(() => {
  if (props.type === ITAB_CLOCK_WIDGET_TYPE) return "clock";
  if (props.type === ITAB_WEATHER_WIDGET_TYPE) return "weather";
  if (props.type === "div-card") return "link-card";
  if (props.type === "iframe") return "window";
  if (props.type === "custom-css") return "code";
  if (props.type === "countdown" || props.type === "countup") return "timer";
  if (props.type === ITAB_ANNIVERSARY_WIDGET_TYPE) return "timer";
  if (props.type === ITAB_POMODORO_WIDGET_TYPE) return "timer";
  if (props.type === "search") return "search";
  if (props.type === "calculator") return "calculator";
  if (props.type === "file-transfer") return "transfer";
  if (props.type === ITAB_TODO_WIDGET_TYPE) return "checklist";
  if (["hot", "rss", "bookmarks"].includes(props.type)) return "feed";
  if (["docker", "status-monitor"].includes(props.type)) return "status-list";
  if (["ip", "system-status"].includes(props.type)) return "metrics";
  return "card";
});

const isCompactSize = computed(() => props.size.key === "1x1");

const rowsByFace: Record<string, string[]> = {
  "search-launcher": ["搜索入口", "快捷启动", "引擎"],
  "search-active-input": ["StartDeck", "输入中", "最近命令"],
  "search-engine-menu-preview": ["引擎菜单", "Google", "Bing"],
  "div-card-quick-rail": ["豆包", "常用", "公开"],
  "div-card-link-tile": ["豆包", "链接卡片", "图标"],
  "div-card-edit-strip": ["链接编辑", "标题", "外观"],
  "bookmarks-recent-link": ["最近链接", "GitHub", "打开"],
  "bookmarks-search-category": ["书签搜索", "工作", "个人"],
  "bookmarks-category-list": ["分类列表", "GitHub", "文档"],
  "bookmarks-management-board": ["管理面板", "分类", "批量"],
  "iframe-loading-frame": ["服务面板", "加载中", "刷新"],
  "iframe-blocked-fit": ["嵌入受限", "适配", "外部打开"],
  "iframe-browser-workspace": ["浏览工作区", "地址", "刷新"],
  "custom-mini-preview": ["自定义预览", "HTML", "CSS"],
  "custom-editor-preview": ["编辑预览", "样式", "保存"],
  "custom-code-split": ["代码分栏", "HTML", "CSS"],
  "custom-workbench": ["工作台", "预览", "片段"],
  "countdown-compact-timer": ["发布倒计时", "03 天", "14:00"],
  "countdown-style-strip": ["倒计时样式", "卡片", "进度"],
  "countdown-settings-state": ["倒计时设置", "目标", "样式"],
  "countup-running-compact": ["运行时长", "18 天", "稳定"],
  "countup-control-strip": ["计时控制", "暂停", "继续"],
  "countup-format-panel": ["格式面板", "天 / 时", "重置"],
  "calculator-condensed-keypad": ["128 × 4", "= 512", "键盘"],
  "calculator-wide-keypad": ["宽键盘", "表达式", "结果"],
  "calculator-full": ["完整计算器", "历史", "运算"],
  "calculator-wide-board": ["宽屏计算", "表达式", "历史"],
  "file-transfer-chat-composer": ["文本发送", "文件选择", "接收状态"],
  "file-transfer-queue-panel": ["传输队列", "82%", "复制"],
  "file-transfer-files-manage": ["文件管理", "接收", "清空"],
  "file-transfer-split": ["传输分栏", "上传", "文本"],
  "hot-top-rank": ["热榜第一", "巴西队名单", "刷新"],
  "hot-tabs-strip": ["平台切换", "微博", "知乎"],
  "hot-ranked-list": ["排行列表", "1 新闻", "2 科技"],
  "hot-refresh-state": ["刷新状态", "刚刚更新", "榜单"],
  "hot-board": ["热榜看板", "多平台", "收藏"],
  "rss-feed-strip": ["订阅条", "少数派", "未读"],
  "rss-article-list": ["文章列表", "标题", "摘要"],
  "rss-reading-preview": ["阅读预览", "正文", "来源"],
  "rss-board": ["RSS 看板", "订阅", "未读"],
  "docker-compact-containers": ["41 Running", "CPU 12%", "内存"],
  "docker-container-list": ["容器列表", "startdeck", "healthy"],
  "docker-ports-stats": ["端口统计", "23100", "负载"],
  "system-status-cpu-memory": ["CPU 28%", "内存 62%", "磁盘"],
  "system-status-telemetry-strip": ["遥测条", "CPU", "内存"],
  "system-status-gauge-board": ["仪表盘", "CPU", "磁盘"],
  "ip-wan-copy-card": ["外网 216.236", "复制", "延迟"],
  "ip-wan-lan-strip": ["外网 / 内网", "127.0", "Ping"],
  "ip-network-detail": ["网络详情", "路由", "诊断"],
  "status-monitor-compact-runtime": ["API 正常", "告警 0", "运行"],
  "status-monitor-floating-panel": ["浮层面板", "服务", "异常"],
  "status-monitor-runtime-sparkline": ["运行趋势", "99.9%", "延迟"],
};

const contentRows = computed(() => {
  const face = functionalFace.value;
  if (face && rowsByFace[face]) return rowsByFace[face];

  const baseRows: Record<string, string[]> = {
    [ITAB_CLOCK_WIDGET_TYPE]: ["08:12", "周二"],
    [ITAB_WEATHER_WIDGET_TYPE]: ["27° 阴", "深圳 龙华", "7日预报"],
    [ITAB_TODO_WIDGET_TYPE]: ["评审 UI", "补充 QA", "发布"],
    [ITAB_POMODORO_WIDGET_TYPE]: ["番茄时钟", "25:00", "海浪"],
    [ITAB_ANNIVERSARY_WIDGET_TYPE]: ["你在世界已经", "10461 天", "1997-10-1"],
    search: ["百度 搜索", "StartDeck", "最近命令"],
    "div-card": ["豆包", "常用链接", "公开"],
    bookmarks: ["豆包", "GitHub", "B 站", "知乎"],
    iframe: ["服务面板", "在线", "刷新"],
    "custom-css": ["自定义 HTML", "CSS 生效", "预览"],
    countdown: ["发布倒计时", "03 天", "14:00"],
    countup: ["运行时长", "18 天", "稳定"],
    calculator: ["128 × 4", "= 512", "历史"],
    "file-transfer": ["图片 3 张", "传输 82%", "文本"],
    hot: ["微博热榜", "1 巴西队名单", "2 毛巾少爷"],
    rss: ["少数派", "Android Widget", "未读 8"],
    docker: ["41 Running", "CPU 12%", "内存 2.4G"],
    "system-status": ["CPU 28%", "内存 62%", "磁盘 41%"],
    ip: ["外网 216.236", "内网 127.0", "Ping 2ms"],
    "status-monitor": ["API 正常", "Docker 正常", "告警 0"],
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

    <div
      v-else-if="previewMode === 'link-card'"
      class="widget-size-link-card-preview"
    >
      <strong>{{ contentRows[0] }}</strong>
      <span v-if="!isCompactSize">{{ contentRows[1] }}</span>
      <em v-if="size.key === '2x1'">{{ contentRows[2] }}</em>
    </div>

    <div
      v-else-if="previewMode === 'window'"
      class="widget-size-window-preview"
    >
      <div class="widget-size-window-bar"><i /><i /><i /></div>
      <strong>{{ contentRows[0] }}</strong>
      <span v-if="!isCompactSize">{{ contentRows[1] }}</span>
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
      v-else-if="previewMode === 'search'"
      class="widget-size-search-preview"
    >
      <div class="widget-size-search-box">
        <span>{{ contentRows[0] }}</span>
        <em>{{ contentRows[1] || "搜索" }}</em>
      </div>
      <div v-if="size.key !== '1x1'" class="widget-size-chip-row">
        <span v-for="row in contentRows.slice(1, 4)" :key="row">{{ row }}</span>
      </div>
    </div>

    <div
      v-else-if="previewMode === 'metrics'"
      class="widget-size-metric-preview"
    >
      <span v-for="row in contentRows" :key="row">{{ row }}</span>
    </div>

    <div v-else-if="previewMode === 'feed'" class="widget-size-feed-preview">
      <span v-for="(row, index) in contentRows" :key="row">
        <em>{{ index + 1 }}</em
        >{{ row }}
      </span>
    </div>

    <div
      v-else-if="previewMode === 'status-list'"
      class="widget-size-status-list-preview"
    >
      <span v-for="row in contentRows" :key="row">{{ row }}</span>
    </div>

    <div
      v-else-if="previewMode === 'calculator'"
      class="widget-size-calculator-preview"
    >
      <strong>{{ contentRows[0] }}</strong>
      <div class="widget-size-keypad">
        <i v-for="key in 6" :key="key"></i>
      </div>
    </div>

    <div
      v-else-if="previewMode === 'transfer'"
      class="widget-size-transfer-preview"
    >
      <span>{{ contentRows[0] }}</span>
      <div class="widget-size-progress"><i /></div>
      <em>{{ contentRows[1] }}</em>
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

.widget-size-search-preview,
.widget-size-metric-preview,
.widget-size-feed-preview,
.widget-size-status-list-preview,
.widget-size-calculator-preview,
.widget-size-transfer-preview,
.widget-size-clock-preview,
.widget-size-weather-preview,
.widget-size-link-card-preview,
.widget-size-window-preview,
.widget-size-code-preview,
.widget-size-timer-preview,
.widget-size-card-preview {
  display: grid;
  min-width: 0;
  gap: 0.375rem;
}

.widget-size-search-box {
  display: grid;
  min-width: 0;
  gap: 0.1875rem;
  border: 1px solid var(--sd-widget-border);
  border-radius: 0.75rem;
  background: var(--sd-widget-control-bg);
  padding: 0.4375rem 0.5rem;
}

.widget-size-search-box span,
.widget-size-calculator-preview strong,
.widget-size-transfer-preview span,
.widget-size-clock-preview strong,
.widget-size-weather-preview strong,
.widget-size-link-card-preview strong,
.widget-size-window-preview strong,
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

.widget-size-search-box em,
.widget-size-transfer-preview em,
.widget-size-clock-preview span,
.widget-size-weather-preview span,
.widget-size-link-card-preview span,
.widget-size-link-card-preview em,
.widget-size-window-preview span,
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

.widget-size-link-card-preview {
  align-content: center;
  min-height: 4rem;
  border-radius: 0.875rem;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--sd-widget-accent) 36%, transparent),
      color-mix(in srgb, var(--sd-widget-success) 18%, transparent)
    ),
    var(--sd-widget-control-bg);
  padding: 0.5rem;
}

.widget-size-link-card-preview strong {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  min-width: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.625rem;
  background: color-mix(in srgb, #fff 76%, transparent);
  color: color-mix(in srgb, var(--sd-widget-accent) 80%, #111);
}

.widget-size-variant-preview[data-functional-face="div-card-edit-strip"]
  .widget-size-link-card-preview {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  min-height: 3.5rem;
}

.widget-size-variant-preview[data-functional-face="div-card-edit-strip"]
  .widget-size-link-card-preview
  strong {
  width: auto;
  max-width: 100%;
  height: 1.75rem;
  justify-content: flex-start;
  padding: 0 0.5rem;
}

.widget-size-variant-preview[data-functional-face="div-card-edit-strip"]
  .widget-size-link-card-preview
  span {
  grid-column: 1 / -1;
}

.widget-size-window-preview {
  border: 1px solid var(--sd-widget-border);
  border-radius: 0.75rem;
  background: var(--sd-widget-control-bg);
  padding: 0.4375rem;
}

.widget-size-window-bar {
  display: flex;
  gap: 0.1875rem;
}

.widget-size-window-bar i {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 999px;
  background: var(--sd-widget-accent);
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

.widget-size-feed-preview,
.widget-size-card-preview {
  gap: 0.25rem;
}

.widget-size-feed-preview span,
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

.widget-size-feed-preview span {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.widget-size-feed-preview em {
  display: inline-flex;
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--sd-widget-control-bg);
  color: var(--sd-widget-accent);
  font-size: 0.5625rem;
  font-style: normal;
  font-weight: 900;
}

.widget-size-progress {
  overflow: hidden;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--sd-widget-surface-muted);
}

.widget-size-progress i {
  display: block;
  width: 62%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    var(--sd-widget-accent),
    var(--sd-widget-success)
  );
}

.widget-size-keypad {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.25rem;
}

.widget-size-keypad i {
  min-height: 0.875rem;
  border-radius: 0.25rem;
  background: var(--sd-widget-control-bg);
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
