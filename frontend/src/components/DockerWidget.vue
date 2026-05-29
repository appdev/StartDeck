<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, type Ref } from "vue";
import { useMainStore } from "@/stores/main";
import type { WidgetConfig } from "@/types";
import { useResumeRefresh } from "@/composables/useResumeRefresh";
import { useLoginRequiredToast } from "@/composables/useRequireLogin";
import AppButton from "@/components/base/AppButton.vue";
import AppModalShell from "@/components/base/AppModalShell.vue";
import AppSwitch from "@/components/base/AppSwitch.vue";
import { useWidgetDisplaySize } from "@/composables/useWidgetDisplaySize";
import { useSharedDockerWidgetRuntimeState } from "@/features/widget-runtime/dockerWidgetRuntimeState";

type DockerApiState = "disabled" | "unavailable" | "ready";

type DockerPort = {
  PublicPort?: number;
  PrivatePort?: number;
};

type DockerStats = {
  cpuPercent: number;
  memUsage: number;
  memLimit: number;
  memPercent: number;
  netIO?: { rx: number; tx: number };
  blockIO?: { read: number; write: number };
};

type InspectLite = {
  networkMode: string;
  ports: number[];
};

type DockerContainer = {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
  Ports: DockerPort[];
  hasUpdate?: boolean;
  stats?: DockerStats;
};

interface DockerInfo {
  OSType: string;
  Architecture: string;
  Containers: number;
  Name: string;
  Images: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

type DockerContainersResponse = {
  success: boolean;
  state?: DockerApiState;
  error?: string;
  data?: DockerContainer[];
  updateStatus?: UpdateCheckStatus;
};

type DockerInfoResponse = {
  success: boolean;
  state?: DockerApiState;
  error?: string;
  info?: DockerInfo;
  version?: { Version?: string };
  socketPath?: string;
};

const store = useMainStore();
const { notifyLoginRequired } = useLoginRequiredToast();
const requireDockerWidgetMutation = () => {
  if (store.isLogged) return true;
  return notifyLoginRequired("请先登录后再修改 Docker 组件。");
};
const showManualPortPrompt = ref(false);
const manualPortValue = ref("");
const manualPortError = ref("");
const manualPortContainerName = ref("");
let manualPortResolver: ((value: string | null) => void) | null = null;

const closeManualPortPrompt = (value: string | null) => {
  showManualPortPrompt.value = false;
  manualPortValue.value = "";
  manualPortError.value = "";
  manualPortContainerName.value = "";
  manualPortResolver?.(value);
  manualPortResolver = null;
};

const requestManualPort = (container: DockerContainer) =>
  new Promise<string | null>((resolve) => {
    manualPortResolver = resolve;
    manualPortValue.value = "";
    manualPortError.value = "";
    manualPortContainerName.value = normalizeContainerName(
      container.Names?.[0] || "Container",
    );
    showManualPortPrompt.value = true;
  });

const confirmManualPort = () => {
  const trimmed = manualPortValue.value.trim();
  const portNum = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(portNum) || portNum <= 0 || portNum > 65535) {
    manualPortError.value = "请输入 1-65535 之间的端口号。";
    return;
  }
  closeManualPortPrompt(String(portNum));
};

// Polling intervals (ms)
const POLL_INTERVAL_MIN = 12000;
const POLL_INTERVAL_MAX = 17000;
const POLL_INTERVAL_ERROR = 36000;

