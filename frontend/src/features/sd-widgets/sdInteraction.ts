export interface SdOpenGuardOptions {
  isEditMode?: boolean;
  isDragging?: boolean;
  isResizing?: boolean;
}

const excludedSelector = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "label",
  "[contenteditable=true]",
  "[role='button']",
  "[data-grid-drag-ignore]",
  ".widget-resize-grip",
  ".widget-move-handle",
  ".widget-size-strip",
  "[data-sd-inner-control]",
  "[data-context-menu]",
  "[data-grid-context-menu]",
  "[role='dialog']",
  ".sd-modal-surface",
  ".sd-context-menu-surface",
].join(",");

export const shouldOpenSdPanel = (
  event: MouseEvent,
  options: SdOpenGuardOptions = {},
) => {
  if (options.isEditMode || options.isDragging || options.isResizing)
    return false;
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return false;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return true;
  if (target === event.currentTarget) return true;
  const excluded = target.closest(excludedSelector);
  return !excluded || excluded === event.currentTarget;
};
