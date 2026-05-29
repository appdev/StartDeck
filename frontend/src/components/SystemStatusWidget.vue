<script setup lang="ts">
import { computed, onMounted, onUnmounted, type Ref } from "vue";
import AppButton from "@/components/base/AppButton.vue";
import AppSwitch from "@/components/base/AppSwitch.vue";
import { useResumeRefresh } from "@/composables/useResumeRefresh";
import { useLoginRequiredToast } from "@/composables/useRequireLogin";
import { useWidgetDisplaySize } from "@/composables/useWidgetDisplaySize";
import { useSharedSystemStatusRuntimeState } from "@/features/widget-runtime/systemStatusRuntimeState";
import { useMainStore } from "@/stores/main";
import type { WidgetConfig } from "@/types";

type SystemStats = {
  cpu: {
    currentLoad: number;
    currentLoadUser: number;
    currentLoadSystem: number;
    manufacturer?: string;
    brand?: string;
    speed?: number;
    cores?: number;
  };
  mem: { total: number; used: number; active: number; available: number };
  disk: {
    fs: string;
    type: string;
    size: number;
    used: number;
    use: number;
    mount: string;
  }[];
  network: { iface: string; rx_sec: number; tx_sec: number }[];
  temp: { main: number; cores: number[]; max: number };
  uptime: number;
  os?: {
    distro: string;
    release: string;
    codename: string;
    kernel: string;
    arch: string;
    hostname: string;
  };
};

const SYSTEM_STATUS_PREVIEW_GB = 1024 * 1024 * 1024;
const SYSTEM_STATUS_PREVIEW_STATS: SystemStats = {
  cpu: {
    currentLoad: 28,
    currentLoadUser: 18,
    currentLoadSystem: 10,
    manufacturer: "Apple",
    brand: "Apple M-series",
    speed: 3.2,
    cores: 10,
  },
  mem: {
    total: 32 * SYSTEM_STATUS_PREVIEW_GB,
    used: 19 * SYSTEM_STATUS_PREVIEW_GB,
    active: 19 * SYSTEM_STATUS_PREVIEW_GB,
    available: 13 * SYSTEM_STATUS_PREVIEW_GB,
  },
  disk: [
    {
      fs: "/dev/disk3s1",
      type: "apfs",
      size: 1024 * SYSTEM_STATUS_PREVIEW_GB,
      used: 420 * SYSTEM_STATUS_PREVIEW_GB,
      use: 41,
      mount: "/",
    },
  ],
  network: [{ iface: "en0", rx_sec: 860 * 1024, tx_sec: 180 * 1024 }],
  temp: { main: 42, cores: [41, 42, 43], max: 43 },
  uptime: 86400 * 6.8,
  os: {
    distro: "macOS",
    release: "15",
    codename: "Sequoia",
    kernel: "Darwin",
    arch: "arm64",
    hostname: "StartDeck",
  },
};

const store = useMainStore();
const { notifyLoginRequired } = useLoginRequiredToast();
const requireSystemWidgetMutation = () => {
  if (store.isLogged) return true;
  return notifyLoginRequired("请先登录后再修改系统状态组件。");
};
const props = defineProps<{
  widget?: WidgetConfig;
  variant?: "card" | "opened";
  sizeKey?: string;
  refreshToken?: number;
}>();
defineOptions({ inheritAttrs: false });
defineEmits<{
  updateData: [data: unknown];
  "update-data": [data: unknown];
}>();

const isOpenedVariant = computed(() => props.variant === "opened");
const { displaySize, displaySizeClass } = useWidgetDisplaySize(
  () => props.widget,
);
const systemRuntimeState = useSharedSystemStatusRuntimeState(props.widget?.id);
const systemStats = systemRuntimeState.systemStats as Ref<SystemStats | null>;
const errorCount = systemRuntimeState.errorCount;
const pollInterval = systemRuntimeState.pollInterval;
const isCatalogPreview = computed(() =>
  Boolean(props.widget?.data?.catalogPreview),
);
const activeSystemStats = computed(() =>
  isCatalogPreview.value ? SYSTEM_STATUS_PREVIEW_STATS : systemStats.value,
);

const systemWidgetModel = computed(() => {
  if (!props.widget) return undefined;
  return (
    store.widgets.find((widget) => widget.id === props.widget!.id) ||
    props.widget
  );
});