const props = defineProps<{
  widget?: WidgetConfig;
  compact?: boolean;
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
const dockerWidgetModel = computed(() => {
  if (!props.widget) return undefined;
  return (
    store.widgets.find((widget) => widget.id === props.widget!.id) ||
    props.widget
  );
});

const dockerRuntimeState = useSharedDockerWidgetRuntimeState(props.widget?.id);
const dockerInfo = dockerRuntimeState.dockerInfo as Ref<DockerInfo | null>;
const unhealthyCount = computed(
  () =>
    containers.value.filter(
      (c) => c.Status && c.Status.toLowerCase().includes("unhealthy"),
    ).length,
);

const autoUpdateEnabled = computed(() =>
  Boolean(dockerWidgetModel.value?.data?.autoUpdate),
);
const dockerWidgetEnabled = computed(
  () => dockerWidgetModel.value?.enable !== false,
);
const dockerWidgetPublic = computed(
  () => dockerWidgetModel.value?.isPublic !== false,
);
const dockerWidgetMobileVisible = computed(
  () => dockerWidgetModel.value?.hideOnMobile !== true,
);
const dockerKeepImages = computed(() => {
  const value = Number(dockerWidgetModel.value?.data?.autoUpdateKeepImages);
  return Number.isFinite(value) && value > 0 ? value : 2;
});
const dockerMinFreeGb = computed(() => {
  const value = Number(dockerWidgetModel.value?.data?.autoUpdateMinFreeGB);
  return Number.isFinite(value) && value >= 0 ? value : 1;
});
const dockerLanHost = computed(() => {
  const value = dockerWidgetModel.value?.data?.lanHost;
  return typeof value === "string" ? value : "";
});
const isDockerFeatureEnabled = computed(() =>
  Boolean(store.systemConfig.enableDocker),
);
const containers = dockerRuntimeState.containers as Ref<DockerContainer[]>;
const error = dockerRuntimeState.error;
const dockerState = dockerRuntimeState.dockerState as Ref<DockerApiState>;
if (!isDockerFeatureEnabled.value && dockerState.value !== "disabled") {
  dockerState.value = "disabled";
}

const isCompactLayout = computed(
  () => props.compact ?? displaySize.value.isCompact,
);
const dockerSizeKey = computed(() => displaySize.value.sizeKey);
const isTinyDockerLayout = computed(() => dockerSizeKey.value === "1x1");
const isShortDockerLayout = computed(() => dockerSizeKey.value === "1x2");
const isVerticalDockerLayout = computed(() => dockerSizeKey.value === "2x1");
const isTwoByTwoLayout = computed(() => displaySize.value.sizeKey === "2x2");
const showDockerContainerList = computed(
  () => displaySize.value.isBoard && containers.value.length > 0,
);
const showDockerSummary = computed(() => true);
const showDockerBoardHint = computed(
  () =>
    displaySize.value.isBoard &&
    !containers.value.length &&
    (Boolean(error.value) ||
      dockerState.value === "disabled" ||
      dockerState.value !== "ready"),
);
const showDockerCounters = computed(
  () =>
    isShortDockerLayout.value ||
    isVerticalDockerLayout.value ||
    isTwoByTwoLayout.value ||
    displaySize.value.isBoard,
);
const runningContainers = computed(() =>
  containers.value.filter((c) => c.State === "running"),
);
const stoppedContainers = computed(
  () => containers.value.length - runningContainers.value.length,
);
const visibleContainers = computed(() => {
  if (!showDockerContainerList.value) return [];
  const limit = displaySize.value.isBoard
    ? 1
    : displaySize.value.isLarge
      ? 5
      : displaySize.value.isWide
        ? 3
        : 2;
  return containers.value.slice(0, limit);
});
const openedContainers = computed(() => containers.value.slice(0, 30));
const showContainerDetails = computed(() => false);
const showContainerActions = computed(() => false);

const formatDockerError = (msg: string) => {
  if (!msg) return "";
  if (dockerState.value === "disabled") {
    return "Docker 服务已关闭，可在组件内启用后再检测连接。";
  }
  const lower = msg.toLowerCase();
  if (lower.includes("docker is disabled")) {
    return "Docker 服务已关闭，可在组件内启用后再检测连接。";
  }
  if (lower.includes("docker not available")) {
    return "Docker 未启用或未配置连接地址。容器部署请挂载 /var/run/docker.sock 并设置 dockerHost=unix:///var/run/docker.sock";
  }
  if (
    lower.includes("docker.sock") ||
    lower.includes("unix:///var/run/docker.sock")
  ) {
    return "无法连接 Docker Socket，请确认宿主机 Docker 已启动，并在容器中挂载 /var/run/docker.sock";
  }
  if (
    lower.includes("pipe/docker_engine") ||
    lower.includes("open //./pipe/docker_engine") ||
    lower.includes("system cannot find the file specified")
  ) {
    return "未检测到 Docker 引擎，请启动 Docker Desktop 或配置 dockerHost";
  }
  if (lower.includes("elevated privileges")) {
    return "Windows 需要管理员权限访问 Docker 引擎";
  }
  return msg;
};

const errorDisplay = computed(() => formatDockerError(error.value));
const compactErrorHint = computed(() => {
  const message = (errorDisplay.value || error.value).toLowerCase();
  if (dockerState.value === "disabled") return "服务未启用";
  if (message.includes("socket") || message.includes("docker.sock")) {
    return "Socket 无法访问";
  }
  if (message.includes("engine") || message.includes("desktop")) {
    return "引擎未响应";
  }
  return "打开查看连接诊断";
});
const dockerBoardHint = computed(() => {
  if (dockerState.value === "ready" && !containers.value.length) {
    return "暂无容器";
  }
  return compactErrorHint.value;
});

const formatBytes = (bytes: number) => {
  if (!bytes || bytes <= 0) return "0B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const rawIndex = Math.floor(Math.log(bytes) / Math.log(k));
  const i = Math.min(Math.max(rawIndex, 0), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + (sizes[i] ?? "B");
};

const errorCount = dockerRuntimeState.errorCount;

interface UpdateCheckStatus {
  lastCheck: number;
  isChecking: boolean;
  lastError: string | null;
  checkedCount: number;
  totalCount?: number;
  updateCount: number;
  failures?: { name: string; error: string }[];
}
const updateStatus =
  dockerRuntimeState.updateStatus as Ref<UpdateCheckStatus | null>;
const isCheckingUpdate = dockerRuntimeState.isCheckingUpdate;
const statusLabel = computed(() => {
  if (dockerState.value === "ready") return "运行中";
  if (dockerState.value === "disabled") return "已关闭";
  return isLoading.value ? "连接中" : "待连接";
});
const statusCaption = computed(() => {
  if (dockerState.value === "ready") {
    return `${runningContainers.value.length} 个运行，${stoppedContainers.value} 个停止`;
  }
  if (dockerState.value === "disabled") return "服务未启用";
  return errorDisplay.value ? "等待连接" : "等待 Docker Engine 响应";
});
const updateLabel = computed(() => {
  if (updateStatus.value?.isChecking) {
    return `${updateStatus.value.checkedCount}/${updateStatus.value.totalCount || "?"}`;
  }
  if (updateStatus.value?.updateCount)
    return `${updateStatus.value.updateCount} 可升级`;
  if (updateStatus.value?.failures?.length) return "检测失败";
  return "查更新";
});
const dockerEndpointLabel = computed(() => {
  if (dockerLanHost.value) return dockerLanHost.value;
  if (typeof window !== "undefined" && window.location.hostname) {
    return window.location.hostname;
  }
  return "localhost";
});
const dockerEngineLabel = computed(() => {
  if (!dockerInfo.value) return "Docker Engine";
  return [
    dockerInfo.value.Name,
    dockerInfo.value.OSType,
    dockerInfo.value.Architecture,
  ]
    .filter(Boolean)
    .join(" · ");
});
const dockerCpuTotal = computed(() =>
  runningContainers.value.reduce(
    (total, container) => total + (container.stats?.cpuPercent || 0),
    0,
  ),
);
const dockerMemoryTotal = computed(() =>
  runningContainers.value.reduce(
    (total, container) => total + (container.stats?.memUsage || 0),
    0,
  ),
);
const canManageDockerSystem = computed(
  () =>
    store.isLogged &&
    (store.systemConfig.authMode === "single" || store.username === "admin"),
);
const ensureDockerWidgetData = () => {
  const widget = dockerWidgetModel.value;
  if (!widget) return undefined;
  if (!widget.data) widget.data = {};
  return widget.data as Record<string, unknown>;
};
const setDockerWidgetEnabled = (enabled: boolean) => {
  if (!requireDockerWidgetMutation()) return;
  const widget = dockerWidgetModel.value;
  if (!widget) return;
  widget.enable = enabled;
  store.markDirty();
};
const setDockerWidgetPublic = (enabled: boolean) => {
  if (!requireDockerWidgetMutation()) return;
  const widget = dockerWidgetModel.value;
  if (!widget) return;
  widget.isPublic = enabled;
  store.markDirty();
};
const setDockerWidgetMobileVisible = (visible: boolean) => {
  if (!requireDockerWidgetMutation()) return;
  const widget = dockerWidgetModel.value;
  if (!widget) return;
  widget.hideOnMobile = !visible;
  store.markDirty();
};
const setDockerAutoUpdate = (enabled: boolean) => {
  if (!requireDockerWidgetMutation()) return;
  const data = ensureDockerWidgetData();
  if (!data) return;
  data.autoUpdate = enabled;
  store.markDirty();
};
const setDockerKeepImages = (rawValue: string) => {
  if (!requireDockerWidgetMutation()) return;
  const data = ensureDockerWidgetData();
  if (!data) return;
  const parsed = Number.parseInt(rawValue, 10);
  data.autoUpdateKeepImages = Number.isFinite(parsed)
    ? Math.max(0, Math.min(50, parsed))
    : 2;
  store.markDirty();
};
const setDockerMinFreeGb = (rawValue: string) => {
  if (!requireDockerWidgetMutation()) return;
  const data = ensureDockerWidgetData();
  if (!data) return;
  const parsed = Number.parseFloat(rawValue);
  data.autoUpdateMinFreeGB = Number.isFinite(parsed)
    ? Math.max(0, Math.min(1024, parsed))
    : 1;
  store.markDirty();
};
const setDockerLanHost = (value: string) => {
  if (!requireDockerWidgetMutation()) return;
  const data = ensureDockerWidgetData();
  if (!data) return;
  data.lanHost = value.trim();
  store.markDirty();
};
const isUpdatingDockerSystem = ref(false);
const setDockerSystemEnabled = async (enabled: boolean) => {
  if (isUpdatingDockerSystem.value) return;
  if (Boolean(store.systemConfig.enableDocker) === enabled) return;
  if (!canManageDockerSystem.value) {
    showToast("当前账号没有 Docker 服务配置权限");
    return;
  }
  isUpdatingDockerSystem.value = true;
  try {
    const success = await store.updateSystemConfig({ enableDocker: enabled });
    if (!success) {
      showToast("Docker 服务切换失败");
      return;
    }
    showToast(enabled ? "Docker 服务已启用" : "Docker 服务已关闭");
    if (enabled) {
      checkConnection(true);
    } else {
      applyDockerDisabledState();
    }
  } finally {
    isUpdatingDockerSystem.value = false;
  }
};
const isExportingDockerLogs = ref(false);
const exportDockerLogs = async () => {
  if (isExportingDockerLogs.value) return;
  if (!isDockerFeatureEnabled.value) {
    showToast("Docker 服务已关闭");
    return;
  }
  try {
    isExportingDockerLogs.value = true;
    const headers = store.getHeaders();
    const res = await fetch("/api/docker/export-logs", { headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || String(res.status));
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const link = document.createElement("a");
    link.href = url;
    link.download = `docker-logs-${ts}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("日志已导出");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    showToast(`导出失败: ${msg}`);
  } finally {
    isExportingDockerLogs.value = false;
  }
};

const applyDockerDisabledState = () => {
  dockerState.value = "disabled";
  dockerInfo.value = null;
  updateStatus.value = null;
  containers.value = [];
  errorCount.value = 0;
  error.value = "Docker 服务已关闭";
  stopPolling();
};

const triggerUpdateCheck = async () => {
  if (isCheckingUpdate.value || updateStatus.value?.isChecking) return;
  if (!isDockerFeatureEnabled.value) {
    showToast("请先开启 Docker 服务");
    return;
  }
  if (!autoUpdateEnabled.value) {
    showToast("请先开启自动升级镜像");
    return;
  }
  try {
    isCheckingUpdate.value = true;
    const headers = store.getHeaders();
    await fetch("/api/docker/check-updates", { method: "POST", headers });
    // 立即刷新一次以获取最新状态（变为 isChecking=true）
    setTimeout(fetchContainers, 500);
  } catch (e) {
    console.error("Failed to trigger update check", e);
  } finally {
    isCheckingUpdate.value = false;
  }
};

const isLoading = dockerRuntimeState.isLoading;

const fetchContainers = async () => {
  if (!isDockerFeatureEnabled.value) {
    applyDockerDisabledState();
    return;
  }
  try {
    isLoading.value = true;
    const headers = store.getHeaders();
    const res = await fetch("/api/docker/containers", { headers });

    if (!res.ok) {
      // 网络请求失败，不停止轮询，只是记录错误
      // 也不清空现有数据，保持显示旧数据
      error.value = "连接异常，正在重试...";
      return;
    }

    const data = (await res.json()) as DockerContainersResponse;
    if (data.success) {
      dockerState.value = data.state || "ready";
      containers.value = (data.data || []) as DockerContainer[];
      if (data.updateStatus) {
        updateStatus.value = data.updateStatus;
      }
      prefetchInspectForContainers(containers.value);
      errorCount.value = 0;
      error.value = "";
    } else {
      if (data.state === "disabled") {
        applyDockerDisabledState();
        return;
      }
      dockerState.value = data.state || "unavailable";
      // 只有明确收到后端说 Docker 不可用时，才清空数据
      if (dockerState.value === "unavailable") {
        // 如果我们之前有数据，尽量保留，除非用户手动刷新或者真的长时间连不上
        // 这里稍微宽容一点：如果之前有数据，不轻易清空，只是标记错误
        // containers.value = []; // 移除这行，尽量保留数据
        error.value = data.error || "Docker 不可用";
        errorCount.value++;

        // 如果 Docker 明确不可用，为了节省资源，直接停止自动轮询
        // 但如果还在启动宽容期内（retryDeadline），则继续尝试
        if (Date.now() < retryDeadline.value) {
          error.value = (data.error || "Docker 不可用") + " (启动检测中...)";
          // 不调用 stopPolling，让 startPolling 继续调度
        } else {
          // 超过宽容期，停止轮询
          // 用户可以通过点击“重试连接”按钮手动重新开始
          stopPolling();
          return;
        }
      } else {
        // 其他业务错误，保留数据，显示错误
        error.value = data.error || "获取数据失败";
      }
    }
  } catch (e: unknown) {
    // 网络层错误（如断网、超时），保留数据，不停止轮询
    // containers.value = []; // 保持旧数据
    const msg = e instanceof Error ? e.message : String(e);
    error.value = "网络连接不稳定: " + msg;
    // 不停止轮询，内网穿透环境下允许失败
  } finally {
    isLoading.value = false;
  }
};

const toastMessage = ref("");
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const showToast = (msg: string, duration = 2000) => {
  toastMessage.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.value = "";
    toastTimer = null;
  }, duration);
};

const fetchDockerInfo = async (silent = true) => {
  if (!isDockerFeatureEnabled.value) {
    applyDockerDisabledState();
    if (!silent) {
      showToast("Docker 服务已关闭");
    }
    return;
  }
  try {
    const headers = store.getHeaders();
    const res = await fetch("/api/docker/info", { headers });
    const data = (await res.json()) as DockerInfoResponse;
    if (data.success && data.state === "ready") {
      dockerState.value = "ready";
      dockerInfo.value = data.info;
      if (!silent) {
        showToast("✅ Docker 连接成功");
      }
    } else {
      dockerState.value = data.state || "unavailable";
      if (data.state === "disabled") {
        applyDockerDisabledState();
        if (!silent) showToast("Docker 服务已关闭");
        return;
      }
      if (!silent) showToast(`❌ 连接失败: ${data.error}`);
    }
  } catch (e: unknown) {
    if (!silent) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast("❌ 网络错误: " + msg);
    }
  }
};

const retryDeadline = dockerRuntimeState.retryDeadline;
const RETRY_WINDOW = 3 * 60 * 1000; // 3分钟
const RETRY_INTERVAL = 10000; // 10秒

const checkConnection = (silent = false) => {
  if (!isDockerFeatureEnabled.value) {
    applyDockerDisabledState();
    return;
  }
  error.value = "";
  errorCount.value = 0;
  retryDeadline.value = Date.now() + RETRY_WINDOW; // 重置重试窗口
  fetchContainers();
  fetchDockerInfo(silent);
  startPolling();
};

const handleAction = async (id: string, action: string) => {
  if (!isDockerFeatureEnabled.value) {
    showToast("Docker 服务已关闭");
    return;
  }
  try {
    const headers = store.getHeaders();
    const res = await fetch(`/api/docker/container/${id}/${action}`, {
      method: "POST",
      headers,
    });
    if (res.ok) fetchContainers();
  } catch (e) {
    console.error(e);
  }
};

const startPolling = () => {
  if (!isDockerFeatureEnabled.value) return;
  dockerRuntimeState.clearPollingTimer();

  const poll = async () => {
    if (document.visibilityState === "hidden") return;

    // 如果之前被标记停止，这里可以根据需求决定是否继续
    // 但根据最新需求，我们尽量不停止，而是降频

    await fetchContainers();
    cleanupCache();

    // 动态频率算法：
    // 1. 错误状态：
    //    a. 启动宽容期内：10秒 (RETRY_INTERVAL)
    //    b. 超过宽容期：30秒 (降频避险)
    // 2. 正常状态：12-17秒随机
    let interval =
      POLL_INTERVAL_MIN +
      Math.random() * (POLL_INTERVAL_MAX - POLL_INTERVAL_MIN);

    if (errorCount.value > 0) {
      if (Date.now() < retryDeadline.value) {
        interval = RETRY_INTERVAL;
      } else {
        interval = POLL_INTERVAL_ERROR;
      }
    }

    // 重新调度下一次轮询，定时器由 widget-id keyed runtime state 统一持有。
    dockerRuntimeState.setPollingTimer(setTimeout(poll, interval));
  };

  // 首次启动给一个 0~2秒 的随机延迟，避免多个组件同时请求
  const initialDelay = Math.random() * 2000;
  dockerRuntimeState.setPollingTimer(setTimeout(poll, initialDelay));
};

const stopPolling = () => {
  dockerRuntimeState.clearPollingTimer();
};

useResumeRefresh({
  onHidden: () => {
    stopPolling();
  },
  onVisible: () => {
    if (isDockerFeatureEnabled.value) checkConnection(true);
  },
  onOnline: () => {
    if (isDockerFeatureEnabled.value) checkConnection(true);
  },
});

onMounted(() => {
  dockerRuntimeState.retain();
  if (isDockerFeatureEnabled.value) {
    // 恢复自动加载，确保添加到桌面后能自动显示内容
    checkConnection();
  } else {
    applyDockerDisabledState();
  }
});

onUnmounted(() => {
  dockerRuntimeState.release();
});

watch(
  () => store.systemConfig.enableDocker,
  (enabled) => {
    if (enabled) {
      dockerState.value = "unavailable";
      error.value = "";
      checkConnection(true);
    } else {
      applyDockerDisabledState();
    }
  },
);

const inspectCache = dockerRuntimeState.inspectCache as Ref<
  Record<string, { ts: number; data: InspectLite }>
>;
const INSPECT_TTL = 60_000;
const inflightInspect = dockerRuntimeState.inflightInspect;

const cleanupCache = () => {
  const now = Date.now();
  for (const key in inspectCache.value) {
    const entry = inspectCache.value[key];
    if (entry && now - entry.ts > INSPECT_TTL) {
      delete inspectCache.value[key];
    }
  }
};

const normalizeContainerName = (s: string) =>
  String(s || "")
    .replace(/^\//, "")
    .trim();

const fetchInspectLite = async (id: string): Promise<InspectLite | null> => {
  if (!isDockerFeatureEnabled.value) return null;
  const cached = inspectCache.value[id];
  const now = Date.now();
  if (cached && now - cached.ts < INSPECT_TTL) return cached.data;
  if (inflightInspect.has(id)) return cached ? cached.data : null;
  inflightInspect.add(id);
  try {
    const headers = store.getHeaders();
    const res = await fetch(
      `/api/docker/container/${encodeURIComponent(id)}/inspect-lite`,
      {
        headers,
      },
    );
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload || !payload.success)
      return cached ? cached.data : null;
    const data = payload.data as InspectLite;
    if (
      !data ||
      typeof data.networkMode !== "string" ||
      !Array.isArray(data.ports)
    ) {
      return cached ? cached.data : null;
    }
    inspectCache.value = { ...inspectCache.value, [id]: { ts: now, data } };
    return data;
  } catch {
    return cached ? cached.data : null;
  } finally {
    inflightInspect.delete(id);
  }
};

const getPublishedPorts = (c: DockerContainer): number[] =>
  (c.Ports || [])
    .map((p) => p.PublicPort)
    .filter(
      (x): x is number =>
        typeof x === "number" && Number.isFinite(x) && x > 0 && x <= 65535,
    );

// 常见 Web 端口优先级列表
const PREFERRED_PRIVATE_PORTS = [
  80, 443, 8080, 8000, 8096, 3000, 5000, 5001, 5244, 5678, 9000, 9091,
];

const getPreferredPort = (c: DockerContainer): number | null => {
  // 1. 尝试从 Ports 映射中找到 PrivatePort 匹配的
  if (c.Ports && c.Ports.length > 0) {
    // 优先找 PrivatePort 在列表中的
    // 排序：优先列表中的 index 小的优先
    const sorted = [...c.Ports].sort((a, b) => {
      const idxA = a.PrivatePort
        ? PREFERRED_PRIVATE_PORTS.indexOf(a.PrivatePort)
        : -1;
      const idxB = b.PrivatePort
        ? PREFERRED_PRIVATE_PORTS.indexOf(b.PrivatePort)
        : -1;
      // 如果都在列表中，按列表顺序
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      // 如果有一个在列表中，它优先
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      // 都不在列表中，保持原样 (或者按 PublicPort 排序?)
      return 0;
    });

    const best = sorted.find(
      (p) =>
        typeof p.PublicPort === "number" &&
        p.PublicPort > 0 &&
        p.PublicPort <= 65535,
    );
    if (best) return best.PublicPort!;
  }

  // 2. 如果没有 Ports (Host模式)，尝试从 inspectCache 获取
  const cached = inspectCache.value[c.Id]?.data;
  if (cached && cached.ports && cached.ports.length > 0) {
    const validPorts = cached.ports.filter(
      (p) => typeof p === "number" && Number.isFinite(p) && p > 0 && p <= 65535,
    );
    if (validPorts.length > 0) {
      // 同样尝试匹配优先级
      const sorted = validPorts.sort((a, b) => {
        const idxA = PREFERRED_PRIVATE_PORTS.indexOf(a);
        const idxB = PREFERRED_PRIVATE_PORTS.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
      return sorted[0] ?? null;
    }
  }

  // 3. 最后尝试使用 PrivatePort
  // 有些容器只有 PrivatePort 没有 PublicPort (如 bridge 模式未映射)，
  // 但用户可能通过内网路由访问
  if (c.Ports && c.Ports.length > 0) {
    const sorted = [...c.Ports]
      .filter((p) => p.PrivatePort)
      .sort((a, b) => {
        const idxA = a.PrivatePort
          ? PREFERRED_PRIVATE_PORTS.indexOf(a.PrivatePort)
          : -1;
        const idxB = b.PrivatePort
          ? PREFERRED_PRIVATE_PORTS.indexOf(b.PrivatePort)
          : -1;
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });

    const first = sorted[0];
    if (first?.PrivatePort) return first.PrivatePort;
  }

  return null;
};

const prefetchInspectForContainers = (list: DockerContainer[]) => {
  if (!isDockerFeatureEnabled.value) return;

  // Cleanup cache: remove entries for containers that no longer exist
  const currentIds = new Set(list.map((c) => c.Id));
  const newCache = { ...inspectCache.value };
  let changed = false;
  for (const id in newCache) {
    if (!currentIds.has(id)) {
      delete newCache[id];
      changed = true;
    }
  }
  if (changed) {
    inspectCache.value = newCache;
  }

  // 找出需要 Inspect 的容器（没有 PublicPort 的容器）
  const targets = list.filter(
    (c) => c && c.Id && getPublishedPorts(c).length === 0,
  );

  // 批量处理策略：每 5 个一组，每组之间增加随机延迟
  // 避免一次性发起几十个请求导致浏览器或后端拥堵
  const CHUNK_SIZE = 5;

  for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
    const chunk = targets.slice(i, i + CHUNK_SIZE);

    // 计算延迟：
    // 基础延迟：每组间隔 1000ms
    // 随机抖动：0~500ms
    // 第一组延迟很短，后续组逐渐推后
    const delay = i * 200 + Math.random() * 500;

    setTimeout(() => {
      chunk.forEach((c) => {
        void fetchInspectLite(c.Id);
      });
    }, delay);
  }
};

const cleanHost = (host: string) => {
  return host
    .replace(/^https?:\/\//i, "") // 移除协议头
    .replace(/\/+$/, "") // 移除尾部斜杠
    .trim();
};

const getContainerLanUrl = (c: DockerContainer): string => {
  const port = getPreferredPort(c);
  if (!port) return "";
  const lanHost =
    (props.widget?.data && typeof props.widget.data.lanHost === "string"
      ? props.widget.data.lanHost.trim()
      : "") || "";

  const host = cleanHost(lanHost) || window.location.hostname;
  const scheme = port === 443 ? "https" : "http";
  return `${scheme}://${host}:${port}`;
};

const getContainerPublicUrl = (c: DockerContainer): string => {
  const port = getPreferredPort(c);
  if (!port) return "";

  const map =
    (props.widget?.data &&
    typeof (props.widget.data as Record<string, unknown>).publicHosts ===
      "object"
      ? ((props.widget!.data as Record<string, unknown>).publicHosts as Record<
          string,
          string
        >)
      : {}) || {};
  const mapped = map[c.Id]?.trim() || "";
  const globalPublic =
    (props.widget?.data && typeof props.widget.data.publicHost === "string"
      ? props.widget.data.publicHost.trim()
      : "") || "";

  // 1. 如果有单独映射的地址
  if (mapped) {
    // 如果 mapped 看起来像完整的 URL (包含协议或端口)，直接使用
    if (/^https?:\/\//i.test(mapped)) return mapped;
    // 否则假设是 hostname，拼接协议和端口
    const scheme = port === 443 ? "https" : "http";
    return `${scheme}://${cleanHost(mapped)}:${port}`;
  }

  // 2. 如果有全局公网 Host
  if (globalPublic) {
    const scheme = port === 443 ? "https" : "http";
    return `${scheme}://${cleanHost(globalPublic)}:${port}`;
  }

  // 3. 默认回退到当前 Host
  const host = window.location.hostname;
  const scheme = port === 443 ? "https" : "http";
  return `${scheme}://${host}:${port}`;
};

const getDisabledContainers = () => {
  if (!props.widget || !props.widget.data) return [];
  return (props.widget.data.disabledContainers as string[]) || [];
};

const isAutoUpdateDisabled = (id: string) => {
  const list = getDisabledContainers();
  return list.includes(id);
};

const toggleAutoUpdateDisabled = (id: string, disabled: boolean) => {
  if (!requireDockerWidgetMutation()) return;
  if (!props.widget) return;

  const widgetInStore = store.widgets.find((w) => w.id === props.widget!.id);
  if (!widgetInStore) return;

  if (!widgetInStore.data) widgetInStore.data = {};

  const list = new Set(getDisabledContainers());
  if (disabled) {
    list.add(id);
  } else {
    list.delete(id);
  }

  widgetInStore.data.disabledContainers = Array.from(list);
  store.markDirty();

  showToast(disabled ? "已禁止该容器自动升级" : "已恢复该容器自动升级");
};

const openContainerUrl = (c: DockerContainer) => {
  const url = getContainerLanUrl(c);
  if (url) window.open(url, "_blank");
};

const openContainerPublicUrl = (c: DockerContainer) => {
  const url = getContainerPublicUrl(c);
  if (url) window.open(url, "_blank");
};

const addToHome = (c: DockerContainer) => {
  if (!requireDockerWidgetMutation()) return;
  // 1. Find or create "Docker" group
  let dockerGroup = store.groups.find((g) => g.title === "Docker");
  if (!dockerGroup) {
    const newGroupId = Date.now().toString();
    store.groups.push({
      id: newGroupId,
      title: "Docker",
      items: [],
      // Default settings for Docker group
      cardLayout: "horizontal",
      gridGap: 8,
      cardSize: 120,
      iconSize: 48,
      showCardBackground: true,
    });
    dockerGroup = store.groups.find((g) => g.title === "Docker");
  }

  if (!dockerGroup) return; // Should not happen

  const addImpl = async () => {
    let lanUrl = getContainerLanUrl(c);
    let publicUrl = getContainerPublicUrl(c);

    if (!lanUrl && !publicUrl) {
      await fetchInspectLite(c.Id);
      lanUrl = getContainerLanUrl(c);
      publicUrl = getContainerPublicUrl(c);
    }

    if (!lanUrl && !publicUrl) {
      const port = await requestManualPort(c);
      if (!port) return;
      const portNum = parseInt(port, 10);
      if (!Number.isFinite(portNum) || portNum <= 0 || portNum > 65535) return;
      const lanHost =
        (props.widget?.data && typeof props.widget.data.lanHost === "string"
          ? props.widget.data.lanHost.trim()
          : "") || "";
      const host = lanHost || window.location.hostname;
      lanUrl = `http://${host}:${portNum}`;
      publicUrl = `http://${window.location.hostname}:${portNum}`;
    }

    const title = normalizeContainerName(c.Names?.[0] || "Container");

    const exists = dockerGroup.items.some((item) => {
      if (item.containerId && item.containerId === c.Id) return true;
      const n = normalizeContainerName(item.containerName || "");
      if (n && n === title) return true;
      return false;
    });
    if (exists) {
      showToast(`容器 "${title}" 已存在`);
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      title: title,
      url: publicUrl,
      lanUrl: lanUrl,
      icon: "", // We can try to fetch icon later or let user set it
      isPublic: false,
      openInNewTab: true,
      containerId: c.Id,
      containerName: title,
      allowRestart: true,
      allowStop: true,
      description: "Docker Container", // Optional description
    };

    store.addItem(newItem, dockerGroup.id);
    showToast(`已添加 "${title}"`);
  };

  void addImpl();
};

const editingPublicId = ref<string | null>(null);
const publicHostTemp = ref("");
const promptPublicHost = (c: DockerContainer) => {
  const map =
    (props.widget?.data &&
    typeof (props.widget.data as Record<string, unknown>).publicHosts ===
      "object"
      ? ((props.widget!.data as Record<string, unknown>).publicHosts as Record<
          string,
          string
        >)
      : {}) || {};
  publicHostTemp.value = map[c.Id] || "";
  editingPublicId.value = c.Id;
};
const savePublicHost = (c: DockerContainer) => {
  if (!requireDockerWidgetMutation()) return;
  const w = store.widgets.find((x) => x.id === props.widget?.id);
  if (!w) return;
  if (!w.data) w.data = {};
  const map =
    typeof (w.data as Record<string, unknown>).publicHosts === "object"
      ? ((w.data as Record<string, unknown>).publicHosts as Record<
          string,
          string
        >)
      : {};
  map[c.Id] = publicHostTemp.value.trim();
  (w.data as Record<string, unknown>).publicHosts = map;
  store.markDirty();
  editingPublicId.value = null;
};
const cancelPublicHost = () => {
  editingPublicId.value = null;
};
</script>

<template>
  <div
    v-if="isOpenedVariant"
    class="docker-opened-workbench custom-scrollbar"
    data-runtime-open-ignore="true"
  >
    <header class="docker-opened-header">
      <div>
        <span class="docker-opened-kicker">Container workbench</span>
        <h2>Docker</h2>
        <p>{{ dockerEngineLabel }}</p>
      </div>
      <div class="docker-opened-actions">
        <button
          type="button"
          data-docker-action
          :disabled="isLoading || dockerState === 'disabled'"
          @click="() => checkConnection(false)"
        >
          {{ isLoading ? "刷新中" : dockerState === "ready" ? "刷新" : "检测" }}
        </button>
        <button
          type="button"
          data-docker-action
          :disabled="
            updateStatus?.isChecking ||
            !autoUpdateEnabled ||
            !isDockerFeatureEnabled
          "
          @click="triggerUpdateCheck"
        >
          {{ updateLabel }}
        </button>
        <button
          type="button"
          data-docker-action
          :disabled="isExportingDockerLogs || !isDockerFeatureEnabled"
          @click="exportDockerLogs"
        >
          {{ isExportingDockerLogs ? "导出中" : "导出日志" }}
        </button>
      </div>
    </header>

    <div class="docker-opened-layout">
      <main class="docker-opened-main">
        <section class="docker-opened-overview">
          <article>
            <span>状态</span>
            <strong>{{ statusLabel }}</strong>
            <em>{{ statusCaption }}</em>
          </article>
          <article>
            <span>容器</span>
            <strong
              >{{ runningContainers.length }}/{{ containers.length }}</strong
            >
            <em>{{ stoppedContainers }} stopped</em>
          </article>
          <article>
            <span>CPU</span>
            <strong>{{ dockerCpuTotal.toFixed(1) }}%</strong>
            <em>running total</em>
          </article>
          <article>
            <span>内存</span>
            <strong>{{ formatBytes(dockerMemoryTotal) }}</strong>
            <em>{{ dockerEndpointLabel }}</em>
          </article>
        </section>

        <section class="docker-opened-containers">
          <div class="docker-opened-section-title">
            <strong>容器列表</strong>
            <span v-if="errorDisplay">{{ errorDisplay }}</span>
            <span v-else>{{ openedContainers.length }} containers visible</span>
          </div>
          <div
            v-if="dockerState === 'disabled'"
            class="docker-opened-empty"
            data-testid="docker-opened-disabled"
          >
            Docker 服务已关闭
          </div>
          <div
            v-else-if="!openedContainers.length"
            class="docker-opened-empty"
            data-testid="docker-opened-empty"
          >
            {{ isLoading ? "正在读取容器" : "暂无容器" }}
          </div>
          <template v-else>
            <article
              v-for="container in openedContainers"
              :key="container.Id"
              class="docker-opened-container"
              :class="{ 'is-running': container.State === 'running' }"
            >
              <div class="docker-opened-container-main">
                <span class="docker-container-dot"></span>
                <div class="docker-container-title">
                  <strong
                    :title="
                      normalizeContainerName(
                        container.Names?.[0] || 'Container',
                      )
                    "
                  >
                    {{
                      normalizeContainerName(
                        container.Names?.[0] || "Container",
                      )
                    }}
                  </strong>
                  <span :title="container.Image">{{ container.Image }}</span>
                </div>
                <div class="docker-container-state">
                  <span>{{ container.Status }}</span>
                  <em v-if="container.hasUpdate">可升级</em>
                </div>
              </div>
              <div class="docker-opened-container-metrics">
                <span>
                  CPU
                  {{
                    container.stats
                      ? `${container.stats.cpuPercent.toFixed(1)}%`
                      : "--"
                  }}
                </span>
                <span>
                  MEM
                  {{
                    container.stats
                      ? formatBytes(container.stats.memUsage)
                      : "--"
                  }}
                </span>
                <span>{{
                  getPreferredPort(container)
                    ? `:${getPreferredPort(container)}`
                    : "no port"
                }}</span>
              </div>
              <div class="docker-opened-container-actions" data-docker-action>
                <button
                  v-if="
                    container.State === 'running' && getPreferredPort(container)
                  "
                  type="button"
                  data-docker-action
                  @click="openContainerUrl(container)"
                >
                  内网
                </button>
                <button
                  v-if="
                    container.State === 'running' && getPreferredPort(container)
                  "
                  type="button"
                  data-docker-action
                  @click="openContainerPublicUrl(container)"
                >
                  外网
                </button>
                <button
                  v-if="container.State === 'running'"
                  type="button"
                  data-docker-action
                  @click="addToHome(container)"
                >
                  添加
                </button>
                <button
                  v-if="container.State !== 'running'"
                  type="button"
                  data-docker-action
                  @click="handleAction(container.Id, 'start')"
                >
                  启动
                </button>
                <button
                  v-if="container.State === 'running'"
                  type="button"
                  data-docker-action
                  @click="handleAction(container.Id, 'stop')"
                >
                  停止
                </button>
                <button
                  type="button"
                  data-docker-action
                  @click="handleAction(container.Id, 'restart')"
                >
                  重启
                </button>
              </div>
            </article>
          </template>
        </section>
      </main>

      <aside class="docker-opened-settings" data-runtime-open-ignore="true">
        <section class="docker-settings-section">
          <div class="docker-settings-section-title">
            <strong>Docker 组件设置</strong>
            <span>{{
              isDockerFeatureEnabled
                ? "Docker API 已允许访问"
                : "Docker API 当前关闭"
            }}</span>
          </div>
          <AppSwitch
            :model-value="isDockerFeatureEnabled"
            label="Docker 服务"
            hint="控制后端是否读取宿主机 Docker Socket。"
            :disabled="!canManageDockerSystem || isUpdatingDockerSystem"
            @change="setDockerSystemEnabled"
          />
          <AppSwitch
            :model-value="dockerWidgetEnabled"
            label="显示 Docker 组件"
            hint="关闭后可从添加组件弹窗重新启用。"
            @change="setDockerWidgetEnabled"
          />
          <AppSwitch
            :model-value="dockerWidgetPublic"
            label="公开显示"
            hint="允许未登录访问者看到此组件。"
            @change="setDockerWidgetPublic"
          />
          <AppSwitch
            :model-value="dockerWidgetMobileVisible"
            label="移动端显示"
            hint="控制手机布局中是否保留此组件。"
            @change="setDockerWidgetMobileVisible"
          />
        </section>

        <section class="docker-settings-section">
          <div class="docker-settings-section-title">
            <strong>自动更新</strong>
            <span>控制镜像更新检测和清理保护阈值。</span>
          </div>
          <AppSwitch
            :model-value="autoUpdateEnabled"
            label="自动检测镜像升级"
            hint="开启后可手动触发后端更新检查。"
            @change="setDockerAutoUpdate"
          />
          <div class="docker-settings-grid">
            <label class="docker-settings-field">
              <span>保留旧镜像</span>
              <input
                type="number"
                min="0"
                max="50"
                :value="dockerKeepImages"
                :disabled="!autoUpdateEnabled"
                @change="
                  (event) =>
                    setDockerKeepImages(
                      (event.target as HTMLInputElement).value,
                    )
                "
              />
            </label>
            <label class="docker-settings-field">
              <span>最小剩余空间 GB</span>
              <input
                type="number"
                min="0"
                max="1024"
                step="0.5"
                :value="dockerMinFreeGb"
                :disabled="!autoUpdateEnabled"
                @change="
                  (event) =>
                    setDockerMinFreeGb((event.target as HTMLInputElement).value)
                "
              />
            </label>
          </div>
          <label class="docker-settings-field">
            <span>内网主机</span>
            <input
              type="text"
              placeholder="例如 192.168.1.10 或 nas.local"
              :value="dockerLanHost"
              @change="
                (event) =>
                  setDockerLanHost((event.target as HTMLInputElement).value)
              "
            />
          </label>
        </section>
      </aside>
    </div>

    <div v-if="toastMessage" class="docker-toast">{{ toastMessage }}</div>
  </div>

  <div
    v-else
    class="docker-widget"
    :class="[
      displaySizeClass,
      `is-${displaySize.tier}`,
      {
        'is-compact': isCompactLayout,
        'is-tiny': isTinyDockerLayout,
        'is-short': isShortDockerLayout,
        'is-vertical': isVerticalDockerLayout,
        'is-board': displaySize.isBoard,
        'is-disabled': dockerState === 'disabled',
      },
    ]"
    :data-widget-size="displaySize.sizeKey"
  >
    <section v-if="showDockerSummary" class="docker-widget-summary">
      <div class="docker-widget-total">
        <span>{{ statusLabel }}</span>
        <strong>{{ runningContainers.length }}/{{ containers.length }}</strong>
      </div>
      <div v-if="showDockerCounters" class="docker-widget-counters">
        <span :aria-label="`${runningContainers.length} 运行`">
          <i class="is-ready"></i>
          <b>{{ runningContainers.length }}</b>
          <em>运行</em>
        </span>
        <span :aria-label="`${stoppedContainers} 停止`">
          <i class="is-muted"></i>
          <b>{{ stoppedContainers }}</b>
          <em>停止</em>
        </span>
        <span v-if="unhealthyCount"
          ><i class="is-danger"></i><b>{{ unhealthyCount }}</b
          ><em>异常</em></span
        >
      </div>
      <p v-if="showDockerBoardHint" class="docker-widget-board-hint">
        {{ dockerBoardHint }}
      </p>
    </section>

    <div
      v-if="showDockerContainerList"
      class="docker-container-list custom-scrollbar"
    >
      <div v-if="error && !displaySize.isBoard" class="docker-widget-warning">
        {{ errorDisplay }}
      </div>
      <article
        v-for="container in visibleContainers"
        :key="container.Id"
        class="docker-container-card"
        :class="{ 'is-running': container.State === 'running' }"
      >
        <div class="docker-container-main">
          <span class="docker-container-dot"></span>
          <div class="docker-container-title">
            <strong
              :title="
                normalizeContainerName(container.Names?.[0] || 'Container')
              "
            >
              {{ normalizeContainerName(container.Names?.[0] || "Container") }}
            </strong>
            <span :title="container.Image">{{ container.Image }}</span>
          </div>
          <div class="docker-container-state">
            <span>{{ container.Status }}</span>
            <em v-if="container.hasUpdate">可升级</em>
          </div>
        </div>

        <div v-if="showContainerDetails" class="docker-container-metrics">
          <div>
            <span>CPU</span>
            <strong>{{
              container.stats
                ? `${container.stats.cpuPercent.toFixed(1)}%`
                : "--"
            }}</strong>
            <i>
              <b
                :style="{
                  width: container.stats
                    ? `${Math.min(container.stats.cpuPercent, 100)}%`
                    : '0%',
                }"
              ></b>
            </i>
          </div>
          <div>
            <span>MEM</span>
            <strong>{{
              container.stats ? formatBytes(container.stats.memUsage) : "--"
            }}</strong>
            <i>
              <b
                :style="{
                  width: container.stats
                    ? `${Math.min(container.stats.memPercent, 100)}%`
                    : '0%',
                }"
              ></b>
            </i>
          </div>
        </div>

        <div
          v-if="showContainerActions"
          class="docker-container-actions"
          data-runtime-open-ignore="true"
        >
          <button
            v-if="container.State === 'running' && getPreferredPort(container)"
            type="button"
            data-docker-action
            @click="openContainerUrl(container)"
          >
            内网
          </button>
          <button
            v-if="container.State === 'running' && getPreferredPort(container)"
            type="button"
            data-docker-action
            @click="openContainerPublicUrl(container)"
          >
            外网
          </button>
          <button
            v-if="container.State === 'running'"
            type="button"
            data-docker-action
            @click="addToHome(container)"
          >
            添加
          </button>
          <button
            v-if="container.State !== 'running'"
            type="button"
            data-docker-action
            @click="handleAction(container.Id, 'start')"
          >
            启动
          </button>
          <button
            v-if="container.State === 'running'"
            type="button"
            data-docker-action
            @click="handleAction(container.Id, 'stop')"
          >
            停止
          </button>
          <button
            type="button"
            data-docker-action
            @click="handleAction(container.Id, 'restart')"
          >
            重启
          </button>
          <button
            type="button"
            data-docker-action
            @click="promptPublicHost(container)"
          >
            外网地址
          </button>
          <label data-docker-action>
            <input
              type="checkbox"
              :checked="isAutoUpdateDisabled(container.Id)"
              @change="
                (event) =>
                  toggleAutoUpdateDisabled(
                    container.Id,
                    (event.target as HTMLInputElement).checked,
                  )
              "
            />
            跳过升级
          </label>
        </div>

        <div
          v-if="editingPublicId === container.Id"
          class="docker-public-host-editor"
          data-runtime-open-ignore="true"
        >
          <input
            v-model="publicHostTemp"
            type="text"
            placeholder="nas.example.com"
          />
          <button type="button" @click="savePublicHost(container)">保存</button>
          <button type="button" @click="cancelPublicHost">取消</button>
        </div>
      </article>
    </div>
  </div>

  <AppModalShell
    :show="showManualPortPrompt"
    :z-index="120"
    title="补充访问端口"
    subtitle="未检测到端口映射时，手动补充一个可访问端口。"
    blocking
    :show-close="false"
    overlay-class="sd-overlay-strong"
    panel-class="w-full max-w-md"
    surface-class="sd-compact-window"
    body-class="space-y-4"
    initial-focus="first"
  >
    <div class="space-y-2">
      <p class="text-sm text-[var(--sd-color-text-secondary)]">
        容器：<span class="font-semibold text-[var(--sd-color-text-primary)]">{{
          manualPortContainerName
        }}</span>
      </p>
      <label class="sd-label" for="docker-manual-port">端口号</label>
      <input
        id="docker-manual-port"
        v-model="manualPortValue"
        type="text"
        inputmode="numeric"
        class="sd-input"
        placeholder="例如 8080"
        @keyup.enter="confirmManualPort"
      />
      <p
        v-if="manualPortError"
        class="text-xs text-[var(--sd-color-accent-danger)]"
      >
        {{ manualPortError }}
      </p>
    </div>

    <template #footer>
      <AppButton
        variant="secondary"
        data-modal-cancel
        @click="closeManualPortPrompt(null)"
      >
        取消
      </AppButton>
      <AppButton variant="primary" @click="confirmManualPort"
        >继续添加</AppButton
      >
    </template>
  </AppModalShell>
</template>

<style scoped>
.docker-opened-workbench {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 1rem;
  overflow: auto;
  background: var(--sd-color-surface, var(--sd-theme-docker-widget-surface-01));
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-01)
  );
  padding: 1.4rem;
}

