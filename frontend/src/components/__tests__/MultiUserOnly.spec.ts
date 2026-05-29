import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loginModalSource = readFileSync("src/components/LoginModal.vue", "utf8");
const settingsModalSource = readFileSync(
  "src/components/SettingsModal.vue",
  "utf8",
);
const authStoreSource = readFileSync("src/stores/auth.ts", "utf8");
const cacheStoreSource = readFileSync("src/stores/cache.ts", "utf8");
const syncStoreSource = readFileSync("src/stores/sync.ts", "utf8");

describe("multi-user only UI contract", () => {
  it("keeps login as username plus password without self registration", () => {
    expect(loginModalSource).toContain("<span>用户登录</span>");
    expect(loginModalSource).toContain('placeholder="用户名"');
    expect(loginModalSource).toContain('placeholder="密码"');
    expect(loginModalSource).not.toContain("没有账号？去注册");
    expect(loginModalSource).not.toContain("新用户注册");
    expect(authStoreSource).not.toContain("/api/register");
  });

  it("removes auth mode controls from Settings", () => {
    expect(settingsModalSource).not.toContain("系统模式");
    expect(settingsModalSource).not.toContain("切换为");
    expect(settingsModalSource).not.toContain("单用户模式");
    expect(settingsModalSource).not.toContain("多用户模式");
    expect(settingsModalSource).not.toContain("认证模式");
    expect(settingsModalSource).not.toContain("showMultiUserWarning");
    expect(settingsModalSource).not.toContain("toggleAuthMode");
  });

  it("keeps user management admin-only and cache scope username-based", () => {
    expect(settingsModalSource).toContain(
      'store.isLogged && store.username === "admin"',
    );
    expect(settingsModalSource).toContain('title="用户管理"');
    expect(settingsModalSource).not.toContain("注册限制");
    const removedModeField = "auth" + "Mode";
    expect(cacheStoreSource).not.toContain(`systemConfig.${removedModeField}`);
    expect(syncStoreSource).not.toContain(`systemConfig.${removedModeField}`);
  });
});