const systemWidgetEnabled = computed(
  () => systemWidgetModel.value?.enable !== false,
);
const systemWidgetPublic = computed(
  () => systemWidgetModel.value?.isPublic !== false,
);
const systemWidgetMobileVisible = computed(
  () => systemWidgetModel.value?.hideOnMobile !== true,
);

const systemSizeKey = computed(() => displaySize.value.sizeKey);
const isTinySystemLayout = computed(() => systemSizeKey.value === "1x1");
const isShortSystemLayout = computed(() => systemSizeKey.value === "1x2");
const isVerticalSystemLayout = computed(() => systemSizeKey.value === "2x1");
const isSquareSystemLayout = computed(() => systemSizeKey.value === "2x2");
const loadingLabel = computed(() =>
  isTinySystemLayout.value || isVerticalSystemLayout.value
    ? "加载"
    : "加载中...",
);

const clampPercent = (value: number) =>
  Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const formatGb = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0G";
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}G`;
};
const formatCompactGb = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0G";
  return `${Math.round(bytes / 1024 / 1024 / 1024)}G`;
};

const formatRate = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0K/s";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}M/s`;
  return `${Math.round(bytes / 1024)}K/s`;
};

const cpuPercent = computed(() =>
  clampPercent(activeSystemStats.value?.cpu.currentLoad ?? 0),
);
const memPercent = computed(() => {
  const mem = activeSystemStats.value?.mem;
  if (!mem?.total) return 0;
  return clampPercent((mem.active / mem.total) * 100);
});
const primaryDisk = computed(() => activeSystemStats.value?.disk?.[0]);
const diskPercent = computed(() => clampPercent(primaryDisk.value?.use ?? 0));
const primaryNetwork = computed(
  () =>
    activeSystemStats.value?.network?.find(
      (item) => item.rx_sec > 0 || item.tx_sec > 0,
    ) || activeSystemStats.value?.network?.[0],
);
const compactCpuBrand = computed(() => {
  const brand = activeSystemStats.value?.cpu.brand || "";
  return brand.replace(/^Apple\s+/i, "").trim() || "处理器";
});
const uptimeText = computed(() => {
  const uptime = activeSystemStats.value?.uptime ?? 0;
  if (uptime <= 0) return "--";
  const days = uptime / 86400;
  if (days >= 1) return `${days.toFixed(1)} 天`;
  return `${Math.max(1, Math.round(uptime / 3600))} 小时`;
});
const uptimeDaysText = computed(() => {
  const uptime = activeSystemStats.value?.uptime ?? 0;
  if (uptime <= 0) return "--";
  const days = uptime / 86400;
  if (days < 0.1) return "< 0.1 天";
  if (days < 10) return `${days.toFixed(1)} 天`;
  return `${Math.round(days)} 天`;
});
const uptimeRunningText = computed(() => `已运行 ${uptimeDaysText.value}`);
const osSummary = computed(() => {
  const os = activeSystemStats.value?.os;
  if (!os) return "Host";
  return [os.distro, os.release].filter(Boolean).join(" ") || os.hostname;
});
const hostSummary = computed(() => {
  const os = activeSystemStats.value?.os;
  if (!os) return "Host telemetry";
  return [os.hostname, os.distro, os.kernel].filter(Boolean).join(" · ");
});
const openedHostSummary = computed(() => {
  const summary = hostSummary.value;
  if (!activeSystemStats.value?.uptime) return summary;
  return [summary, uptimeRunningText.value].filter(Boolean).join(" · ");
});
const realtimeSummary = computed(() => {
  const parts = [osSummary.value];
  if (activeSystemStats.value?.uptime) parts.push(uptimeRunningText.value);
  parts.push(`CPU ${cpuPercent.value.toFixed(0)}%`);
  return parts.join(" · ");
});