.docker-opened-header,
.docker-opened-actions,
.docker-opened-container-main,
.docker-opened-container-actions,
.docker-opened-container-metrics {
  display: flex;
  align-items: center;
  min-width: 0;
}

.docker-opened-header {
  justify-content: space-between;
  gap: 1rem;
  padding-right: 5.2rem;
}

.docker-opened-kicker {
  color: var(
    --sd-color-accent-primary,
    var(--sd-theme-docker-widget-accent-text-02)
  );
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.docker-opened-header h2 {
  margin: 0.1rem 0;
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-01)
  );
  font-size: 1.8rem;
  font-weight: 820;
  letter-spacing: 0;
  line-height: 1;
}

.docker-opened-header p {
  margin: 0;
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-docker-widget-accent-text-03)
  );
  font-size: 0.82rem;
  font-weight: 650;
}

.docker-opened-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

.docker-opened-actions button,
.docker-opened-container-actions button {
  border: 1px solid
    var(--sd-color-border-subtle, var(--sd-theme-docker-widget-border-01));
  border-radius: 999px;
  background: var(
    --sd-color-surface-muted,
    var(--sd-theme-docker-widget-surface-02)
  );
  color: var(
    --sd-color-accent-primary,
    var(--sd-theme-docker-widget-accent-text-04)
  );
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 760;
  line-height: 1;
  padding: 0.55rem 0.72rem;
}

