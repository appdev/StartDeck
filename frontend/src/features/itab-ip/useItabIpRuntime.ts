import { computed, ref } from "vue";
import { fetchItabIpLatency, fetchItabIpLookup } from "./itabIpApi";
import {
  createErrorItabIpResult,
  createLoadingItabIpResult,
  createItabIpMapEmbedUrl,
  formatItabIpAddress,
  formatItabIpArea,
  formatItabIpCoordinate,
  formatItabIpLatency,
  formatItabIpNetwork,
  formatItabIpOuterLocation,
  isLongItabIpAddress,
} from "./itabIpModel";
import type { ItabIpLookupResult, ItabIpLookupStatus } from "./itabIpTypes";

const result = ref<ItabIpLookupResult>(createLoadingItabIpResult());
const status = ref<ItabIpLookupStatus>("idle");
const loading = ref(false);
const error = ref("");
const latencyMs = ref<number | null>(null);
const latencyStatus = ref<ItabIpLookupStatus>("idle");
const latencyLoading = ref(false);
const latencyError = ref("");
const latencyIpKey = ref("");
let abortController: AbortController | null = null;
let latencyAbortController: AbortController | null = null;
let requestSerial = 0;
let latencyRequestSerial = 0;

const ipLatencyKey = (value: ItabIpLookupResult) =>
  (value.queryIp || value.ip || value.clientIp || "").trim();

export const resetItabIpRuntimeForTests = () => {
  abortController?.abort();
  latencyAbortController?.abort();
  abortController = null;
  latencyAbortController = null;
  requestSerial = 0;
  latencyRequestSerial = 0;
  status.value = "idle";
  loading.value = false;
  error.value = "";
  latencyMs.value = null;
  latencyStatus.value = "idle";
  latencyLoading.value = false;
  latencyError.value = "";
  latencyIpKey.value = "";
  result.value = createLoadingItabIpResult();
};

export const useItabIpRuntime = () => {
  const load = async (refresh = false) => {
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;
    const serial = ++requestSerial;
    const timeoutId =
      typeof window === "undefined"
        ? undefined
        : window.setTimeout(() => controller.abort(), 8000);
    loading.value = true;
    status.value = "loading";
    error.value = "";

    try {
      const previousIpKey = ipLatencyKey(result.value);
      const next = await fetchItabIpLookup(refresh, controller.signal);
      if (serial === requestSerial) {
        if (previousIpKey && previousIpKey !== ipLatencyKey(next)) {
          latencyMs.value = null;
          latencyStatus.value = "idle";
          latencyError.value = "";
          latencyIpKey.value = "";
        }
        result.value = next;
        status.value = next.sourceStatus === "error" ? "error" : "success";
        if (next.sourceStatus === "error") {
          error.value = "查询服务暂不可用，已显示可识别的本机地址";
        }
      }
      return next.sourceStatus === "ok";
    } catch (loadError) {
      if (!controller.signal.aborted && serial === requestSerial) {
        result.value = createErrorItabIpResult(result.value);
        status.value = "error";
        error.value =
          loadError instanceof Error && loadError.name === "AbortError"
            ? "查询超时，请稍后重试"
            : "查询失败，请稍后重试";
      }
      return false;
    } finally {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      if (abortController === controller) {
        abortController = null;
      }
      if (serial === requestSerial) {
        loading.value = false;
      }
    }
  };

  const ensureLoaded = async () => {
    if (status.value === "success" && ipLatencyKey(result.value)) return true;
    return load(false);
  };

  const refreshLatency = async (force = true) => {
    const currentIpKey = ipLatencyKey(result.value);
    if (!currentIpKey) return false;
    if (
      !force &&
      latencyMs.value !== null &&
      latencyStatus.value === "success" &&
      currentIpKey === latencyIpKey.value
    ) {
      return true;
    }

    latencyAbortController?.abort();
    const controller = new AbortController();
    latencyAbortController = controller;
    const serial = ++latencyRequestSerial;
    const timeoutId =
      typeof window === "undefined"
        ? undefined
        : window.setTimeout(() => controller.abort(), 2500);
    latencyLoading.value = true;
    latencyStatus.value = "loading";
    latencyError.value = "";

    try {
      const next = await fetchItabIpLatency(controller.signal);
      if (serial === latencyRequestSerial) {
        latencyMs.value = next.latencyMs;
        latencyStatus.value = "success";
        latencyError.value = "";
        latencyIpKey.value = currentIpKey;
      }
      return true;
    } catch {
      if (!controller.signal.aborted && serial === latencyRequestSerial) {
        latencyStatus.value = "error";
        latencyError.value = "延迟测试失败，请稍后重试";
      }
      return false;
    } finally {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      if (latencyAbortController === controller) {
        latencyAbortController = null;
      }
      if (serial === latencyRequestSerial) {
        latencyLoading.value = false;
      }
    }
  };

  const refreshLatencyIfNeeded = () => refreshLatency(false);

  const address = computed(() => formatItabIpAddress(result.value));
  const area = computed(() => formatItabIpArea(result.value));
  const outerLocation = computed(() => formatItabIpOuterLocation(result.value));
  const network = computed(() => formatItabIpNetwork(result.value));
  const coordinate = computed(() => formatItabIpCoordinate(result.value));
  const mapEmbedUrl = computed(() => createItabIpMapEmbedUrl(result.value));
  const latencyLabel = computed(() =>
    formatItabIpLatency(latencyMs.value, latencyStatus.value),
  );
  const latencyValue = computed(() =>
    latencyMs.value === null ? "" : String(Math.round(latencyMs.value)),
  );
  const addressClass = computed(() => ({
    "is-long-address": isLongItabIpAddress(result.value),
  }));
  const sourceStatus = computed(() => result.value.sourceStatus);

  return {
    result,
    status,
    loading,
    error,
    address,
    area,
    outerLocation,
    network,
    coordinate,
    mapEmbedUrl,
    latencyMs,
    latencyStatus,
    latencyLoading,
    latencyError,
    latencyLabel,
    latencyValue,
    addressClass,
    sourceStatus,
    load,
    ensureLoaded,
    refreshLatency,
    refreshLatencyIfNeeded,
  };
};
