import { expect, test } from "@playwright/test";
import { gunzipSync } from "node:zlib";

test("delayed polls and save acknowledgements preserve the latest memo edit", async ({
  page,
}) => {
  const memo = {
    id: "memo",
    type: "sd-memo-04",
    enable: true,
    isPublic: true,
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    colSpan: 2,
    rowSpan: 2,
    data: {
      runtime: "sd-memo",
      layoutSystem: "sd-grid/2026-05-22",
      version: 1,
      sizeKey: "2x2",
      activeNoteId: "note",
      notes: [
        {
          id: "note",
          title: "Test",
          body: "ABCD",
          pinned: false,
          createdAt: "2026-09-27T00:00:00Z",
          updatedAt: "2026-09-27T00:00:00Z",
        },
      ],
    },
  };
  let snapshot = {
    username: "memo-test",
    authenticated: true,
    sessionGeneration: "memo-test-session",
    version: 1,
    appConfig: {},
    groups: [],
    widgets: [memo],
  };
  const pendingSaves: Array<{ payload: typeof snapshot; finish: () => void }> =
    [];
  let finishPoll: (() => void) | undefined;
  let pollCompleted = false;
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
      const payload = JSON.parse(
        gunzipSync(route.request().postDataBuffer()!).toString(),
      );
      if (pendingSaves.length < 2) {
        await new Promise<void>((resolve) =>
          pendingSaves.push({ payload, finish: resolve }),
        );
      }
      snapshot = {
        ...snapshot,
        appConfig: payload.appConfig,
        widgets: payload.widgets,
        version: snapshot.version + 1,
      };
      body = { success: true, version: snapshot.version, data: snapshot };
    } else if (path === "/api/widgets/memo") {
      const data = JSON.parse(
        JSON.stringify(snapshot.widgets.find((w) => w.id === "memo")!.data),
      );
      if (!pollCompleted) {
        await new Promise<void>((resolve) => {
          finishPoll = resolve;
        });
        pollCompleted = true;
      }
      body = { success: true, data };
    } else if (path === "/api/version") {
      body = { version: snapshot.version };
    } else if (
      path === "/api/backgrounds" ||
      path === "/api/mobile_backgrounds"
    ) {
      body = [];
    }
    await route.fulfill({ json: body });
  });

  await page.goto("/");
  await expect.poll(() => Boolean(finishPoll)).toBe(true);
  await page
    .locator('[data-widget-grid-item="memo"] [data-runtime-widget]')
    .click();
  const panel = page.locator("[data-sd-memo-opened-panel]");
  const editor = panel.locator("textarea");
  await expect(editor).toHaveValue("ABCD");

  // Start a save containing ABCD, then keep editing before it is acknowledged.
  await panel
    .locator('input[placeholder="请输入笔记标题"]')
    .fill("Edited title");
  await expect.poll(() => pendingSaves.length).toBe(1);
  await editor.fill("CVBD");
  const pollResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/widgets/memo",
  );
  finishPoll!();
  await pollResponse;
  await expect(editor).toHaveValue("CVBD");

  pendingSaves[0]!.finish();
  await expect.poll(() => pendingSaves.length).toBe(2);
  await expect(editor).toHaveValue("CVBD");
  expect(
    pendingSaves[1]!.payload.widgets.find((w) => w.id === "memo")!.data
      .notes[0]!.body,
  ).toBe("CVBD");
  const lastSaveResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/save",
  );
  pendingSaves[1]!.finish();
  await lastSaveResponse;
  await expect(editor).toHaveValue("CVBD");

  await page.reload();
  await page
    .locator('[data-widget-grid-item="memo"] [data-runtime-widget]')
    .click();
  await expect(panel.locator("textarea")).toHaveValue("CVBD");

  // Clean state still accepts changes made remotely after the save.
  snapshot.widgets.find((w) => w.id === "memo")!.data.notes[0]!.body = "REMOTE";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(panel.locator("textarea")).toHaveValue("REMOTE");
});
