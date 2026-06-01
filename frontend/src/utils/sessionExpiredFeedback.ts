import { useUiFeedbackStore } from "@/stores/uiFeedback";

export const SESSION_EXPIRED_TOAST_TITLE = "登录已过期";
export const SESSION_EXPIRED_TOAST_MESSAGE = "请重新登录。";

export const notifySessionExpired = () => {
  const uiFeedback = useUiFeedbackStore();
  uiFeedback.notify({
    title: SESSION_EXPIRED_TOAST_TITLE,
    message: SESSION_EXPIRED_TOAST_MESSAGE,
    tone: "warning",
    durationMs: 5000,
  });
};