const metricCards = computed(() => [
  {
    key: "cpu",
    label: "CPU",
    value: `${cpuPercent.value.toFixed(0)}%`,
    detail: activeSystemStats.value?.cpu.brand || "处理器负载",
    cardDetail: compactCpuBrand.value,
    percent: cpuPercent.value,
    tone: "blue",
  },
  {
    key: "mem",
    label: "内存",
    value: `${memPercent.value.toFixed(0)}%`,
    detail: activeSystemStats.value
      ? `${formatGb(activeSystemStats.value.mem.active)} / ${formatGb(activeSystemStats.value.mem.total)}`
      : "--",
    cardDetail: activeSystemStats.value
      ? `${formatCompactGb(activeSystemStats.value.mem.active)}/${formatCompactGb(activeSystemStats.value.mem.total)}`
      : "--",
    percent: memPercent.value,
    tone: "violet",
  },
  {
    key: "disk",
    label: "磁盘",
    value: `${diskPercent.value.toFixed(0)}%`,
    detail: primaryDisk.value?.mount || "Root",
    cardDetail: primaryDisk.value?.mount || "Root",
    percent: diskPercent.value,
    tone: "green",
  },
  {
    key: "net",
    label: "网络",
    value: primaryNetwork.value
      ? formatRate(primaryNetwork.value.rx_sec + primaryNetwork.value.tx_sec)
      : "0K/s",
    detail: primaryNetwork.value?.iface || "Interface",
    cardDetail: primaryNetwork.value?.iface || "Interface",
    percent: Math.min(
      100,
      ((primaryNetwork.value?.rx_sec ?? 0) +
        (primaryNetwork.value?.tx_sec ?? 0)) /
        1024 /
        64,
    ),
    tone: "cyan",
  },
]);
const squareMetricCards = computed(() => metricCards.value.slice(1, 3));
const boardMetricCards = computed(() => metricCards.value.slice(0, 4));
const openedDiskRows = computed(
  () => activeSystemStats.value?.disk?.slice(0, 4) || [],
);
const openedNetworkRows = computed(
  () => activeSystemStats.value?.network?.slice(0, 4) || [],
);

const setSystemWidgetEnabled = (enabled: boolean) => {
  if (!requireSystemWidgetMutation()) return;
  const widget = systemWidgetModel.value;
  if (!widget) return;
  widget.enable = enabled;
  store.markDirty();
};
const setSystemWidgetPublic = (enabled: boolean) => {
  if (!requireSystemWidgetMutation()) return;
  const widget = systemWidgetModel.value;
  if (!widget) return;
  widget.isPublic = enabled;
  store.markDirty();
};
const setSystemWidgetMobileVisible = (visible: boolean) => {
  if (!requireSystemWidgetMutation()) return;
  const widget = systemWidgetModel.value;
  if (!widget) return;
  widget.hideOnMobile = !visible;
  store.markDirty();
};
const startPolling = () => {
  if (isCatalogPreview.value) return;
  systemRuntimeState.clearPollingTimer();
  systemRuntimeState.setPollingTimer(
    setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void fetchSystemStats();
    }, pollInterval.value),
  );
};

const stopPolling = () => {
  systemRuntimeState.clearPollingTimer();
};

const fetchSystemStats = async () => {
  if (isCatalogPreview.value) return;
  try {
    const headers = store.getHeaders();
    const res = await fetch("/api/system/stats", { headers });
    if (!res.ok) {
      errorCount.value++;
      if (errorCount.value >= 3) {
        stopPolling();
        console.warn("System stats polling stopped due to repeated errors.");
      }
      return;
    }

    const data = await res.json();
    if (data.success) {
      systemStats.value = data.data;
      errorCount.value = 0;
    } else {
      errorCount.value++;
      if (errorCount.value >= 3) stopPolling();
    }
  } catch (error) {
    console.error(error);
    errorCount.value++;
    if (errorCount.value >= 3) stopPolling();
  }
};

useResumeRefresh({
  onHidden: () => {
    stopPolling();
  },
  onVisible: () => {
    if (isCatalogPreview.value) return;
    void fetchSystemStats();
    startPolling();
  },
  onOnline: () => {
    if (isCatalogPreview.value) return;
    void fetchSystemStats();
    startPolling();
  },
});

onMounted(() => {
  if (isCatalogPreview.value) return;
  systemRuntimeState.retain();
  void fetchSystemStats();
  startPolling();
});

onUnmounted(() => {
  if (isCatalogPreview.value) return;
  systemRuntimeState.release();
});
</script>