.docker-opened-actions button:disabled {
  cursor: default;
  opacity: 0.44;
}

.docker-opened-layout {
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 21rem);
  gap: 1rem;
}

.docker-opened-main,
.docker-opened-settings,
.docker-opened-containers {
  min-width: 0;
  min-height: 0;
}

.docker-opened-main {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 1rem;
}

.docker-opened-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.72rem;
}

.docker-opened-overview article,
.docker-opened-container,
.docker-opened-settings .docker-settings-section {
  border: 1px solid
    var(--sd-color-border-subtle, var(--sd-theme-docker-widget-border-02));
  border-radius: 1rem;
  background: var(
    --sd-color-surface-muted,
    var(--sd-theme-docker-widget-surface-03)
  );
  box-shadow: 0 14px 30px var(--sd-theme-docker-widget-shadow-01);
}

.docker-opened-overview article {
  display: grid;
  min-width: 0;
  gap: 0.28rem;
  padding: 0.85rem;
}

.docker-opened-overview span,
.docker-opened-overview em,
.docker-opened-section-title span,
.docker-opened-container-metrics,
.docker-opened-empty {
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-docker-widget-accent-text-03)
  );
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 680;
}

.docker-opened-overview strong {
  overflow: hidden;
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-01)
  );
  font-size: 1.18rem;
  font-weight: 820;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.docker-opened-containers,
