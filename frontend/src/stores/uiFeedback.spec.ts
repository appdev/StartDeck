import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useUiFeedbackStore } from "./uiFeedback";

describe("uiFeedback store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  it("adds and dismisses toast notifications", () => {
    const store = useUiFeedbackStore();

    const id = store.notify({
      title: "Done",
      message: "Saved",
      tone: "success",
      durationMs: 1000,
    });

    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0]?.id).toBe(id);

    vi.advanceTimersByTime(1000);

    expect(store.toasts).toHaveLength(0);
  });

  it("opens and resolves alert dialogs", async () => {
    const store = useUiFeedbackStore();

    const pending = store.alert({
      title: "Info",
      message: "Hello",
    });

    expect(store.alertDialog.show).toBe(true);
    expect(store.alertDialog.title).toBe("Info");

    store.closeAlert();
    await expect(pending).resolves.toBeUndefined();
    expect(store.alertDialog.show).toBe(false);
  });

  it("opens and resolves confirm dialogs", async () => {
    const store = useUiFeedbackStore();

    const pending = store.confirm({
      title: "Confirm",
      message: "Continue?",
      tone: "danger",
    });

    expect(store.confirmDialog.show).toBe(true);
    expect(store.confirmDialog.tone).toBe("danger");

    store.resolveConfirm(true);
    await expect(pending).resolves.toBe(true);
    expect(store.confirmDialog.show).toBe(false);
  });
});
