import { prefetchSdIpLocation } from "./useSdIpRuntime";

const WIDGET_PREVIEW_PATH = "/widget-preview";

export const shouldPrefetchSdIpLocation = (pathname: string) =>
  pathname !== WIDGET_PREVIEW_PATH;

export const prefetchSdIpLocationOnBoot = (
  pathname = typeof window === "undefined"
    ? WIDGET_PREVIEW_PATH
    : window.location.pathname,
) => {
  if (!shouldPrefetchSdIpLocation(pathname)) return false;
  void prefetchSdIpLocation();
  return true;
};