.docker-opened-settings {
  display: grid;
  align-content: start;
  gap: 0.7rem;
  overflow: auto;
}

.docker-opened-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
}

.docker-opened-section-title strong {
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-01)
  );
  font-size: 0.96rem;
  font-weight: 800;
}

.docker-opened-container {
  display: grid;
  gap: 0.65rem;
  padding: 0.72rem;
}

.docker-opened-container-main {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.6rem;
}

.docker-opened-container .docker-container-title strong {
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-01)
  );
}

.docker-opened-container .docker-container-title span,
.docker-opened-container .docker-container-state span {
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-docker-widget-accent-text-03)
  );
}

.docker-opened-container-metrics {
  flex-wrap: wrap;
  gap: 0.48rem;
}

.docker-opened-container-metrics span {
  border-radius: 999px;
  background: var(--sd-color-surface, var(--sd-theme-docker-widget-surface-01));
  padding: 0.32rem 0.5rem;
}

.docker-opened-container-actions {
  flex-wrap: wrap;
  gap: 0.38rem;
}

.docker-opened-empty {
  display: grid;
  min-height: 10rem;
  place-items: center;
  border: 1px dashed
    var(--sd-color-border-subtle, var(--sd-theme-docker-widget-border-02));
  border-radius: 1rem;
}

