const RUNTIME_OPEN_IGNORE_SELECTORS = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "label",
  '[role="button"]',
  '[role="switch"]',
  "[contenteditable]",
  '[contenteditable="true"]',
  "[data-grid-drag-ignore]",
  "[data-runtime-open-ignore]",
  "[data-sd-inner-control]",
  "[data-runtime-action]",
  "[data-docker-action]",
  "[data-system-status-action]",
  '[role="dialog"]',
  ".sd-modal-surface",
  ".sd-context-menu-surface",
  "[data-context-menu]",
  "[data-grid-context-menu]",
  "[data-runtime-context-menu]",
].join(",");

export const isRuntimeOpenKey = (event: KeyboardEvent) =>
  event.key === "Enter" || event.key === " ";

export const shouldIgnoreRuntimeOpenEvent = (
  event: Event,
  root?: HTMLElement | null,
) => {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  const ignored = target.closest(RUNTIME_OPEN_IGNORE_SELECTORS);
  if (!ignored) return false;
  if (root && ignored === root) return false;
  if (root && !root.contains(ignored)) return false;
  return true;
};
