import { expect, test } from "@playwright/test";
import { gunzipSync } from "node:zlib";

test("wallpaper settings update the rendered background and survive reload", async ({
  page,
}) => {
  let snapshot = {
    username: "wallpaper-test",
    authenticated: true,
    sessionGeneration: "wallpaper-test-session",
    version: 1,
    groups: [],
    appConfig: {
      background: "/default-wallpaper.svg",
      backgroundBlur: 1,
      backgroundMask: 0.7,
      daylightModeEnabled: false,
      enableMobileWallpaper: false,
    },
    widgets: [
      {
        id: "wallpaper-test",
        type: "sd-wallpaper-16",
        enable: true,
        isPublic: true,
        x: 0,
        y: 0,
        w: 2,
        h: 2,
        colSpan: 2,
        rowSpan: 2,
        data: {
          runtime: "sd-wallpaper",
          layoutSystem: "sd-grid/2026-05-22",
          version: 1,
          sizeKey: "2x2",
          sd: {
            namespace: "sd",
            captureIndex: 16,
            catalogId: "sd-wallpaper-16",
            localStateKey: "sd.wallpaper.16",
            adapterKind: "wallpaper",
            state: { dailyAutoUpdate: true, blurLevel: 0, dimWallpaper: false },
          },
        },
      },
    ],
  };
  let saves = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = { success: true };
    if (path === "/api/session") {
      body = {
        success: true,
        authenticated: true,
        username: snapshot.username,
        sessionGeneration: snapshot.sessionGeneration,
      };
    } else if (path === "/api/data") {
      body = snapshot;
    } else if (path === "/api/save") {
      const raw = route.request().postDataBuffer()!;
      const payload = JSON.parse(gunzipSync(raw).toString());
      snapshot = {
        ...snapshot,
        appConfig: payload.appConfig,
        widgets: payload.widgets,
        version: snapshot.version + 1,
      };
      saves++;
      body = { success: true, version: snapshot.version };
    } else if (path === "/api/version") {
      body = { version: snapshot.version };
    } else if (path === "/api/bing-wallpapers") {
      body = {
        success: true,
        data: {
          entries: [
            {
              id: "test-image",
              title: "Test wallpaper",
              location: "",
              credit: "Test",
              thumbnailUrl: "/default-wallpaper.svg",
              downloadUrl: "/default-wallpaper.svg",
            },
          ],
          totalPages: 1,
          currentPage: 1,
          pageSize: 24,
          sourceStatus: "ok",
        },
      };
    } else if (
      path === "/api/backgrounds" ||
      path === "/api/mobile_backgrounds"
    ) {
      body = [];
    }
    await route.fulfill({ json: body });
  });
  await page.goto("/");
  const background = page
    .locator(".bg-cover")
    .filter({ visible: true })
    .first();
  await expect(background).toHaveCSS("filter", "blur(1px)");
  const openSettings = async () => {
    await page
      .locator('[data-widget-grid-item="wallpaper-test"] [data-runtime-widget]')
      .click();
    await page.locator("[data-sd-wallpaper-settings-trigger]").click();
  };
  await openSettings();
  const panel = page.locator("[data-sd-wallpaper-opened-panel]");
  await expect(panel.locator('input[type="range"]')).toHaveValue("1");
  await expect(panel.getByLabel("桌面背景增加暗色遮罩")).toBeChecked();
  await panel.getByLabel("自动更新").uncheck();
  await expect.poll(() => saves).toBe(1);
  expect(snapshot.widgets[0]!.data.sd.state.dailyAutoUpdate).toBe(false);

  await panel.locator('input[type="range"]').fill("0");
  await panel.locator('input[type="range"]').dispatchEvent("change");
  await expect.poll(() => snapshot.appConfig.backgroundBlur).toBe(0);
  await expect(background).toHaveCSS("filter", "blur(0px)");
  expect(snapshot.appConfig.backgroundMask).toBe(0.7);
  await panel.getByLabel("桌面背景增加暗色遮罩").uncheck();
  await expect.poll(() => snapshot.appConfig.backgroundMask).toBe(0);

  await page.reload();
  await expect(background).toHaveCSS("filter", "blur(0px)");
  await openSettings();
  await expect(panel.getByLabel("自动更新")).not.toBeChecked();
  await expect(panel.getByLabel("桌面背景增加暗色遮罩")).not.toBeChecked();
  await expect(panel.locator('input[type="range"]')).toHaveValue("0");
});
