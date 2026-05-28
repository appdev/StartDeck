import { useAuthStore } from "@/stores/auth";
import { useUiFeedbackStore } from "@/stores/uiFeedback";

export const LOGIN_REQUIRED_TOAST_TITLE = "需要登录";
export const DEFAULT_LOGIN_REQUIRED_MESSAGE = "请先登录后再进行修改。";

export const useLoginRequiredToast = () => {
  const uiFeedback = useUiFeedbackStore();

  const notifyLoginRequired = (
    message = DEFAULT_LOGIN_REQUIRED_MESSAGE,
  ): false => {
    uiFeedback.notify({
      title: LOGIN_REQUIRED_TOAST_TITLE,
      message,
      tone: "warning",
    });
    return false;
  };

  return {
    notifyLoginRequired,
  };
};

export const useRequireLogin = () => {
  const auth = useAuthStore();
  const { notifyLoginRequired } = useLoginRequiredToast();

  const requireLogin = (message?: string) => {
    if (auth.isLogged) return true;
    return notifyLoginRequired(message);
  };

  return {
    requireLogin,
    notifyLoginRequired,
  };
};
