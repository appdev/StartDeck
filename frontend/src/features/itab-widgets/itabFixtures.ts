import type { ItabDataKind } from "@/features/itab-widgets/itabWidgetRegistry";

export interface ItabFixture {
  kind: ItabDataKind;
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
  kind: ItabDataKind,
  title: string,
  accent: string,
  hero: string,
  subline: string,
  meta: string,
  lines: string[],
  chips: string[],
  progress = 0.62,
): ItabFixture => ({
  kind,
  title,
  accent,
  hero,
  subline,
  meta,
  lines,
  chips,
  progress,
  panelTitle: `${title} 工具`,
  panelDescription:
    "Fixture-first StartDeck 本地数据，不使用 iTab 私有接口或账号数据。",
});

export const ITAB_WIDGET_FIXTURES: Record<ItabDataKind, ItabFixture> = {
  weather: fixture(
    "weather",
    "天气",
    "#4f8df7",
    "龙华 25°",
    "小雨 · AQI 优/35",
    "最高30° 最低24°",
    ["体感 27°", "湿度 82%", "东北风 2级", "30 分钟前"],
    ["预报", "空气", "刷新"],
    0.35,
  ),
  calendar: fixture(
    "calendar",
    "日历",
    "#ff6b6b",
    "20",
    "2026年5月 · 周三",
    "第140天 · 第21周",
    ["四月初四", "小满", "本周还剩 4 天", "今日无日程"],
    ["月", "周", "今"],
    0.57,
  ),
  memo: fixture(
    "memo",
    "备忘录",
    "#f4b400",
    "iTab 操作小技巧",
    "点击打开编辑",
    "本地保存",
    ["组件可拖拽调整大小", "右键可打开设置", "支持快捷记录"],
    ["编辑", "同步", "清空"],
    0.48,
  ),
  movieCalendar: fixture(
    "movieCalendar",
    "电影日历",
    "#4c4c3f",
    "20 五月",
    "豆瓣 7.2",
    "世上很多事情本无对错",
    [
      "影",
      "剧情/动作/武侠2018中国大陆 中国香港",
      "导演：张艺谋",
      "沛国都督子虞，从小被秘密囚禁，替身境州走入权力漩涡。",
    ],
    ["查看电影源->"],
    0.72,
  ),
  poem: fixture(
    "poem",
    "今日诗词",
    "#16a34a",
    "垂杨紫陌洛城东",
    "总是当时携手处",
    "欧阳修 · 浪淘沙",
    ["游遍芳丛", "全文展开", "每日精选"],
    ["全文", "注释", "收藏"],
    0.6,
  ),
  clock: fixture(
    "clock",
    "时钟",
    "#06b6d4",
    "23:40",
    "05-20 周三",
    "Asia/Shanghai",
    ["秒针运行中", "24 小时制", "本地时间"],
    ["样式", "时区", "秒"],
    0.98,
  ),
  dailyEnglish: fixture(
    "dailyEnglish",
    "今日英语",
    "#2563eb",
    "Light stretches longer",
    "光把疼痛拉得更长",
    "跟读 0/3",
    ["pain /pein/", "播放音频", "今日打卡"],
    ["播放", "跟读", "收藏"],
    0.33,
  ),
  foodPicker: fixture(
    "foodPicker",
    "今天吃什么",
    "#f97316",
    "开始",
    "今天吃什么",
    "8 个候选",
    ["牛肉面", "寿司", "麻辣烫", "沙拉"],
    ["开始", "菜单", "重置"],
    0.44,
  ),
  wallpaper: fixture(
    "wallpaper",
    "壁纸",
    "#14b8a6",
    "熊蜂在授粉",
    "StartDeck 壁纸库",
    "本地/公共来源",
    ["自然", "收藏 12", "适配桌面"],
    ["应用", "收藏", "分类"],
    0.8,
  ),
  todo: fixture(
    "todo",
    "待办事项",
    "#10b981",
    "2 项",
    "啊哒哒 · wqewqeq",
    "今日待办",
    ["评审实现", "补充测试", "已完成 1 项"],
    ["添加", "完成", "列表"],
    0.4,
  ),
  pomodoro: fixture(
    "pomodoro",
    "番茄时钟",
    "#dc2626",
    "00:00",
    "专注 25 分钟",
    "今日 0 轮",
    ["短休息 5 分钟", "暂停状态", "本地计时"],
    ["开始", "暂停", "设置"],
    0,
  ),
  numberUppercase: fixture(
    "numberUppercase",
    "数字大写转换",
    "#334155",
    "壹佰贰拾叁",
    "123.00",
    "人民币大写",
    ["支持小数", "复制结果", "格式切换"],
    ["转换", "复制", "清空"],
    0.36,
  ),
};

export const resolveItabFixture = (kind: ItabDataKind) =>
  ITAB_WIDGET_FIXTURES[kind];
