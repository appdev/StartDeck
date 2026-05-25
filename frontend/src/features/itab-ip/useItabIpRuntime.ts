import { computed, ref } from "vue";
import { fetchItabIpLookup } from "./itabIpApi";
import {
  createErrorItabIpResult,
  createLoadingItabIpResult,
  formatItabIpAddress,
  formatItabIpArea,
  formatItabIpCoordinate,
  formatItabIpNetwork,
  formatItabIpOuterLocation,
  isLongItabIpAddress,
} from "./itabIpModel";
import type { ItabIpLookupResult, ItabIpLookupStatus } from "./itabIpTypes";

const result = ref<ItabIpLookupResult>(createLoadingItabIpResult());
const status = ref<ItabIpLookupStatus>("idle");
const loading = ref(false);
const error = ref("");
let abortController: AbortController | null = null;
let requestSerial = 0;

export const resetItabIpRuntimeForTests = () => {
  abortController?.abort();
  abortController = null;
  requestSerial = 0;
  status.value = "idle";
  loading.value = false;
  error.value = "";
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
      const next = await fetchItabIpLookup(refresh, controller.signal);
      if (serial === requestSerial) {
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

  const address = computed(() => formatItabIpAddress(result.value));
  const area = computed(() => formatItabIpArea(result.value));
  const outerLocation = computed(() => formatItabIpOuterLocation(result.value));
  const network = computed(() => formatItabIpNetwork(result.value));
  const coordinate = computed(() => formatItabIpCoordinate(result.value));
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
    addressClass,
    sourceStatus,
    load,
  };
};