<template>
  <div
    v-if="isOpenedVariant"
    class="system-opened-workbench custom-scrollbar"
    data-runtime-open-ignore="true"
  >
    <header class="system-opened-header">
      <div>
        <span class="system-opened-kicker">Host telemetry</span>
        <h2>系统状态</h2>
        <p>{{ openedHostSummary }}</p>
      </div>
      <AppButton variant="secondary" @click="() => fetchSystemStats()">
        立即刷新
      </AppButton>
    </header>

    <div class="system-opened-layout">
      <main class="system-opened-main">
        <section class="system-opened-metrics">
          <article
            v-for="metric in metricCards"
            :key="metric.key"
            class="system-opened-metric"
            :class="`is-${metric.tone}`"
          >
            <div>
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
            <p :title="metric.detail">{{ metric.detail }}</p>
            <i><b :style="{ width: `${metric.percent}%` }"></b></i>
          </article>
        </section>

        <section class="system-opened-details">
          <article>
            <div class="system-opened-section-title">
              <strong>主机</strong>
              <span>{{ uptimeText }}</span>
            </div>
            <dl>
              <div>
                <dt>CPU</dt>
                <dd>{{ activeSystemStats?.cpu.brand || "--" }}</dd>
              </div>
              <div>
                <dt>核心</dt>
                <dd>{{ activeSystemStats?.cpu.cores || "--" }}</dd>
              </div>
              <div>
                <dt>温度</dt>
                <dd>{{ activeSystemStats?.temp?.main || "--" }}°C</dd>
              </div>
              <div>
                <dt>已运行</dt>
                <dd>{{ uptimeDaysText }}</dd>
              </div>
              <div>
                <dt>系统</dt>
                <dd>{{ osSummary }}</dd>
              </div>
            </dl>
          </article>

          <article>
            <div class="system-opened-section-title">
              <strong>磁盘</strong>
              <span>{{ openedDiskRows.length }} volumes</span>
            </div>
            <div
              v-for="disk in openedDiskRows"
              :key="`${disk.fs}-${disk.mount}`"
              class="system-opened-row"
            >
              <span>{{ disk.mount }}</span>
              <strong>{{ disk.use.toFixed(0) }}%</strong>
              <em>{{ formatGb(disk.used) }} / {{ formatGb(disk.size) }}</em>
            </div>
          </article>

          <article>
            <div class="system-opened-section-title">
              <strong>网络</strong>
              <span>{{ openedNetworkRows.length }} interfaces</span>
            </div>
            <div
              v-for="network in openedNetworkRows"
              :key="network.iface"
              class="system-opened-row"
            >
              <span>{{ network.iface }}</span>
              <strong>{{ formatRate(network.rx_sec + network.tx_sec) }}</strong>
              <em>
                RX {{ formatRate(network.rx_sec) }} · TX
                {{ formatRate(network.tx_sec) }}
              </em>
            </div>
          </article>
        </section>
      </main>

      <aside class="system-opened-settings" data-runtime-open-ignore="true">
        <section class="system-settings-section">
          <div class="system-settings-section-title">
            <strong>系统信息组件设置</strong>
            <span>这些设置只影响当前系统信息组件。</span>
          </div>
          <AppSwitch
            :model-value="systemWidgetEnabled"
            label="显示系统信息组件"
            hint="关闭后可从添加组件弹窗重新启用。"
            @change="setSystemWidgetEnabled"
          />
          <AppSwitch
            :model-value="systemWidgetPublic"
            label="公开显示"
            hint="允许未登录访问者看到此组件。"
            @change="setSystemWidgetPublic"
          />
          <AppSwitch
            :model-value="systemWidgetMobileVisible"
            label="移动端显示"
            hint="控制手机布局中是否保留此组件。"
            @change="setSystemWidgetMobileVisible"
          />
        </section>

        <section class="system-settings-section">
          <div class="system-settings-section-title">
            <strong>实时状态</strong>
            <span>{{ realtimeSummary }}</span>
          </div>
          <AppButton variant="secondary" @click="() => fetchSystemStats()">
            立即刷新
          </AppButton>
        </section>
      </aside>
    </div>
  </div>

  <div
    v-else
    class="system-status-widget"
    :class="[
      displaySizeClass,
      `is-${displaySize.tier}`,
      {
        'is-tiny': isTinySystemLayout,
        'is-short': isShortSystemLayout,
        'is-vertical': isVerticalSystemLayout,
        'is-square': isSquareSystemLayout,
        'is-board': displaySize.isBoard,
        'has-stats': Boolean(activeSystemStats),
      },
    ]"
    :data-widget-size="displaySize.sizeKey"
  >
    <template v-if="activeSystemStats">
      <div v-if="isTinySystemLayout" class="system-status-quick">
        <span>CPU</span>
        <div>
          <strong>{{ cpuPercent.toFixed(0) }}</strong
          ><em>%</em>
        </div>
      </div>

      <div v-else-if="isShortSystemLayout" class="system-status-strip">
        <article>
          <span>CPU</span>
          <strong>{{ cpuPercent.toFixed(0) }}%</strong>
        </article>
        <article>
          <span>MEM</span>
          <strong>{{ memPercent.toFixed(0) }}%</strong>
        </article>
      </div>

      <div v-else-if="isVerticalSystemLayout" class="system-status-stack">
        <article>
          <span>CPU</span>
          <strong>{{ cpuPercent.toFixed(0) }}%</strong>
        </article>
        <article>
          <span>MEM</span>
          <strong>{{ memPercent.toFixed(0) }}%</strong>
        </article>
        <article>
          <span>TEMP</span>
          <strong>{{ activeSystemStats.temp?.main || "--" }}°</strong>
        </article>
      </div>

      <div v-else-if="isSquareSystemLayout" class="system-status-square-layout">
        <div class="system-status-primary">
          <span>CPU</span>
          <div>
            <strong>{{ cpuPercent.toFixed(0) }}</strong
            ><em>%</em>
          </div>
        </div>
        <div class="system-status-mini-list">
          <article
            v-for="metric in squareMetricCards"
            :key="metric.key"
            :class="`is-${metric.tone}`"
          >
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <i><b :style="{ width: `${metric.percent}%` }"></b></i>
          </article>
        </div>
      </div>

      <div v-else class="system-status-board-layout">
        <section class="system-status-metrics">
          <article
            v-for="metric in boardMetricCards"
            :key="metric.key"
            class="system-status-metric"
            :class="`is-${metric.tone}`"
          >
            <div class="system-status-metric-head">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
            <div class="system-status-bar">
              <span :style="{ width: `${metric.percent}%` }"></span>
            </div>
            <div class="system-status-detail" :title="metric.detail">
              {{ metric.cardDetail || metric.detail }}
            </div>
          </article>
        </section>
        <div class="system-status-context">
          <span>运行 {{ uptimeText }}</span>
          <span v-if="activeSystemStats.temp?.main"
            >{{ activeSystemStats.temp.main }}°C</span
          >
          <span
            v-if="activeSystemStats.os?.hostname"
            :title="activeSystemStats.os.hostname"
          >
            {{ activeSystemStats.os.hostname }}
          </span>
        </div>
      </div>
    </template>

    <div v-else class="system-status-loading">{{ loadingLabel }}</div>
  </div>
