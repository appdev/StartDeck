export const blurActiveElementMatching = (selector: string): boolean => {
  if (typeof document === "undefined") return false;

  const activeElement = document.activeElement;
  if (!activeElement || typeof activeElement.matches !== "function") {
    return false;
  }
  if (!activeElement.matches(selector)) return false;

  const focusableElement = activeElement as HTMLElement;
  if (typeof focusableElement.blur !== "function") return false;
  focusableElement.blur();
  return true;
};
