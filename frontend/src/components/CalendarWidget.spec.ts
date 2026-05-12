// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CalendarWidget from "./CalendarWidget.vue";

const { mockMarkDirty, mockSaveData, mockStoreWidget } = vi.hoisted(() => ({
  mockMarkDirty: vi.fn(),
  mockSaveData: vi.fn(),
  mockStoreWidget: {
    id: "calendar-1",
    type: "calendar",
    enable: true,
    isPublic: true,
    data: { style: "day" },
  },
}));

vi.mock("../stores/main", () => ({
  useMainStore: vi.fn(() => ({
    widgets: [mockStoreWidget],
    markDirty: mockMarkDirty,
    saveData: mockSaveData,
  })),
}));

describe("CalendarWidget", () => {
  beforeEach(() => {
    mockStoreWidget.data = { style: "day" };
    mockMarkDirty.mockClear();
    mockSaveData.mockReset();
    mockSaveData.mockResolvedValue(true);
  });

  it("persists style changes to the canonical store widget instead of the layout clone", async () => {
    const layoutWidget = {
      ...mockStoreWidget,
      data: { style: "day" },
    };

    const wrapper = mount(CalendarWidget, {
      props: {
        widget: layoutWidget,
      },
    });

    await wrapper.find('button[title="切换视图"]').trigger("click");

    expect(mockStoreWidget.data.style).toBe("month-lunar");
    expect(layoutWidget.data.style).toBe("day");
    expect(mockMarkDirty).toHaveBeenCalledTimes(1);
    expect(mockSaveData).toHaveBeenCalledTimes(1);
  });
});