</template>

<style scoped>
.system-opened-workbench {
  display: grid;
  min-height: 100%;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 1rem;
  overflow: auto;
  padding: 1.4rem;
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-system-status-widget-accent-text-01)
  );
}

.system-opened-header,
.system-opened-section-title,
.system-opened-row,
.system-opened-metric div {
  display: flex;
  align-items: center;
  min-width: 0;
}

.system-opened-header {
  justify-content: space-between;
  gap: 1rem;
  padding-right: 5.2rem;
}

.system-opened-kicker {
  color: var(
    --sd-color-accent-primary,
    var(--sd-theme-system-status-widget-accent-text-02)
  );
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.system-opened-header h2 {
  margin: 0.1rem 0;
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-system-status-widget-accent-text-01)
  );
  font-size: 1.8rem;
  font-weight: 820;
  letter-spacing: 0;
  line-height: 1;
}

.system-opened-header p {
  margin: 0;
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-system-status-widget-accent-text-03)
  );
  font-size: 0.82rem;
  font-weight: 650;
}

.system-opened-layout {
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 21rem);
  gap: 1rem;
}

.system-opened-main {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 1rem;
}

.system-opened-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.72rem;
}

.system-opened-metric,
.system-opened-details article,
.system-settings-section {
  border: 1px solid
    var(
      --sd-color-border-subtle,
      var(--sd-theme-system-status-widget-border-01)
    );
  border-radius: 1rem;
  background: var(
    --sd-color-surface-muted,
    var(--sd-theme-system-status-widget-surface-01)
  );
  box-shadow: 0 14px 30px var(--sd-theme-system-status-widget-shadow-01);
}

.system-opened-metric {
  display: grid;
  min-width: 0;
  gap: 0.42rem;
  padding: 0.85rem;
}

.system-opened-metric div,
.system-opened-section-title {
  justify-content: space-between;
  gap: 0.75rem;
}

