import { describe, expect, it } from "vitest";
import {
  buildItabCalendarDetail,
  buildItabCalendarMonthGrid,
  buildItabCalendarSnapshot,
  solarDayFromKey,
} from "./useItabCalendarRuntime";

describe("useItabCalendarRuntime", () => {
  it("derives the iTab calendar snapshot from tyme4ts", () => {
    const snapshot = buildItabCalendarSnapshot(new Date(2026, 4, 20, 12));

    expect(snapshot.monthTitle).toBe("2026年5月");
    expect(snapshot.today).toMatchObject({
      key: "2026-05-20",
      dayLabel: "20",
      weekName: "周三",
      lunarDayName: "初四",
      lunarMonthName: "四月",
    });
    expect(snapshot.todayDetail).toMatchObject({
      dateText: "2026-05-20 周三",
      lunarText: "四月初四",
      lunarFullText: "二〇二六年四月初四",
      ganzhiYearText: "丙午(马)年",
      dayOfYear: 140,
      weekOfYear: 21,
      zodiacText: "马",
      constellationText: "金牛座 ♉",
      festivalText: "网络情人节",
      phaseText: "蛾眉月",
      phenologyText: "王瓜生",
    });
  });

  it("builds a fixed 42-day month grid with holiday and solar-term labels", () => {
    const grid = buildItabCalendarMonthGrid(2026, 5, new Date(2026, 4, 20, 12));

    expect(grid).toHaveLength(42);
    expect(grid[0]).toMatchObject({
      key: "2026-04-27",
      isCurrentMonth: false,
    });
    expect(grid[41]).toMatchObject({
      key: "2026-06-07",
      isCurrentMonth: false,
    });
    expect(grid.find((day) => day.key === "2026-05-01")).toMatchObject({
      festivalName: "劳动节",
      legalHolidayType: "rest",
      lunarDisplayName: "劳动节",
    });
    expect(grid.find((day) => day.key === "2026-05-09")).toMatchObject({
      legalHolidayType: "work",
      lunarDisplayName: "廿三",
    });
    expect(grid.find((day) => day.key === "2026-05-21")).toMatchObject({
      solarTermName: "小满",
      lunarDisplayName: "小满",
    });
  });

  it("can switch the month grid to Sunday-first ordering", () => {
    const grid = buildItabCalendarMonthGrid(
      2026,
      5,
      new Date(2026, 4, 20, 12),
      "sunday",
    );

    expect(grid).toHaveLength(42);
    expect(grid[0]).toMatchObject({
      key: "2026-04-26",
      isCurrentMonth: false,
    });
    expect(grid[41]).toMatchObject({
      key: "2026-06-06",
      isCurrentMonth: false,
    });
  });

  it("builds detail rows for arbitrary selected dates", () => {
    const detail = buildItabCalendarDetail(solarDayFromKey("2026-05-21"));

    expect(detail).toMatchObject({
      key: "2026-05-21",
      dateText: "2026-05-21 周四",
      festivalText: "小满",
    });
    expect(detail.recommendText).toContain("开光");
    expect(detail.avoidText.length).toBeGreaterThan(0);
  });
});