.docker-opened-settings .docker-settings-section {
  background: var(
    --sd-color-surface-muted,
    var(--sd-theme-docker-widget-surface-03)
  );
}

.docker-opened-settings .docker-settings-section-title strong {
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-01)
  );
}

.docker-opened-settings .docker-settings-section-title span,
.docker-opened-settings .docker-settings-field span {
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-docker-widget-accent-text-03)
  );
}

.docker-opened-settings .docker-settings-field input {
  border-color: var(
    --sd-color-border-subtle,
    var(--sd-theme-docker-widget-border-01)
  );
  background: var(--sd-color-surface, var(--sd-theme-docker-widget-surface-01));
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-01)
  );
}

.docker-toast {
  position: absolute;
  right: 1.2rem;
  bottom: 1rem;
  border-radius: 999px;
  background: var(--sd-theme-docker-widget-accent-surface-01);
  color: var(--sd-theme-docker-widget-text-01);
  font-size: 0.78rem;
  font-weight: 760;
  padding: 0.55rem 0.8rem;
}

.docker-widget {
  display: grid;
  position: relative;
  box-sizing: border-box;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  width: 100%;
  min-width: 0;
  gap: 0.62rem;
  overflow: hidden;
  border: 1px solid
    var(--sd-color-border-subtle, var(--sd-theme-docker-widget-border-03));
  border-radius: 1rem;
  background: var(--sd-color-surface, var(--sd-theme-docker-widget-surface-04));
  padding: 0.9rem;
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-05)
  );
  box-shadow: var(
    --sd-shadow-widget,
    0 16px 36px var(--sd-theme-docker-widget-shadow-02)
  );
}