.system-opened-metric span,
.system-opened-metric p,
.system-opened-section-title span,
.system-opened-row em,
.system-settings-section-title span {
  overflow: hidden;
  margin: 0;
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-system-status-widget-accent-text-03)
  );
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-opened-metric strong {
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-system-status-widget-accent-text-01)
  );
  font-size: 1.18rem;
  font-weight: 820;
}

.system-opened-metric i,
.system-status-bar,
.system-status-mini-list i {
  display: block;
  height: 0.38rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(
    --sd-color-surface,
    var(--sd-theme-system-status-widget-surface-02)
  );
}

.system-opened-metric b,
.system-status-bar span,
.system-status-mini-list b {
  display: block;
  height: 100%;
  max-width: 100%;
  border-radius: inherit;
  background: var(--sd-theme-system-status-widget-accent-surface-01);
}

.system-opened-metric.is-violet b,
.system-status-metric.is-violet .system-status-bar span,
.system-status-mini-list .is-violet b {
  background: var(--sd-theme-system-status-widget-accent-surface-02);
}

.system-opened-metric.is-green b,
.system-status-metric.is-green .system-status-bar span,
.system-status-mini-list .is-green b {
  background: var(--sd-theme-system-status-widget-accent-surface-03);
}

.system-opened-metric.is-cyan b,
.system-status-metric.is-cyan .system-status-bar span,
.system-status-mini-list .is-cyan b {
  background: var(--sd-theme-system-status-widget-accent-surface-04);
}

.system-opened-details,
.system-opened-settings {
  display: grid;
  align-content: start;
  min-width: 0;
  min-height: 0;
  gap: 0.7rem;
  overflow: auto;
}

.system-opened-details {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.system-opened-details article,
.system-settings-section {
  display: grid;
  min-width: 0;
  gap: 0.7rem;
  padding: 0.85rem;
}

.system-opened-section-title strong,
.system-settings-section-title strong {
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-system-status-widget-accent-text-01)
  );
  font-size: 0.96rem;
  font-weight: 800;
}

.system-opened-details dl {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}

.system-opened-details dl div,
.system-opened-row {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.45rem;
}

.system-opened-details dt,
.system-opened-row span {
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-system-status-widget-accent-text-03)
  );
  font-size: 0.74rem;
  font-weight: 700;
}

.system-opened-details dd,
.system-opened-row strong {
  overflow: hidden;
  margin: 0;
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-system-status-widget-accent-text-01)
  );
  font-size: 0.8rem;
  font-weight: 760;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-opened-row em {
  grid-column: 1 / -1;
}

.system-settings-section-title {
  display: grid;
  min-width: 0;
  gap: 0.18rem;
}

.system-status-widget {
  display: grid;
  position: relative;
  box-sizing: border-box;
  height: 100%;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid
    var(
      --sd-color-border-subtle,
      var(--sd-theme-system-status-widget-border-02)
    );
  border-radius: 1rem;
  background: var(
    --sd-color-surface,
    var(--sd-theme-system-status-widget-surface-03)
  );
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-system-status-widget-accent-text-04)
  );
  box-shadow: var(
    --sd-shadow-widget,
    0 16px 36px var(--sd-theme-system-status-widget-shadow-02)
  );
  padding: 0.85rem;
}

:global(.dark) .system-status-widget {
  background: var(
    --sd-color-surface,
    var(--sd-theme-system-status-widget-accent-surface-05)
  );
}

.system-status-widget.is-tiny {
  place-items: center;
  padding: 0.42rem;
}

.system-status-widget.is-short {
  align-items: center;
  padding: 0.42rem 0.54rem;
}

.system-status-widget.is-vertical {
  align-items: center;
  justify-items: center;
  padding: 0.52rem 0.46rem;
}

.system-status-widget.is-square {
  padding: 0.58rem;
}

.system-status-widget.is-board {
  padding: 0.74rem;
}

.system-status-quick {
  display: grid;
  justify-items: center;
  gap: 0.1rem;
  line-height: 1;
}

.system-status-quick span,
.system-status-strip span,
.system-status-stack span,
.system-status-primary span,
.system-status-metric-head span,
.system-status-detail,
.system-status-context {
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-system-status-widget-accent-text-03)
  );
  font-size: 0.68rem;
  font-weight: 720;
}

.system-status-quick div,
.system-status-primary div {
  display: flex;
  align-items: end;
  justify-content: center;
  gap: 0.08rem;
}

