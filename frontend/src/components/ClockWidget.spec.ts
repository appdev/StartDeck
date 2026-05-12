// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ClockWidget from "./ClockWidget.vue";

const { mockMarkDirty, mockSaveData, mockStoreWidget } = vi.hoisted(() => ({
  mockMarkDirty: vi.fn(),
  mockSaveData: vi.fn(),
  mockStoreWidget: {
    id: "clock-1",
    type: "clock",
    enable: true,
    isPublic: true,
    data: { style: "digital" },
  },
}));

vi.mock("../stores/main", () => ({
  useMainStore: vi.fn(() => ({
    widgets: [mockStoreWidget],
    markDirty: mockMarkDirty,
    saveData: mockSaveData,
  })),
}));

describe("ClockWidget", () => {
  beforeEach(() => {
    mockStoreWidget.data = { style: "digital" };
    mockMarkDirty.mockClear();
    mockSaveData.mockReset();
    mockSaveData.mockResolvedValue(true);
  });

  it("persists style changes to the canonical store widget instead of the layout clone", async () => {
    const layoutWidget = {
      ...mockStoreWidget,
      data: { style: "digital" },
    };

    const wrapper = mount(ClockWidget, {
      props: {
        widget: layoutWidget,
      },
    });

    await wrapper.find('button[title="切换风格"]').trigger("click");

    expect(mockStoreWidget.data.style).toBe("analog");
    expect(layoutWidget.data.style).toBe("digital");
    expect(mockMarkDirty).toHaveBeenCalledTimes(1);
    expect(mockSaveData).toHaveBeenCalledTimes(1);
  });
});