:global(.dark) .docker-widget {
  background: var(
    --sd-color-surface,
    var(--sd-theme-docker-widget-accent-surface-02)
  );
}

.docker-widget.is-compact {
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.52rem;
  padding: 0.75rem;
}

.docker-widget[data-widget-size="2x2"] {
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.48rem;
  padding: 0.74rem;
}

.docker-widget.is-tiny {
  grid-template-rows: minmax(0, 1fr);
  gap: 0;
  place-items: center;
  padding: 0.42rem;
}

.docker-widget.is-short {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  align-items: center;
  gap: 0.55rem;
  padding: 0.48rem 0.58rem;
}

.docker-widget.is-vertical {
  grid-template-rows: auto minmax(0, 1fr);
  align-items: center;
  justify-items: center;
  gap: 0.46rem;
  padding: 0.52rem 0.46rem;
}

.docker-widget-counters,
.docker-widget-actions,
.docker-container-main,
.docker-container-actions,
.docker-public-host-editor {
  display: flex;
  align-items: center;
  min-width: 0;
}

.docker-widget-counters,
.docker-widget-empty span,
.docker-widget-empty em,
.docker-container-title span,
.docker-container-state span {
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-docker-widget-accent-text-03)
  );
  font-size: 0.69rem;
  font-weight: 650;
}

.docker-widget-counters i,
.docker-container-dot {
  display: block;
  width: 0.45rem;
  height: 0.45rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(
    --sd-color-text-tertiary,
    var(--sd-theme-docker-widget-surface-05)
  );
}

.docker-widget-counters i.is-ready,
.docker-container-card.is-running .docker-container-dot {
  background: var(--sd-theme-docker-widget-accent-surface-03);
  box-shadow: 0 0 0 0.2rem var(--sd-theme-docker-widget-shadow-03);
}

.docker-widget-counters i.is-danger {
  background: var(--sd-theme-docker-widget-accent-surface-04);
}

.docker-widget-summary {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.42rem;
  grid-column: 1 / -1;
}

.docker-widget-total {
  display: flex;
  align-items: end;
  justify-content: space-between;
  min-width: 0;
  gap: 0.7rem;
}

.docker-widget-total span {
  color: var(--sd-color-text-tertiary, var(--sd-theme-docker-widget-text-02));
  font-size: 0.68rem;
  font-weight: 740;
}

.docker-widget-total strong {
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-05)
  );
  font-size: 2.6rem;
  font-weight: 780;
  letter-spacing: 0;
  line-height: 1.05;
}

.docker-widget.is-board .docker-widget-total strong {
  font-size: 2.35rem;
  line-height: 1;
}

.docker-widget.is-compact .docker-widget-total strong {
  font-size: 2.2rem;
}

.docker-widget[data-widget-size="2x2"] .docker-widget-total strong {
  font-size: 2rem;
}

.docker-widget.is-tiny .docker-widget-total strong {
  font-size: 1.22rem;
  line-height: 1;
}

.docker-widget.is-short .docker-widget-total strong,
.docker-widget.is-vertical .docker-widget-total strong {
  font-size: 1.1rem;
  line-height: 1;
}

.docker-widget-counters {
  flex-wrap: wrap;
  gap: 0.35rem;
}

.docker-widget-board-hint {
  min-width: 0;
  overflow: hidden;
  margin: -0.05rem 0 0;
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-docker-widget-accent-text-03)
  );
  font-size: 0.72rem;
  font-weight: 720;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.docker-widget-counters span {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  border-radius: 999px;
  background: var(
    --sd-color-surface-muted,
    var(--sd-theme-docker-widget-surface-06)
  );
  padding: 0.24rem 0.46rem;
}

.docker-widget-counters b,
.docker-widget-counters em {
  color: inherit;
  font: inherit;
}

.docker-widget-counters b {
  font-weight: 780;
}

.docker-widget-counters em {
  font-style: normal;
}

.docker-widget-actions {
  gap: 0.42rem;
  overflow: hidden;
}

.docker-action,
.docker-widget-empty button,
.docker-container-actions button,
.docker-public-host-editor button {
  border: 0;
  border-radius: 999px;
  background: var(
    --sd-color-surface-muted,
    var(--sd-theme-docker-widget-surface-07)
  );
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-05)
  );
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 720;
  line-height: 1;
  padding: 0.42rem 0.62rem;
  transition:
    background-color 160ms ease,
    color 160ms ease,
    opacity 160ms ease;
}

.docker-action:hover,
.docker-widget-empty button:hover,
.docker-container-actions button:hover,
.docker-public-host-editor button:hover {
  background: color-mix(
    in srgb,
    var(--sd-theme-docker-widget-accent-surface-05) 16%,
    var(--sd-color-surface-muted)
  );
  color: var(--sd-theme-docker-widget-accent-text-02);
}

.docker-action:disabled,
.docker-widget-empty button:disabled {
  cursor: default;
  opacity: 0.5;
}

.docker-widget-empty {
  display: grid;
  min-width: 0;
  place-items: center;
  align-content: center;
  gap: 0.45rem;
  border: 1px dashed
    var(--sd-color-border-subtle, var(--sd-theme-docker-widget-border-04));
  border-radius: 0.9rem;
  background: var(
    --sd-color-surface-muted,
    var(--sd-theme-docker-widget-surface-08)
  );
  padding: 0.75rem;
  text-align: center;
}

.docker-widget-empty strong {
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-05)
  );
  font-size: 0.84rem;
  font-weight: 760;
  line-height: 1.25;
}

.docker-widget-empty.is-error strong {
  color: var(
    --sd-color-accent-danger,
    var(--sd-theme-docker-widget-accent-text-06)
  );
}

