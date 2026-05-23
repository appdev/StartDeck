import { ref } from "vue";
import { defineStore } from "pinia";

export type UiFeedbackTone = "info" | "success" | "warning" | "danger";

export interface UiToastItem {
  id: number;
  title?: string;
  message: string;
  tone?: UiFeedbackTone;
}

interface NotifyOptions {
  title?: string;
  message: string;
  tone?: UiFeedbackTone;
  durationMs?: number;
}

interface AlertOptions {
  title?: string;
  message: string;
  tone?: UiFeedbackTone;
  actionLabel?: string;
  blocking?: boolean;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  blocking?: boolean;
}

let nextToastId = 1;

export const useUiFeedbackStore = defineStore("ui-feedback", () => {
  const toasts = ref<UiToastItem[]>([]);
  const alertDialog = ref({
    show: false,
    title: "提示",
    message: "",
    tone: "info" as UiFeedbackTone,
    actionLabel: "知道了",
    blocking: false,
  });
  const confirmDialog = ref({
    show: false,
    title: "确认操作",
    message: "",
    confirmLabel: "确认",
    cancelLabel: "取消",
    tone: "default" as "default" | "danger",
    blocking: true,
  });

  let alertResolver: (() => void) | null = null;
  let confirmResolver: ((accepted: boolean) => void) | null = null;
  const toastTimers = new Map<number, ReturnType<typeof setTimeout>>();

  const dismissToast = (id: number) => {
    const timer = toastTimers.get(id);
    if (timer) {
      globalThis.clearTimeout(timer);
      toastTimers.delete(id);
    }
    toasts.value = toasts.value.filter((item) => item.id !== id);
  };

  const notify = ({
    title,
    message,
    tone = "info",
    durationMs = 2600,
  }: NotifyOptions) => {
    const id = nextToastId++;
    toasts.value = [...toasts.value, { id, title, message, tone }];
    const timer = globalThis.setTimeout(() => dismissToast(id), durationMs);
    toastTimers.set(id, timer);
    return id;
  };

  const closeAlert = () => {
    if (!alertDialog.value.show) return;
    alertDialog.value.show = false;
    const resolve = alertResolver;
    alertResolver = null;
    resolve?.();
  };

  const alert = ({
    title = "提示",
    message,
    tone = "info",
    actionLabel = "知道了",
    blocking = false,
  }: AlertOptions) => {
    if (alertResolver) {
      alertResolver();
      alertResolver = null;
    }
    alertDialog.value = {
      show: true,
      title,
      message,
      tone,
      actionLabel,
      blocking,
    };
    return new Promise<void>((resolve) => {
      alertResolver = resolve;
    });
  };

  const resolveConfirm = (accepted: boolean) => {
    if (!confirmDialog.value.show && !confirmResolver) return;
    confirmDialog.value.show = false;
    const resolve = confirmResolver;
    confirmResolver = null;
    resolve?.(accepted);
  };

  const confirm = ({
    title = "确认操作",
    message,
    confirmLabel = "确认",
    cancelLabel = "取消",
    tone = "default",
    blocking = true,
  }: ConfirmOptions) => {
    if (confirmResolver) {
      confirmResolver(false);
      confirmResolver = null;
    }
    confirmDialog.value = {
      show: true,
      title,
      message,
      confirmLabel,
      cancelLabel,
      tone,
      blocking,
    };
    return new Promise<boolean>((resolve) => {
      confirmResolver = resolve;
    });
  };

  return {
    toasts,
    alertDialog,
    confirmDialog,
    notify,
    dismissToast,
    alert,
    closeAlert,
    confirm,
    resolveConfirm,
  };
});