.system-status-quick strong {
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-system-status-widget-accent-text-04)
  );
  font-size: 1.35rem;
  font-weight: 820;
  letter-spacing: 0;
  line-height: 1;
}

.system-status-quick em,
.system-status-primary em {
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-system-status-widget-accent-text-03)
  );
  font-style: normal;
  font-weight: 760;
}

.system-status-quick em {
  margin-bottom: 0.05rem;
  font-size: 0.58rem;
}

.system-status-strip {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.38rem;
}

.system-status-strip article,
.system-status-stack article,
.system-status-mini-list article,
.system-status-metric {
  display: grid;
  min-width: 0;
  border: 1px solid
    var(
      --sd-color-border-subtle,
      var(--sd-theme-system-status-widget-border-03)
    );
  border-radius: 0.72rem;
  background: var(
    --sd-color-surface-muted,
    var(--sd-theme-system-status-widget-surface-04)
  );
}

.system-status-strip article {
  gap: 0.12rem;
  padding: 0.34rem 0.42rem;
}

.system-status-strip strong {
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-system-status-widget-accent-text-04)
  );
  font-size: 0.9rem;
  font-weight: 820;
  line-height: 1;
}

.system-status-stack {
  display: grid;
  width: 100%;
  gap: 0.34rem;
}

.system-status-stack article {
  justify-items: center;
  gap: 0.1rem;
  padding: 0.34rem 0.16rem;
}

.system-status-stack strong {
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-system-status-widget-accent-text-04)
  );
  font-size: 0.78rem;
  font-weight: 820;
  line-height: 1;
}

.system-status-stack span {
  font-size: 0.5rem;
  line-height: 1;
}

.system-status-square-layout {
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.42rem;
}

.system-status-primary {
  display: grid;
  justify-items: start;
  gap: 0.12rem;
}

.system-status-primary strong {
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-system-status-widget-accent-text-04)
  );
  font-size: 2rem;
  font-weight: 820;
  letter-spacing: 0;
  line-height: 0.95;
}

.system-status-primary em {
  margin-bottom: 0.18rem;
  font-size: 0.74rem;
}

.system-status-mini-list {
  display: grid;
  min-height: 0;
  gap: 0.28rem;
}

.system-status-mini-list article {
  grid-template-columns: auto auto;
  align-items: center;
  gap: 0.14rem 0.32rem;
  padding: 0.28rem 0.38rem;
}

.system-status-mini-list span {
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-system-status-widget-accent-text-03)
  );
  font-size: 0.62rem;
  font-weight: 720;
}

.system-status-mini-list strong {
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-system-status-widget-accent-text-04)
  );
  font-size: 0.66rem;
  font-weight: 820;
  text-align: right;
}

.system-status-mini-list i {
  grid-column: 1 / -1;
  height: 0.28rem;
}

.system-status-board-layout {
  display: grid;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 0.42rem;
}

.system-status-metrics {
  display: grid;
  min-height: 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.38rem;
}

.system-status-metric {
  gap: 0.28rem;
  overflow: hidden;
  padding: 0.42rem 0.48rem;
}

.system-status-metric-head {
  display: grid;
  gap: 0.08rem;
  min-width: 0;
}

.system-status-metric-head span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-status-metric-head strong {
  overflow: hidden;
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-system-status-widget-accent-text-04)
  );
  font-size: 0.78rem;
  font-weight: 820;
  line-height: 1.05;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-status-bar {
  height: 0.34rem;
}

.system-status-detail {
  overflow: hidden;
  font-size: 0.58rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-status-context {
  display: flex;
  min-width: 0;
  gap: 0.32rem;
  overflow: hidden;
}

.system-status-context span {
  overflow: hidden;
  border-radius: 999px;
  background: var(
    --sd-color-surface-muted,
    var(--sd-theme-system-status-widget-surface-05)
  );
  padding: 0.18rem 0.42rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-status-loading {
  display: grid;
  min-height: 100%;
  place-items: center;
  color: var(
    --sd-color-text-tertiary,
    var(--sd-theme-system-status-widget-text-01)
  );
  font-size: 0.78rem;
  font-weight: 700;
}

@media (max-width: 640px) {
  .system-opened-workbench {
    padding: 1rem;
  }

  .system-opened-header {
    align-items: flex-start;
    flex-direction: column;
    padding-right: 3.5rem;
  }

  .system-opened-layout,
  .system-opened-metrics,
  .system-opened-details {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
