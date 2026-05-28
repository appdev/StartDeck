import { prefetchItabIpLocation } from "./useItabIpRuntime";

const WIDGET_PREVIEW_PATH = "/widget-preview";

export const shouldPrefetchItabIpLocation = (pathname: string) =>
  pathname !== WIDGET_PREVIEW_PATH;

export const prefetchItabIpLocationOnBoot = (
  pathname = typeof window === "undefined"
    ? WIDGET_PREVIEW_PATH
    : window.location.pathname,
) => {
  if (!shouldPrefetchItabIpLocation(pathname)) return false;
  void prefetchItabIpLocation();
  return true;
};
