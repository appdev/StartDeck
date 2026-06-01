import type { SdDataKind } from "@/features/sd-widgets/sdWidgetRegistry";

export interface SdFixture {
  kind: SdDataKind;
  title: string;
  accent: string;
  hero: string;
  subline: string;
  meta: string;
  progress?: number;
  lines: string[];
  chips: string[];
  panelTitle?: string;
  panelDescription?: string;
}

const fixture = (
  kind: SdDataKind,
  title: string,
  accent: string,
): SdFixture => ({
  kind,
  title,
  accent,
  hero: "",
  subline: "",
  meta: "",
  lines: [],
  chips: [],
  progress: 0,
  panelTitle: title,
  panelDescription: "",
});

export const SD_WIDGET_FIXTURES: Record<SdDataKind, SdFixture> = {
  weather: fixture("weather", "天气", "#4f8df7"),
  calendar: fixture("calendar", "日历", "#ff6b6b"),
  memo: fixture("memo", "备忘录", "#f4b400"),
  movieCalendar: fixture("movieCalendar", "电影日历", "#4c4c3f"),
  poem: fixture("poem", "今日诗词", "#16a34a"),
  clock: fixture("clock", "时钟", "#06b6d4"),
  dailyEnglish: fixture("dailyEnglish", "今日英语", "#2563eb"),
  foodPicker: fixture("foodPicker", "今天吃什么", "#f97316"),
  wallpaper: fixture("wallpaper", "壁纸", "#14b8a6"),
  todo: fixture("todo", "待办事项", "#10b981"),
  pomodoro: fixture("pomodoro", "番茄时钟", "#dc2626"),
  numberUppercase: fixture("numberUppercase", "数字大写转换", "#334155"),
};

export const resolveSdFixture = (kind: SdDataKind) =>
  SD_WIDGET_FIXTURES[kind];
