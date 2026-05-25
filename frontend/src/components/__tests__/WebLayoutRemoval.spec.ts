import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settingsModalSource = readFileSync(
  "src/components/SettingsModal.vue",
  "utf8",
);
const gridPanelSource = readFileSync("src/components/GridPanel.vue", "utf8");
const mainCssSource = readFileSync("src/assets/main.css", "utf8");
const dockerWidgetSource = readFileSync(
  "src/components/DockerWidget.vue",
  "utf8",
);
const systemStatusWidgetSource = readFileSync(
  "src/components/SystemStatusWidget.vue",
  "utf8",
);

describe("web layout presentation removal", () => {
  it("removes the web presentation controls from Settings", () => {
    expect(settingsModalSource).not.toContain("Web 端展现方式");
    expect(settingsModalSource).not.toContain("WEB端布局");
    expect(settingsModalSource).not.toContain("webLayoutOptions");
    expect(settingsModalSource).not.toContain("一栏页");
    expect(settingsModalSource).not.toContain("按组分页");
    expect(settingsModalSource).not.toContain("禁止翻页");
    expect(settingsModalSource).not.toContain("webGroupPagination");
    expect(settingsModalSource).not.toContain("settingsModeLabel");
    expect(settingsModalSource).not.toContain("宽屏三栏");
    expect(settingsModalSource).not.toContain("紧凑两栏");
    expect(settingsModalSource).not.toContain("移动单栏");
    expect(settingsModalSource).not.toContain("桌面三栏");
    expect(settingsModalSource).not.toContain("settings-preview-card");
  });

  it("removes the open center entry from Settings", () => {
    expect(settingsModalSource).not.toContain("开放中心");
    expect(settingsModalSource).not.toContain("lucky-stun");
    expect(settingsModalSource).not.toContain("浏览器助手通信");
    expect(settingsModalSource).not.toContain("Webhook 设置");
    expect(settingsModalSource).not.toContain("ScriptManager");
  });

  it("removes Docker and system status widget management from Settings", () => {
    expect(settingsModalSource).not.toContain("Docker 管理");
    expect(settingsModalSource).not.toContain("DockerWidget");
    expect(settingsModalSource).not.toContain("SystemStatusWidget");
    expect(settingsModalSource).not.toContain("enableDockerWidget");
    expect(settingsModalSource).not.toContain("enableSystemStatusWidget");
    expect(settingsModalSource).not.toContain("toggleDockerSystemEnabled");
    expect(settingsModalSource).not.toContain("toggleSystemStatusMock");
  });

  it("moves Docker and system status widget settings into their own widgets", () => {
    for (const text of [
      "Docker 组件设置",
      "Docker 服务",
      "自动检测镜像升级",
      "内网主机",
    ]) {
      expect(dockerWidgetSource).toContain(text);
    }

    for (const text of [
      "系统信息组件设置",
      "显示系统信息组件",
      "公开显示",
      "移动端显示",
    ]) {
      expect(systemStatusWidgetSource).toContain(text);
    }
  });

  it("keeps the Settings header and sidebar copy height stable across tabs", () => {
    expect(mainCssSource).toContain(
      ".sd-settings-shell-surface > .sd-window-bar",
    );
    expect(mainCssSource).toContain("flex: 0 0 var(--sd-window-bar-height);");
    expect(settingsModalSource).toContain(".settings-shell-sidebar-copy");
    expect(settingsModalSource).toContain("height: 5rem;");
    expect(settingsModalSource).toContain("-webkit-line-clamp: 2;");
  });

  it("adds the theme mode entry without using daylight mode as a theme switch", () => {
    expect(settingsModalSource).toContain("themeModeOptions");
    expect(settingsModalSource).toContain('label="界面主题"');
    expect(settingsModalSource).toContain("store.appConfig.themeMode");
    expect(settingsModalSource).toContain("不再切换界面主题");
    expect(settingsModalSource).not.toContain(':scheme="isNightDaylightMode ?');
  });

  it("defines the new root theme attributes and semantic token layers", () => {
    for (const token of [
      "--sd-shell-surface",
      "--sd-component-surface",
      "--sd-state-info",
      "--sd-state-danger",
      '[data-sd-theme="light"]',
      '[data-sd-theme="dark"]',
      "#0f1115",
      "#4c9cff",
    ]) {
      expect(mainCssSource).toContain(token);
    }
  });

  it("splits the overloaded appearance layout Settings surface into focused tabs", () => {
    expect(settingsModalSource).not.toContain('title: "外观布局"');
    expect(settingsModalSource).not.toContain("activeTab === 'style'");

    for (const title of [
      "桌面外观",
      "壁纸背景",
      "顶部与搜索",
      "分组交互",
      "页脚统计",
    ]) {
      expect(settingsModalSource).toContain(`title: "${title}"`);
    }

    for (const tabId of [
      "appearance",
      "wallpaper",
      "topbar",
      "cards",
      "footer",
    ]) {
      expect(settingsModalSource).toContain(`"${tabId}"`);
      expect(settingsModalSource).toContain(`activeTab === '${tabId}'`);
    }

    expect(settingsModalSource).toContain(
      "const isPersonalizationTab = computed(() =>",
    );
    expect(settingsModalSource).toContain(
      "v-if=\"activeTab === 'topbar' || activeTab === 'cards'\"",
    );
  });

  it("keeps the search engine settings editor compact", () => {
    expect(settingsModalSource).toContain("settings-search-engine-summary");
    expect(settingsModalSource).toContain("settings-search-engine-table");
    expect(settingsModalSource).toContain("settings-search-engine-name-cell");
    expect(settingsModalSource).toContain("添加引擎");
    expect(settingsModalSource).not.toContain(
      "settings-search-engine-preview-card",
    );
    expect(settingsModalSource).not.toContain(
      "settings-search-engine-aside-grid",
    );
  });

  it("removes the one-page group pagination branch from the homepage", () => {
    expect(gridPanelSource).not.toContain("HomeGroupTabs");
    expect(gridPanelSource).not.toContain("home-group-tabs");
    expect(gridPanelSource).not.toContain("isWebPaginationMode");
    expect(gridPanelSource).not.toContain("webGroupPagination");
    expect(mainCssSource).not.toContain("sd-home-group-tabs");
    expect(mainCssSource).not.toContain("sd-home-group-tab");
  });
});