.docker-widget-empty.is-error span {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.docker-widget.is-board .docker-widget-empty {
  min-height: 0;
  align-content: center;
  gap: 0.34rem;
  padding: 0.58rem 0.75rem;
}

.docker-widget[data-widget-size="2x2"] .docker-widget-empty {
  min-height: 0;
  gap: 0.34rem;
  padding: 0.58rem;
}

.docker-widget.is-board .docker-widget-empty.is-error span {
  -webkit-line-clamp: 1;
}

.docker-container-list {
  display: grid;
  min-height: 0;
  gap: 0.48rem;
  overflow: auto;
  padding-right: 0.08rem;
}

.docker-widget.is-board .docker-container-list {
  gap: 0.38rem;
  overflow: hidden;
  padding-right: 0;
}

.docker-widget-warning {
  border-radius: 0.72rem;
  background: var(--sd-theme-docker-widget-accent-surface-06);
  color: var(--sd-theme-docker-widget-accent-text-07);
  font-size: 0.68rem;
  font-weight: 720;
  padding: 0.42rem 0.55rem;
}

.docker-container-card {
  display: grid;
  min-width: 0;
  gap: 0.46rem;
  border: 1px solid
    var(--sd-color-border-subtle, var(--sd-theme-docker-widget-border-05));
  border-radius: 0.86rem;
  background: var(
    --sd-color-surface-muted,
    var(--sd-theme-docker-widget-surface-08)
  );
  padding: 0.58rem;
}

.docker-widget.is-board .docker-container-card {
  gap: 0;
  padding: 0.36rem 0.5rem;
}

.docker-widget.is-board .docker-container-main {
  align-items: center;
}

.docker-widget.is-board .docker-container-title {
  gap: 0;
}

.docker-widget.is-board .docker-container-title span {
  display: none;
}

.docker-container-main {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.5rem;
}

.docker-container-title {
  display: grid;
  min-width: 0;
  gap: 0.16rem;
}

.docker-container-title strong {
  overflow: hidden;
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-05)
  );
  font-size: 0.78rem;
  font-weight: 760;
  line-height: 1.16;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.docker-container-title span,
.docker-container-state span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.docker-container-state {
  display: grid;
  justify-items: end;
  gap: 0.2rem;
  min-width: 4rem;
  max-width: 6.5rem;
}

.docker-widget.is-board .docker-container-state {
  min-width: 3.6rem;
}

.docker-container-state em {
  border-radius: 999px;
  background: var(--sd-theme-docker-widget-accent-surface-07);
  color: var(--sd-theme-docker-widget-accent-text-08);
  font-size: 0.62rem;
  font-style: normal;
  font-weight: 760;
  padding: 0.18rem 0.36rem;
  white-space: nowrap;
}

.docker-container-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.docker-container-metrics div {
  display: grid;
  gap: 0.24rem;
  min-width: 0;
}

.docker-container-metrics div > span,
.docker-container-metrics strong {
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-docker-widget-accent-text-03)
  );
  font-size: 0.66rem;
  font-weight: 700;
}

.docker-container-metrics strong {
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-05)
  );
  text-align: right;
}

.docker-container-metrics i {
  display: block;
  height: 0.32rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--sd-color-surface, var(--sd-theme-docker-widget-surface-09));
}

.docker-container-metrics b {
  display: block;
  height: 100%;
  max-width: 100%;
  border-radius: inherit;
  background: var(--sd-theme-docker-widget-accent-surface-05);
}

.docker-container-metrics div:nth-child(2) b {
  background: var(--sd-theme-docker-widget-accent-surface-08);
}

.docker-container-actions {
  flex-wrap: wrap;
  gap: 0.32rem;
  border-top: 1px solid
    var(--sd-color-border-subtle, var(--sd-theme-docker-widget-border-06));
  padding-top: 0.45rem;
}

.docker-container-actions label {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border-radius: 999px;
  background: var(
    --sd-color-surface-muted,
    var(--sd-theme-docker-widget-surface-07)
  );
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-docker-widget-accent-text-03)
  );
  cursor: pointer;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.36rem 0.54rem;
}

.docker-public-host-editor {
  gap: 0.36rem;
}

.docker-public-host-editor input {
  min-width: 0;
  flex: 1 1 auto;
  border: 1px solid
    var(--sd-color-border-subtle, var(--sd-theme-docker-widget-border-07));
  border-radius: 999px;
  background: var(--sd-color-surface, var(--sd-theme-docker-widget-surface-04));
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-05)
  );
  font-size: 0.72rem;
  outline: none;
  padding: 0.42rem 0.62rem;
}

.docker-widget.is-compact .docker-widget-actions,
.docker-widget.is-compact .docker-container-state {
  display: none;
}

.docker-widget[data-widget-size="2x2"] .docker-widget-empty span {
  display: none;
}

.docker-widget.is-tiny .docker-widget-counters,
.docker-widget.is-short .docker-widget-counters,
.docker-widget.is-vertical .docker-widget-total > span {
  display: none;
}

.docker-widget.is-tiny .docker-widget-summary,
.docker-widget.is-vertical .docker-widget-summary {
  align-self: center;
  width: 100%;
  gap: 0;
  text-align: center;
}

.docker-widget.is-short .docker-widget-summary {
  align-self: center;
  min-width: 0;
  gap: 0.28rem;
}

.docker-widget.is-tiny .docker-widget-total,
.docker-widget.is-vertical .docker-widget-total {
  display: grid;
  justify-items: center;
  gap: 0.18rem;
}

.docker-widget.is-vertical .docker-widget-counters {
  display: grid;
  justify-items: center;
  gap: 0.28rem;
  width: 100%;
}

.docker-widget.is-vertical .docker-widget-counters span {
  gap: 0.16rem;
  padding: 0.2rem 0.28rem;
  font-size: 0.62rem;
  line-height: 1;
}

.docker-widget.is-vertical .docker-widget-counters i {
  width: 0.34rem;
  height: 0.34rem;
}

.docker-widget.is-vertical .docker-widget-counters em {
  display: none;
}

.docker-widget.is-short .docker-widget-total {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 0.5rem;
}

.docker-widget.is-compact .docker-container-main {
  grid-template-columns: auto minmax(0, 1fr);
}

.docker-widget.is-compact .docker-container-card {
  padding: 0.45rem 0.5rem;
}

.docker-settings-section {
  display: grid;
  min-width: 0;
  gap: 0.75rem;
  border: 1px solid
    var(--sd-color-border-subtle, var(--sd-theme-docker-widget-border-08));
  border-radius: 1rem;
  background: var(
    --sd-color-surface-muted,
    var(--sd-theme-docker-widget-surface-08)
  );
  padding: 0.9rem;
}

.docker-settings-section + .docker-settings-section {
  margin-top: 0.85rem;
}

.docker-settings-section-title {
  display: grid;
  min-width: 0;
  gap: 0.18rem;
}

.docker-settings-section-title strong {
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-05)
  );
  font-size: 0.98rem;
  font-weight: 780;
}

.docker-settings-section-title span,
.docker-settings-error,
.docker-settings-field span {
  color: var(
    --sd-color-text-secondary,
    var(--sd-theme-docker-widget-accent-text-03)
  );
  font-size: 0.78rem;
  font-weight: 650;
}

.docker-settings-actions,
.docker-settings-grid {
  display: flex;
  flex-wrap: wrap;
  min-width: 0;
  gap: 0.55rem;
}

.docker-settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.docker-settings-field {
  display: grid;
  min-width: 0;
  gap: 0.38rem;
}

.docker-settings-field input {
  width: 100%;
  min-width: 0;
  border: 1px solid
    var(--sd-color-border-subtle, var(--sd-theme-docker-widget-border-09));
  border-radius: 0.78rem;
  background: var(--sd-color-surface, var(--sd-theme-docker-widget-surface-04));
  color: var(
    --sd-color-text-primary,
    var(--sd-theme-docker-widget-accent-text-05)
  );
  font-size: 0.9rem;
  font-weight: 680;
  outline: none;
  padding: 0.66rem 0.75rem;
}

.docker-settings-field input:disabled {
  cursor: not-allowed;
  opacity: 0.54;
}

.docker-settings-error {
  border-radius: 0.78rem;
  background: var(--sd-theme-docker-widget-accent-surface-07);
  color: var(
    --sd-color-accent-danger,
    var(--sd-theme-docker-widget-accent-text-06)
  );
  padding: 0.62rem 0.7rem;
}

@media (max-width: 640px) {
  .docker-opened-workbench {
    padding: 1rem;
  }

  .docker-opened-header {
    align-items: flex-start;
    flex-direction: column;
    padding-right: 3.5rem;
  }

  .docker-opened-layout,
  .docker-opened-overview {
    grid-template-columns: minmax(0, 1fr);
  }

  .docker-settings-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
