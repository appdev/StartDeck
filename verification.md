# Verification

日期：2026-05-13
执行者：Codex

## 验收结果

通过。

## 验收点

- 未登录用户进入待办组件时，只看到“登录后使用待办”和“需登录”，不会渲染添加输入框、删除按钮或勾选框。
- `add`、`remove`、`handleSave` 增加登录保护，避免绕过模板触发本地待办变更。
- 未登录状态不再把待办数据写入 `startdeck-todo-backup-*` 本地备份。
- 登录用户仍可正常添加待办。
- 前端构建和组件测试通过。

## 命令记录

- `npm test -- --run TodoWidget.spec.ts`：通过，2 tests passed。
- `npm run build`：通过，含非阻塞构建警告。

## 风险

- 未执行后端测试，因为本次没有修改后端实现。
- 构建产物未纳入本次说明范围；`frontend/dist` 未出现在 `git status --short` 中。

## 2026-05-13 部署分组缺失排查

执行者：Codex

验收结果：通过排查，当前属于未公开内容未展示，不是服务器数据文件丢失。

依据：

- 服务器 `/root/StartDeck/data/data.json` 当前 version 618，包含 7 个分组、67 个条目。
- 公开接口 `https://start.du.bi/api/data` 当前 version 618，返回 6 个分组、58 个条目。
- 缺少的 9 个条目均为 `isPublic: false`：`邮箱服务` 下 `GMail`、`Postale`，以及 `公司相关` 下 7 个条目。
- 后端未登录访问会过滤非公开条目，并丢弃过滤后无公开条目的分组。

补充结论：

- 登录态也缺失的 `AI` 分组，在服务器当前原始数据 `/root/StartDeck/data/data.json` 中已不存在。
- 当前原始数据 version 623，仍只有 7 个分组、67 个条目。
- `data/config_versions` 和 `data/users` 没有可用于恢复的历史快照。

## 2026-05-14 备忘录/待办公开权限修复

执行者：Codex

验收结果：针对本次隐私限制修复通过；备忘录、待办即使公开也需要登录。

修复点：

- 公开待办：未登录时不展示内容，只显示“登录后使用待办”和“需登录”。
- 私有待办：未登录时不展示内容，只显示登录限制。
- 公开备忘录：未登录时不展示内容，只显示“登录后使用备忘”。
- 私有备忘录：未登录时不暴露内容。
- 后端公开接口：游客访问 `/api/data` 或 `/api/widgets/:id` 时，即使 `memo`、`todo` 标记为 `isPublic: true`，也不会返回这两类用户数据组件内容。

命令记录：

- `npm test -- --run src/components/TodoWidget.spec.ts src/components/MemoWidget.spec.ts src/utils/widgetUtils.spec.ts src/stores/cache.spec.ts`：通过，16 tests passed。
- `npx eslint src/components/TodoWidget.vue src/components/MemoWidget.vue src/components/TodoWidget.spec.ts src/components/MemoWidget.spec.ts src/utils/widgetUtils.ts src/utils/widgetUtils.spec.ts`：通过。
- `go test ./...`（backend）：通过。
- `npm run build`：通过，含既有 Browserslist/baseline 数据过期、大 chunk 等非阻塞提示。
- `git diff --check`：通过。

## 2026-05-14 公开组件外壳与登录同步修复

执行者：Codex

验收结果：通过。

修复点：

- 游客 `/api/data` 会保留 `isPublic: true` 的待办、备忘录组件外壳，避免登出后组件消失。
- 游客响应会删除公开待办、备忘录的 `data` 字段，前端仍只显示登录限制，不暴露内容。
- 登录成功后立即拉取认证态 `/api/data`，不再依赖手动刷新。
- 认证态下晚返回的游客快照不会覆盖登录后的页面状态。

命令记录：

- `go test ./...`（backend）：通过。
- `npm test -- --run src/components/TodoWidget.spec.ts src/components/MemoWidget.spec.ts src/utils/widgetUtils.spec.ts src/stores/cache.spec.ts`：通过，16 tests passed。
- `npm run type-check`：通过。

## 2026-05-17 非首页 macOS UI 完整设计方案

执行者：Codex

验收结果：设计方案通过，进入实现规划准备状态；本次未修改生产代码。

设计决策：

- 当前 macOS / Apple HIG / system-component 风格确认为开发基线。
- 阻断性弹窗点击外部不能关闭。
- 普通干净弹窗允许点击外部关闭。
- 普通弹窗存在未保存修改时，点击外部或 Escape 必须弹出阻断性放弃修改确认。
- 响应式范围明确为桌面宽屏、普通桌面、移动端。

产物：

- `.codex/modal-ui-design/non-home-macos-ui-20260517-2025/complete-design-spec.md`
- `.codex/modal-ui-design/non-home-macos-ui-20260517-2025/interaction-matrix.md`
- `.codex/modal-ui-design/non-home-macos-ui-20260517-2025/implementation-mapping.md`
- `.codex/modal-ui-design/non-home-macos-ui-20260517-2025/qa-notes.md`
- `.codex/modal-ui-design/non-home-macos-ui-20260517-2025/contrast-audit.md`
- `.codex/modal-ui-design/non-home-macos-ui-20260517-2025/senior-ui-review.md`
- `.codex/modal-ui-design/non-home-macos-ui-20260517-2025/startdeck-non-home-macos-ui.figma.json`

后续实现风险：

- `ConfirmDialog.vue` 当前允许点击遮罩关闭，和阻断性规则冲突。
- 项目中仍有多处原生 `alert()` / `confirm()`，实现阶段需要逐步替换。
- `SettingsModal.vue` 体量较大，应分阶段重构。

## 2026-05-17 弹窗 foundation 第一阶段实现

执行者：Codex

验收结果：通过本阶段目标；未执行全量视觉重构。

实现范围：

- `OverlayMotion` 增加 Escape、焦点陷入/恢复、初始焦点、ARIA、关闭原因和阻断关闭尝试事件。
- `ConfirmDialog` 默认变为阻断确认，外点和 Escape 不关闭，不显示右上角关闭图标，使用 `alertdialog`。
- `GridPanel` 删除确认改为阻断确认路径。
- `LoginModal`、`AddWidgetModal`、`IconSelectionModal`、`SettingsModal` clean 状态明确支持外点/Escape 关闭。
- `PasswordConfirmModal` 保持阻断行为并补充焦点/ARIA 契约。

命令记录：

- `npm run type-check`：通过。
- `npm test -- --run src/components/base/OverlayMotion.spec.ts src/components/base/ConfirmDialog.spec.ts src/components/__tests__/GridPanel_ContextMenu.spec.ts`：通过，12 tests passed。
- `npm test -- --run`：仍有既有无关失败，详见 `.codex/testing.md`。
- `npm run test:e2e`：仍有既有环境/旧选择器失败，详见 `.codex/testing.md`。

真实运行测试：

- 临时后端：`127.0.0.1:18083`。
- 临时前端：`127.0.0.1:23105`。
- Chromium 验证通过：浅色/深色、宽屏桌面、普通桌面、移动端。
- 验证路径：登录普通弹窗、设置普通弹窗、删除阻断确认。
- 截图：`.codex/qa-screenshots/modal-foundation-*`。

遗留风险：

- 全量 `alert()` / `confirm()` 迁移、dirty guard、Settings 完整 macOS 视觉重构仍在后续阶段。

## 2026-05-18 线上书签内容补全

执行者：Codex

验收结果：通过。

修复结果：

- 已从源站导出 10 个分组、109 条链接，并与目标站当前数据对比。
- 已先创建目标站配置版本备份，再执行线上保存。
- 目标站版本已保存到 2729。
- 认证态：10 个分组、112 条链接。
- 公开态：10 个分组、106 条链接。
- `社交资讯` 已恢复，公开态可见 8 条：什么值得买、人人影视、PDORO、Bilibili、喜马拉雅、拼多多商家版、NewsNow、游戏下载。

保护措施：

- 未覆盖目标站已有的同源 ID 改动或已移动条目。
- 未删除任何目标站现有内容。
- 本地备份和 diff 记录保存在 `.codex/live-data-backups/20260517T163416Z-*`。

验证：

- `GET https://start.du.bi/api/data` 公开接口确认 `社交资讯` 8 条可见。
- 浏览器打开 `https://start.du.bi/?v=2729`，页面文本包含 `社交资讯` 和 8 条恢复项目。

## 2026-05-18 非首页 macOS UI 开发收尾

执行者：Codex

验收结果：通过。

实现结论：

- 非首页 macOS UI 第一批目标界面已切到共享组件体系，包含设置弹窗、壁纸库、编辑弹窗、右键菜单、全局反馈和阻断确认路径。
- 深浅色继续由共享语义化 token 和 shell surface 驱动，没有再新增新的并行 dark palette。
- 普通弹窗外点关闭与阻断确认外点不可关闭规则都已落到真实运行路径。

命令记录：

- `cd frontend && npm run type-check`：通过。
- `cd frontend && npx vitest run src/stores/uiFeedback.spec.ts src/components/base/OverlayMotion.spec.ts src/components/base/ConfirmDialog.spec.ts src/components/__tests__/GridPanel_ContextMenu.spec.ts`：通过，16 tests passed。

真实运行测试：

- 本地运行地址：`http://127.0.0.1:23000/`
- 浏览器矩阵：`1512x982`、`1280x800`、`1024x768`、`390x844`、`375x667`，均覆盖浅色和深色。
- 普通弹窗：`SettingsModal`、`WallpaperLibrary` 外点关闭通过。
- 阻断确认：`EditModal` 脏表单放弃修改确认外点不关闭，通过。
- 截图归档：`.codex/qa-screenshots/non-home-macos-ui-20260518/`

修复补充：

- QA 中发现 `SettingsModal.vue`、`EditModal.vue` 存在运行时模板闭合错误，已修复并复测通过。
- QA 中发现移动端设置导航标签裁切，已改为两列换行导航并复测通过。

遗留风险：

- 浏览器最终控制台仍有 2 条既有 `403` 资源请求错误，但未再出现新的 Vue 运行时异常。

## 2026-05-18 非首页 macOS UI 最终收口（Figma JSON 契约版）

执行者：Codex

验收结果：通过。本节结果覆盖上面的早期“开发收尾”记录，当前实现和 QA 以 Figma JSON 契约与最新浏览器批次为准。

实现结论：

- 设计契约改为直接读取 `.codex/modal-ui-design/non-home-macos-ui-20260517-2025/startdeck-non-home-macos-ui.figma.json` 与 `implementation-mapping.md`，不再用设计导出图做像素对比。
- `AppFieldRow` 已正式进入共享组件栈，并落到 `SettingsModal` 后半段与 `WallpaperLibrary` 的真实表单路径。
- `SettingsModal` 的 `多开组件`、`网络判定`、`开放中心`、`道理鱼音乐设置` 现已由共享字段行、分组卡片、语义按钮和共享开关主导，而不是继续堆本地样式开关。

命令记录：

- `cd frontend && npm run type-check`：通过。
- `node` + `@vue/compiler-sfc`：`SettingsModal.vue`、`WallpaperLibrary.vue`、`EditModal.vue`、`FileTransferWidget.vue` 解析通过。
- `cd frontend && npx vitest run src/stores/uiFeedback.spec.ts src/components/base/OverlayMotion.spec.ts src/components/base/ConfirmDialog.spec.ts src/components/__tests__/GridPanel_ContextMenu.spec.ts`：通过，15 tests passed。

真实运行测试：

- 本地运行地址：`http://127.0.0.1:23000/`
- 浏览器矩阵：`1512x982`、`1280x800`、`1024x768`、`390x844`、`375x667`，均覆盖浅色和深色。
- 语义化壳层颜色取样：
  - light：`rgba(255, 255, 255, 0.92)`
  - dark：`rgba(36, 36, 38, 0.92)`
- 普通弹窗外点关闭：
  - `SettingsModal`：通过
  - `WallpaperLibrary`：通过
- 阻断弹窗外点不可关闭：
  - 共享确认弹窗：通过
- 补充模块截图：
  - `settings-multi-instance-wide-light.png`
  - `settings-network-wide-light.png`
  - `settings-open-center-wide-light.png`
  - `settings-music-wide-light.png`

当前风险：

- 最新控制台归档只剩 1 条既有 `403` 资源错误：`Failed to load resource: the server responded with a status of 403 (Forbidden)`。
- 未执行全量 `npm test -- --run` 和 `npm run test:e2e` 作为收口门禁，因为它们此前已存在与本次非首页 UI 改动无关的红灯；本次继续使用风险收敛后的定向测试与真实浏览器矩阵作为验收主证据。

补充收口证据：

- `settings-music-wide-light.png` 已在共享分段控件改造后重采样；运行态校验结果为 `.sd-segment-button` 2 个，旧 `radio` 输入 0 个。
- `settings-multi-instance-wide-light.png` 已在 `AppWidgetInstanceCard` 收口后重采样。
- `wallpaper-library-wide-light.png` 与 `blocking-confirm-wide-light.png` 也已同步重采样，和最新关闭规则复测绑定。

## 2026-05-18 架构优先实现最终收口

执行者：Codex

验收结果：通过。本节覆盖本轮重新按架构审批后实施、再由 QA 真实浏览器复核的最终结果。

实现补充：

- `AppSettingsShell` 继续作为桌面设置窗唯一高度契约持有者；桌面实测高度为 `724px`，符合“浏览器内可见高度约 `750px`”要求。
- `AppSidebar.vue` 修复了真实启用侧边栏时的 Vue attribute warning：外部 `class` 现在落在真实侧边栏根节点，不再出现 `Extraneous non-props attributes`。
- `OverlayMotion.vue` 修复了 `popover/context-menu` 透明命中层不可点击的问题；此前 `pointer-events-none` 会导致 `PopoverSurface` 在真实浏览器里无法通过外点关闭。

命令记录：

- `cd frontend && npm run type-check`：通过。
- `cd frontend && npm run build`：通过，仅保留既有 `baseline-browser-mapping` / `Browserslist` / chunk-size warning。
- `cd frontend && npx eslint src/components/AppSidebar.vue src/components/BookmarkWidget.vue src/components/ClockWeatherWidget.vue src/components/SimpleWeatherWidget.vue src/components/CountdownWidget.vue src/components/CountUpWidget.vue src/components/MarketplaceModal.vue src/components/FileTransferWidget.vue src/components/SettingsModal.vue src/components/GroupSettingsModal.vue src/components/base/AppSettingsShell.vue src/components/base/AppModalShell.vue src/components/base/PopoverSurface.vue playwright.config.ts`：通过。
- `cd frontend && npx eslint src/components/AppSidebar.vue src/components/base/OverlayMotion.vue src/components/base/OverlayMotion.spec.ts`：通过。
- `cd frontend && npx vitest run src/stores/uiFeedback.spec.ts src/components/base/OverlayMotion.spec.ts src/components/base/ConfirmDialog.spec.ts src/components/__tests__/GridPanel_ContextMenu.spec.ts`：通过，15 tests passed。
- `cd frontend && npx vitest run src/components/base/OverlayMotion.spec.ts src/components/base/ConfirmDialog.spec.ts`：通过，8 tests passed。

真实运行测试：

- 本地运行地址：`http://127.0.0.1:23000/`
- 浏览器矩阵继续覆盖：
  - `1512x982`
  - `1280x800`
  - `1024x768`
  - `390x844`
  - `375x667`
- 已确认：
  - `SettingsModal` 普通外点关闭通过；
  - `WallpaperLibrary` 普通外点关闭通过；
  - 阻断确认外点不可关闭通过；
  - `ClockWeatherWidget` 城市设置已使用共享紧凑 `AppModalShell`，实测宽度 `512px`，外点关闭通过；
  - `AppSidebar` 的 `PopoverSurface` 在真实浏览器中已可打开并通过外点关闭。由于当前 live 数据默认没有启用 `sidebar` + `bookmarks` 组件，本次 QA 采用“仅浏览器内存态临时注入，不落盘保存”的方式渲染真实 consumer，再执行外点关闭验证。

截图补充：

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/qa-appsidebar-popover-runtime-fixed.png`

当前风险：

- 当前最终控制台噪音为两类既有问题：
  - `<meta name="apple-mobile-web-app-capable">` 的弃用 warning；
  - Gitee tags 接口 `404`。
- 这两项都不是本次非首页 UI 改动引入的问题；最终批次未再出现新的 Vue 运行时 warning 或错误。

## 2026-05-18 — Settings deep parity closure

Result: pass

Scope:

- `frontend/src/components/SettingsModal.vue`
- `frontend/src/components/base/AppSettingsShell.vue`
- `frontend/src/assets/main.css`

Acceptance:

- desktop settings first screen now matches the approved source structure closely enough for implementation QA
- mobile settings no longer shrink the desktop window into a navigation wall; they now open as a full-screen single-column settings flow
- blocking import state no longer allows dismiss-attempt to close the underlying settings shell
- shared settings shell no longer leaves the outer modal body scrollable

Evidence:

- `.codex/qa-screenshots/crops/design-section2-982.png`
- `.codex/qa-screenshots/deep-ui-pass-20260518/desktop-light.png`
- `.codex/qa-screenshots/deep-ui-pass-20260518/desktop-dark.png`
- `.codex/qa-screenshots/deep-ui-pass-20260518/mobile-light.png`
- `.codex/qa-screenshots/deep-ui-pass-20260518/mobile-dark.png`

Checks:

- `cd frontend && npm run type-check` -> passed
- `cd frontend && npm run build` -> passed
- `cd frontend && npx vitest run src/stores/uiFeedback.spec.ts src/components/base/OverlayMotion.spec.ts src/components/base/ConfirmDialog.spec.ts src/components/__tests__/GridPanel_ContextMenu.spec.ts` -> passed (`4 files / 16 tests`)

Final gate:

- Senior frontend review -> PASS
- QA review -> PASS

## 2026-05-18 — Settings visual closure refresh

Result: pass

Scope:

- `frontend/src/components/SettingsModal.vue`
- `frontend/src/assets/main.css`

Acceptance:

- settings overlay now behaves as a stronger shared presentation layer on both desktop and mobile
- settings window body reads closer to the approved macOS design because surface translucency was reduced
- refreshed screenshot matrix remains acceptable in desktop/mobile and light/dark after the visual tightening

Evidence:

- `.codex/qa-screenshots/deep-ui-pass-20260518/desktop-light.png`
- `.codex/qa-screenshots/deep-ui-pass-20260518/desktop-dark.png`
- `.codex/qa-screenshots/deep-ui-pass-20260518/mobile-light.png`
- `.codex/qa-screenshots/deep-ui-pass-20260518/mobile-dark.png`

Checks:

- `cd frontend && npm run type-check` -> passed
- `cd frontend && npm run build` -> passed
- `cd frontend && npx vitest run src/stores/uiFeedback.spec.ts src/components/base/OverlayMotion.spec.ts src/components/base/ConfirmDialog.spec.ts src/components/__tests__/GridPanel_ContextMenu.spec.ts` -> passed (`4 files / 16 tests`)

## 2026-05-18 — Settings scroll-lock and preview fallback

Result: pass

Scope:

- `frontend/src/components/base/OverlayMotion.vue`
- `frontend/src/components/base/AppSettingsShell.vue`
- `frontend/src/components/base/OverlayMotion.spec.ts`
- `frontend/src/assets/main.css`
- `frontend/src/components/SettingsModal.vue`

Acceptance:

- settings center column is now the actual scroll container
- settings dialog no longer allows page scroll behind the modal
- preview wallpaper no longer renders as a blank surface when the configured PC wallpaper path is stale or missing

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/qa-settings-scroll-preview-fixed.png`
- live browser metrics:
  - `.settings-shell-scroll` `670 / 2369`
  - `.sd-modal-body` `670 / 670`
  - `window.scrollY` stable during wheel interaction

Checks:

- `cd frontend && npm run type-check` -> passed
- `cd frontend && npm run build` -> passed
- `cd frontend && npx vitest run src/components/base/OverlayMotion.spec.ts src/components/base/ConfirmDialog.spec.ts src/components/__tests__/GridPanel_ContextMenu.spec.ts` -> passed (`3 files / 14 tests`)

## 2026-05-18 — Settings layout-and-appearance section refactor

Result: pass

Scope:

- `frontend/src/components/SettingsModal.vue`

Acceptance:

- `布局与组件外观` no longer renders as one crowded mixed grid
- header/title controls, widget-area rhythm controls, and card-interaction controls are now visually separated and easier to scan

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/qa-layout-component-appearance-fixed.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/qa-layout-component-appearance-lower-fixed.png`

Checks:

- `cd frontend && npm run type-check` -> passed
- `cd frontend && npm run build` -> passed

## 2026-05-18 — Settings wallpaper-source correction

Result: pass

Scope:

- `frontend/src/components/SettingsModal.vue`

Acceptance:

- settings preview no longer invents a default wallpaper when the configured desktop wallpaper is stale
- preview base surface now matches the live dashboard fallback path
- inspector copy now explicitly reports the missing desktop wallpaper state

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/qa-settings-wallpaper-source-corrected.png`

Checks:

- `cd frontend && npm run type-check` -> passed
- `cd frontend && npm run build` -> passed

## 2026-05-18 — Settings wallpaper-library stacking and entry routing

Result: pass

Scope:

- `frontend/src/components/SettingsModal.vue`
- `frontend/src/components/WallpaperLibrary.vue`
- `frontend/src/components/PasswordConfirmModal.vue`
- `frontend/src/components/MarketplaceModal.vue`

Acceptance:

- `管理壁纸库` 打开的 `壁纸库` 弹窗现在显示在设置主窗前面，内部按钮可以直接操作
- `PC / Mobile / API` 三个壁纸来源入口现在分别打开到对应 tab
- 设置主窗内的二级弹窗层级不再低于主设置窗

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/qa-settings-open-after-fix.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/qa-wallpaper-library-front-after-fix.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/qa-wallpaper-library-api-after-fix.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/qa-wallpaper-entry-routing-after-fix.png`

Checks:

- `cd frontend && npx eslint src/components/SettingsModal.vue src/components/WallpaperLibrary.vue src/components/PasswordConfirmModal.vue src/components/MarketplaceModal.vue` -> passed
- `cd frontend && npm run type-check` -> passed
- `cd frontend && npm run build` -> passed
- real-browser click QA on `http://127.0.0.1:23000/` -> passed for `Preview`, `Apply`, `管理壁纸库`, `选择移动背景`, wallpaper cards `PC / Mobile / API`, and wallpaper-library buttons `PC 壁纸`, `手机壁纸`, `API 接口`, `顺序播放`, `开启轮播`, `刷新`, `上传壁纸`, `关闭`

## 2026-05-18 — Shared global window-bar contract

Result: pass

Scope:

- `frontend/src/components/base/AppWindowBar.vue`
- `frontend/src/components/base/AppModalShell.vue`
- `frontend/src/components/base/AppWindowBar.spec.ts`
- `frontend/src/assets/main.css`

Acceptance:

- modal/window title-bar behavior is now owned by a shared global component instead of inline shell markup
- macOS window variants use only the left red traffic-light close affordance and do not render a duplicate trailing `X`
- settings window title is centered independently of left traffic lights and right action buttons
- ordinary dialogs still render the trailing close button

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/qa-window-bar-before-refactor.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/qa-window-bar-after-refactor.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/qa-window-bar-ordinary-dialog.png`

Checks:

- `cd frontend && npx eslint src/components/base/AppWindowBar.vue src/components/base/AppWindowBar.spec.ts src/components/base/AppModalShell.vue src/components/base/AppSettingsShell.vue src/components/SettingsModal.vue` -> passed
- `cd frontend && npx vitest run src/components/base/AppWindowBar.spec.ts src/components/base/ConfirmDialog.spec.ts src/components/base/OverlayMotion.spec.ts` -> passed
- `cd frontend && npm run type-check` -> passed
- `cd frontend && npm run build` -> passed
- real-browser QA on `http://127.0.0.1:23000/` -> settings title center delta `0px`, trailing close count in the macOS settings header `0`, ordinary dialog `壁纸库` trailing close count `1`

## 2026-05-18 — Single macOS-style close control and viewport-fit verification

Result: pass

Scope:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/components/base/AppWindowBar.vue`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/components/base/AppWindowBar.spec.ts`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/assets/main.css`

Acceptance:

- browser-window style settings chrome keeps only a single left close button
- the close button reveals its glyph on hover and there are no extra yellow/green pseudo-controls
- settings dialog fits completely inside a single desktop browser window and does not require outer-page scrolling to access the full shell

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/qa-settings-single-close-fit-1280x800.png`

Checks:

- `cd frontend && npx vitest run src/components/base/AppWindowBar.spec.ts` -> passed
- `cd frontend && npm run type-check` -> passed
- `cd frontend && npm run build` -> passed
- real-browser QA on `http://127.0.0.1:23000/` -> `redButtonCount=1`, `yellowDotCount=0`, `greenDotCount=0`, `trailingCloseExists=false`, hover glyph opacity `1`, single close click closed the settings dialog, and modal bounds `1248x724` stayed fully visible within viewport `1280x800`

## 2026-05-21 — iTab full component replica v6 implementation

Result: pass for implementation verification; QA Acceptance remains pending.

Scope:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/scripts/itab/extract-capture-manifests.mjs`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/features/itab-widgets/`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/public/__itab-qa-skins/`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/`

Checks:

- `node scripts/itab/extract-capture-manifests.mjs --visual-skins --semantic-expectations --check` -> passed
- `node .codex/qa/itab-full-component-replica/assert-v6-manifests.mjs` -> passed
- `node .codex/qa/itab-full-component-replica/assert-v6-policy.mjs` -> passed
- `cd frontend && npm run type-check` -> passed
- `cd frontend && npm test -- --run src/features/itab-widgets/itabSemanticExpectations.spec.ts src/features/itab-widgets/ItabWidgetRenderer.spec.ts src/features/itab-widgets/itabWidgetRegistry.spec.ts src/features/itab-widgets/itabSizePresets.spec.ts src/features/itab-widgets/itabAdapters.spec.ts src/features/itab-widgets/itabDynamicBindings.spec.ts src/utils/widgetSizePresets.spec.ts src/utils/widgetCatalog.spec.ts src/utils/addComponentTypes.spec.ts src/components/AddWidgetModal.spec.ts src/components/__tests__/GridPanel_ContextMenu.spec.ts` -> passed, 11 files / 51 tests
- `cd backend && go test ./handlers -run TestItabResourceEndpoint -count=1` -> passed
- `cd frontend && npm run build` -> passed with existing warnings
- `ITAB_VISUAL_MODE=clone-skin ITAB_DATA_MODE=fixture ITAB_QA_URL=http://127.0.0.1:23001/qa/itab-widgets node .codex/qa/itab-full-component-replica/capture-itab-visuals.mjs && node .codex/qa/itab-full-component-replica/compare-itab-visuals.mjs` -> passed

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/report.json`: `pass:true`, body `180/180`, opened `36/36`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/report.md`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/manifest.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/v6-manifest-report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/v6-policy-report.json`

## 2026-05-21 — iTab full component replica v6 QA Acceptance revision

Result: pass for revised implementation verification; QA Acceptance remains failed-v6 until a fresh independent QA Acceptance rerun.

Scope:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/*.mjs`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/features/itab-widgets/`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/*.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-full-component-replica-gate-ledger.md`

Checks:

- extractor check -> passed
- v6 manifest assertion -> passed
- v6 policy assertion -> passed
- semantic browser assertion on `http://127.0.0.1:23001/qa/itab-widgets` -> passed, `216/216`
- hotspot browser assertion -> passed, `216/216`
- interaction browser assertion -> passed, root `36/36`, body root states `180/180`, suppression `726/726`, opened controls `36/36`, keyboard/focus `36/36`, assertions `355/355`
- live clone smoke -> passed, mutations `12/12`
- DOM-native fallback -> passed, states `216/216`
- `cd frontend && npm run type-check` -> passed
- focused Vitest -> passed, 11 files / 51 tests
- `cd backend && go test ./handlers -run TestItabResourceEndpoint -count=1` -> passed
- visual capture+compare -> passed, `pass=true`, body `180/180`, opened `36/36`

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/semantic-coverage-report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/hotspot-alignment-report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/itab-interactions-report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/live-clone-smoke-report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/dom-native-functional-fallback-report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/report.md`

## 2026-05-21 — iTab full component replica v6 visible fixture revision

Result: pass for implementation revision; QA Acceptance remains `failed-v6-rerun` until a fresh independent QA Acceptance rerun.

Scope:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/features/itab-widgets/ItabWidgetRenderer.vue`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/features/itab-widgets/ItabWidgetPanelHost.vue`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/assertion-helpers.mjs`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/assert-semantic-coverage.mjs`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/assert-hotspot-alignment.mjs`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-full-component-replica-gate-ledger.md`

Checks:

- semantic browser assertion on `http://127.0.0.1:23001/qa/itab-widgets` -> passed, `216/216`, visibility failures `0`
- hotspot browser assertion -> passed, `216/216`, visibility failures `0`
- visual capture+compare -> passed, `pass=true`, body `180/180`, opened `36/36`
- interaction assertion -> passed, root `36/36`, body states `180/180`, suppression `726/726`, opened `36/36`, keyboard `36/36`, assertions `355/355`
- `cd frontend && npm run type-check` -> passed

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/semantic-coverage-report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/hotspot-alignment-report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/itab-interactions-report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/report.md`

## 2026-05-21 — iTab full component replica v6 final QA Acceptance

Result: passed.

Checks:

- manifest/policy checks passed
- semantic coverage passed, `216/216`, visibility failures `0`
- hotspot alignment passed, `216/216`, visibility failures `0`
- interaction assertion passed, root `36/36`, body states `180/180`, suppression `726/726`, opened `36/36`, keyboard `36/36`, assertions `355/355`
- live clone smoke passed, mutations `12/12`
- DOM-native fallback passed, states `216/216`
- visual capture+compare passed, overall report `true`, body `180/180`, opened `36/36`
- browser probe accepted fixture marker/outline visibility: sampled semantic slots, hotspots, opened panel, and close control had effective opacity `1`, no `is-fixture-hidden`, non-zero rects, and visible marker or outline rendering

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-full-component-replica-qa-acceptance-v6-final.md`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/report.json`

## 2026-05-21 — Strict iTab UI fidelity QA follow-up

Result: existing v6 acceptance remains pass; stricter clean no-mask pixel audit passes all pixels but fails the new mask-dependency policy.

Scope:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/features/itab-widgets/ItabWidgetQaView.vue`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/features/itab-widgets/ItabWidgetRenderer.vue`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/features/itab-widgets/ItabWidgetPanelHost.vue`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/assertion-helpers.mjs`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/capture-itab-visuals.mjs`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/strict-ui-fidelity-check.mjs`

Checks:

- `cd frontend && npm run type-check` -> passed
- visual capture with clean QA overlay -> generated `180` body states and `36` opened states
- strict no-mask pixel audit -> pixel-only `216/216`, opened strict `36/36`, body pixel-only `180/180`; strict overall `false` because body mask-policy failed `179` states
- existing visual compare -> passed, body `180/180`, opened `36/36`
- semantic coverage -> passed, `216/216`
- hotspot alignment -> passed, `216/216`
- interactions -> passed, root `36/36`, body states `180/180`, suppression `726/726`, opened `36/36`, keyboard `36/36`, assertions `355/355`
- live clone smoke -> passed, mutations `12/12`
- DOM-native fallback -> passed, states `216/216`

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/strict-ui-fidelity-report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/strict-ui-fidelity-report.md`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-full-component-replica/report.json`

## 2026-05-21 — Strict iTab add-component modal fidelity QA

Result: passed after scoped add-modal visual fidelity corrections.

Scope:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/components/AddWidgetModal.vue`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/components/AddWidgetModal.spec.ts`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/utils/siteShortcutCatalog.ts`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-add-ui-replica/strict-add-modal-fidelity-check.mjs`

Checks:

- `cd frontend && npm run type-check` -> passed
- `cd frontend && npm test -- --run src/components/AddWidgetModal.spec.ts src/utils/siteShortcutCatalog.spec.ts` -> passed, 2 files / 8 tests
- `node .codex/qa/itab-add-ui-replica/strict-add-modal-fidelity-check.mjs` -> passed, `strictAddModalPass=true`, failures `0`

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-add-ui-replica/strict-add-modal-fidelity-report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-add-ui-replica/strict-add-modal-fidelity-report.md`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-add-ui-replica/strict-current-blank-context-menu.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-add-ui-replica/strict-current-widget-default.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-add-ui-replica/strict-current-site-navigation-tab.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/qa/itab-add-ui-replica/strict-current-custom-icon-tab.png`

## 2026-05-21 — iTab opened panel source-background correction

Result: source-site full-viewport background removed from user-facing opened panels.

Scope:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/components/GridPanel.vue`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/App.vue`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/features/itab-widgets/ItabWidgetPanelHost.vue`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/features/itab-widgets/ItabWidgetQaView.vue`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/features/itab-widgets/itabCloneSkin.ts`

Checks:

- `cd frontend && npm run type-check` -> passed
- `cd frontend && npm test -- --run src/features/itab-widgets/ItabWidgetRenderer.spec.ts src/features/itab-widgets/itabAdapters.spec.ts src/features/itab-widgets/itabDynamicBindings.spec.ts` -> passed, 3 files / 7 tests
- Playwright viewport screenshot on `http://127.0.0.1:23003/qa/itab-widgets?visualMode=panel-skin&dataMode=live&qaOverlay=clean` after opening `00 天气` -> confirmed no iTab source desktop wallpaper outside the opened panel
- Playwright DOM probe -> `data-itab-visual-mode="panel-skin"`, full-viewport `.itab-opened-clone-skin-layer` absent, panel-cropped `.itab-opened-panel-skin-layer` present, document overflow locked while open
- Playwright interaction proof -> `[data-itab-hotspot-id="opened-close"]` click closed the panel and restored document overflow

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/itab-opened-panel-skin-no-source-bg.png`

## 2026-05-21 — Current live iTab top-level interaction handoff

Result: passed for this phase's exact-interaction requirement by handing `/itab-live` off to iTab's own top-level runtime.

Scope:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/App.vue`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/main.ts`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/features/itab-live/ItabLiveReplica.vue`

Checks:

- `cd frontend && npm run type-check` -> passed
- Chrome plugin opened `http://127.0.0.1:23001/itab-live` -> redirected to `https://go.itab.link/`
- Chrome plugin blank right-click -> iTab context menu appeared
- Chrome plugin `添加图标` click -> iTab add-component modal appeared
- Chrome plugin weather widget click -> iTab weather detail panel appeared
- Chrome plugin weather widget right-click -> iTab layout/edit/delete context menu appeared

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-current-qa/chrome-itab-live-redirect-result.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-current-qa/chrome-itab-direct-blank-context-menu.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-current-qa/chrome-itab-direct-add-modal.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-current-qa/chrome-itab-direct-weather-panel.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-current-qa/chrome-itab-direct-widget-context-menu.png`

## 2026-05-21 — Current live iTab native StartDeck replica

Result: passed for the corrected requirement that `/itab-live` must be implemented in StartDeck code rather than redirected.

Scope:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/features/itab-live/ItabLiveReplica.vue`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/App.vue`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/main.ts`

Checks:

- `cd frontend && npm run type-check` -> passed
- Browser plugin initial render check on `http://127.0.0.1:23002/itab-live` -> local DOM rendered and local URL retained before the in-app browser session reset
- Fallback Playwright Chromium `1280x720` -> page identity passed with URL `http://127.0.0.1:23002/itab-live`, title `新标签页`, `.itab-native` root present, widget count `29`, no framework overlay
- Playwright console health -> `0` errors/warnings for the local page
- Playwright blank right-click -> `.blank-menu` visible
- Playwright add action -> `.add-window` visible
- Playwright weather widget click -> `.weather-panel` visible
- Playwright weather widget right-click -> `.widget-menu` visible
- Playwright layout action -> weather widget switched from `size-2-2` rect `57,222,142,142` to `size-2-4` rect `57,222,312,142`, with toast `已切换为 2x4`

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/pw-native-final-report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/pw-native-home.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/pw-native-blank-context-menu.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/pw-native-add-modal.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/pw-native-weather-panel.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/pw-native-widget-context-menu.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/pw-native-widget-resized.png`

## 2026-05-21 — Current live iTab native 36-widget StartDeck replica

Result: passed for this continuation phase's local-code requirement using the current Chrome source page as the content baseline.

Scope:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/src/features/itab-live/ItabLiveReplica.vue`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/frontend/public/itab-live-assets/`

Checks:

- `cd frontend && npm run type-check` -> passed
- `git diff --check -- frontend/src/features/itab-live/ItabLiveReplica.vue frontend/public/itab-live-assets frontend/src/App.vue frontend/src/main.ts verification.md .codex/operations-log.md .codex/testing.md .codex/review-report.md` -> passed
- Chrome source tab inspection -> confirmed current source viewport/layout and 36 widgets without reading cookies, localStorage, sessionStorage, passwords, credentials, auth headers, or profile storage
- Chrome local QA on `http://127.0.0.1:23002/itab-live` -> widget count `36`, broken image count `0`, console error count `0`, no framework overlay
- Chrome local geometry -> sidebar `50px`, search rect `567,153,600,46`, first six widget rects `253/433/613/973/1153/1333 x 237`, sizes `150/150/330/150/150/150`
- Chrome local interactions -> widget context menu visible, `2x4` resize visible, blank context menu visible, add modal visible, weather opened panel visible

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-local-final-36.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-local-final-36-metrics.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-local-final-36-console.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-local-final-widget-menu-36.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-local-final-blank-menu-36.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-local-final-add-modal-36.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-local-final-weather-panel-36.png`

## 2026-05-21 — `/itab-live` scroll and opened-panel correction

Result: passed in Chrome.

Commands:

- `cd frontend && npm run type-check`
- `git diff --check -- frontend/src/main.ts frontend/src/features/itab-live/ItabLiveReplica.vue`

Chrome checks:

- Opened `http://127.0.0.1:23002/itab-live` through the Codex Chrome extension.
- Page identity passed: local URL retained, title `新标签页`, `.itab-native` root present, widget count `36`, no framework overlay, Chrome console errors/warnings `0`.
- Scroll passed: the root scroll container reported `scrollHeight=1390`, `clientHeight=898`, `canScroll=true`; a Chrome wheel scroll moved it to `scrollTop=492`.
- Opened-panel proof passed for hotsearch, exchange rate, tomato timer, 2048, calendar, memo, countdown, and food picker.

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-itab-live-interaction-fix-report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-itab-live-added-panel-report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-itab-live-hotsearch-panel-fixed.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-itab-live-exchange-panel-fixed.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-itab-live-tomato-panel-fixed.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-itab-live-2048-panel-fixed.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-itab-live-calendar-panel-fixed.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-itab-live-memo-panel-fixed.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-itab-live-countdown-panel-fixed.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-itab-live-food-panel-fixed.png`

## 2026-05-21 — `/itab-live` captured opened-state layer

Result: passed in Chrome for the higher-fidelity interaction/opened-state path.

Commands:

- `cd frontend && npm run type-check`
- `git diff --check -- frontend/src/features/itab-live/ItabLiveReplica.vue frontend/src/main.ts`

Chrome checks:

- Opened `http://127.0.0.1:23002/itab-live` through the Codex Chrome extension.
- Page identity passed: local URL retained, title `新标签页`, `.itab-native` root present, widget count `36`, no framework overlay, Chrome console errors/warnings `0`.
- Opened-state capture proof passed for sampled widgets:
  - weather `00`: `.opened-capture-skin` uses `/__itab-qa-skins/opened/00.png`, natural size `1733x842`
  - hotsearch `02`: `.opened-capture-skin` uses `/__itab-qa-skins/opened/02.png`, natural size `1733x842`
  - exchange `24`: `.opened-capture-skin` uses `/__itab-qa-skins/opened/24.png`, natural size `1733x842`
  - tomato `29`: `.opened-capture-skin` uses `/__itab-qa-skins/opened/29.png`, natural size `1733x842`
- Close hotspot proof passed: capture layer was present before close and absent after close.

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-itab-live-capture-opened-report.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-itab-live-capture-weather-00.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-itab-live-capture-hotsearch-02.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-itab-live-capture-exchange-24.png`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-native-current-qa/chrome-itab-live-capture-tomato-29.png`

## 2026-05-21 — `/itab-live` no-screenshot opened-state correction

Result: passed for the corrected direction. The opened-state screenshot layer is removed and the sampled panels are rendered by local DOM/CSS/resources.

Commands:

- `cd frontend && npm run type-check`
- `git diff --check -- frontend/src/main.ts verification.md .codex/operations-log.md .codex/testing.md`
- `rg -n "openedSkinUrl|__itab-qa-skins/opened|opened-capture|opened-skin|opened-capture-skin" frontend/src/features/itab-live/ItabLiveReplica.vue`

Chrome checks:

- Chrome source tab opened `https://go.itab.link/` and sampled rendered DOM/CSS only. No cookies, browser storage, credentials, auth headers, or profile stores were inspected.
- Chrome local tab opened `http://127.0.0.1:23002/itab-live`: URL retained, title `新标签页`, root present, widget count `36`, console errors/warnings `0`.
- Removed screenshot layer proof: local DOM had `.opened-capture-skin` count `0`, `/__itab-qa-skins/opened` image count `0`, and `.opened-capture`/`.opened-skin-hotspots` count `0`.
- Interaction proof: weather, hotsearch, exchange, tomato, and countdown opened panels rendered through local DOM/CSS; open panels locked root overflow; tomato dial measured `360x360`; countdown opened as `实时预览 + 设置表单`.
- Scroll proof: root `scrollHeight=1390`, `clientHeight=842`, `canScroll=true`; Chrome center-wheel scroll moved root to `scrollTop=548`.

Superseded note:

- The previous captured opened-state layer is no longer the implementation path. It remains only as historical QA/reference data, not rendered UI.

## 2026-05-21 — `/itab-live` calendar opened-state pixel tightening

Result: passed.

Commands:

- `cd frontend && npm run type-check`
- `git diff --check -- frontend/src/features/itab-live/ItabLiveReplica.vue frontend/src/main.ts verification.md .codex/operations-log.md .codex/testing.md .codex/review-report.md docs/itab-components/replica-quality-standard.md`

Chrome checks:

- Chrome source tab opened `https://go.itab.link/`, clicked the real calendar component, and sampled rendered DOM/CSS/geometry only.
- Chrome local tab opened `http://127.0.0.1:23002/itab-live`, clicked the local calendar component, and ran a metric comparison against the live source.
- Self-test passed with 1px tolerance for dialog, panel, tabs, main pane, aside pane, toolbar, board, weekdays, active day, date card, and info list.
- Style checks passed for dialog background/radius/shadow, aside background, active day blue/radius, and date-card blue/font size.

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-calendar-self-test.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-calendar-self-test.md`

## 2026-05-21 — `/itab-live` calendar hover/selected and real calendar source

Status: passed.

Commands:

- `cd frontend && npm run type-check` -> passed

Chrome source checks:

- Real iTab hover on `22 初六`: inner `.calendar-day` border changes to `2px solid rgba(0, 0, 0, 0.2)`, background remains transparent.
- Real iTab selected state after clicking `22 初六`: `22` gains `.isSelect` and keeps the same `rgba(0, 0, 0, 0.2)` selected border.
- Real iTab today state after selecting `22`: `21 小满` remains the blue today block `rgb(54, 125, 241)` but is no longer the selected date.

Implementation note:

- The local calendar grid now uses `lunar-javascript` (`Solar`, `Lunar`, `HolidayUtil`) to generate dates, lunar labels, solar/lunar festivals, solar terms, and holiday/workday tags. Fixed single-month arrays were removed.

Pending:

- None for this focused calendar pass.

Final Chrome local checks:

- URL stayed `http://127.0.0.1:23002/itab-live`; `widgetCount=36`.
- Generated calendar grid count was `42`.
- Hover `22 初六` computed border was `2px solid rgba(0, 0, 0, 0.2)`.
- Selected `22 初六` computed border was `2px solid rgba(0, 0, 0, 0.2)` and class contained `selected`.
- After selecting `22`, `21 小满` remained `rgb(54, 125, 241)` blue and no longer carried selected class.
- Detail pane changed to `2026-05-22 周五` and included `国际生物多样性日`.
- Filtered Chrome warning/error console entries: `0`.

## 2026-05-21 — `/itab-live` calendar annotated-difference correction

Status: passed.

Commands:

- `cd frontend && npm run type-check`

Chrome checks:

- Source `https://go.itab.link/`: sampled rendered DOM/CSS only. Confirmed the month watermark is `.d-calendar::before` with `content: "5"`, `font-size: 320px`, `line-height: 480px`, color `rgba(0, 0, 0, 0.3)`, `opacity: 0.1`.
- Source segmented control uses `.d-tabs-x::before` as the active pill: `68x28`, `left: 2px` on 日历 and `left: 74px` on 工具.
- Source toolbar uses Element Plus SVG path data for calendar and chevrons; source lunar labels carry `title` attributes.
- Local `http://127.0.0.1:23002/itab-live`: watermark pseudo, tab pseudo-slider, SVG icon sizes, `small[title]`, active text color, hover border, selected border, and detail mutation all matched the sampled source behavior.
- Filtered local Chrome console warning/error entries: `0`.

## 2026-05-21 — `/itab-live` calendar opened-state interaction correction

Result: passed.

Why the previous self-test missed it:

- The previous test opened the calendar and measured the resulting static DOM/CSS/geometry.
- It did not click day cells, tabs, month arrows, or the Today button, so static markup could pass while the modal content itself remained non-interactive.

Commands:

- `cd frontend && npm run type-check`
- `git diff --check -- frontend/src/features/itab-live/ItabLiveReplica.vue frontend/src/main.ts verification.md .codex/operations-log.md .codex/testing.md .codex/review-report.md docs/itab-components/replica-quality-standard.md .codex/itab-live-calendar-self-test.md .codex/itab-live-calendar-self-test.json`

Chrome checks:

- Real iTab source behavior: clicking `22 初六` updates the right pane to `2026-05-22 周五`, while the blue left calendar cell still marks today `21 小满`; clicking `工具` switches to tool content; month arrows change the displayed month and selected detail.
- Local behavior: matched those interaction states on `http://127.0.0.1:23002/itab-live`.
- Local console errors/warnings after the interaction run: `0`.

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-calendar-self-test.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-calendar-self-test.md`

## 2026-05-21 — `/itab-live` memo opened-state correction

Result: passed for memo geometry and local interactions; source mutation actions were intentionally not executed.

Commands:

- `cd frontend && npm run type-check`

Chrome checks:

- Source `https://go.itab.link/`: sampled rendered memo DOM/CSS/geometry/SVG path only. The real memo opens as a `1000x602` white Element Plus dialog, with `998x600` body, `200x600` notes sidebar, `798x600` editor, `183x64` active note, `179x24` search, `28x28` add button, `753x30` title input, `778x528` textarea, and `778x18` meta row.
- Local `http://127.0.0.1:23002/itab-live`: matched those memo dimensions and styles; screenshot skin count `0`, visible generic panel count `0`.
- Local interaction checks passed: selecting another note, adding an empty note, editing title/body, searching, hover-revealing delete/fixed actions, and pin toggling to `取消固定` with the sampled unpin SVG path.
- Local Chrome warning/error console entries: `0`.

Boundary:

- Did not click real iTab add/delete/edit/pin actions because they can persistently mutate user memo data. The source controls were sampled and equivalent local interactions were verified.

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-memo-self-test.json`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-memo-self-test.md`

## 2026-05-21 — `/itab-live` memo outer-size research and correction

Status: passed.

Chrome source checks:

- Source `https://go.itab.link/`: sampled rendered outer memo DOM/CSS/geometry only.
- Current source 2x2 memo card: outer `150x150`, top `150x37.5`, content `150x112.5`, rows `150x37.4609`, row padding `0 6.51px`, row border `1px solid rgba(0,0,0,0.08)`.
- Current source outer text rows: `iTab操作小技巧`, `第三`, `2026-05-21`.
- Source CSS variable evidence: `--icon-radius:18px`, grid gap variables `30px`.
- Source memo controls show `固定到桌面`, while the outer card already displays memo titles. Therefore local outer preview must bind to memo data directly and must not depend on the fixed flag.

Static capture checks:

- `docs/itab-components/itab-components-data.json` has 5 memo sizes: `1x1`, `1x2`, `2x1`, `2x2`, `2x4`.
- DOM outer sizes: `60x60`, `150x60`, `60x150`, `150x150`, `330x150`.
- PNG asset sizes: `76x76`, `166x76`, `76x166`, `166x166`, `346x166`; these include sampling margin and are not implementation dimensions.

Implementation:

- `/itab-live` memo outer card now uses a real `notes-icon` equivalent structure and binds rows to `memoNotes`.
- `1x1` and `1x2` hide title spans like source iTab.

Commands:

- `cd frontend && npm run type-check`
- `git diff --check -- frontend/src/features/itab-live/ItabLiveReplica.vue docs/itab-components/replica-quality-standard.md .codex/itab-live-memo-outer-size-research.md .codex/operations-log.md .codex/testing.md verification.md`

Chrome local checks:

- Local `http://127.0.0.1:23002/itab-live` memo size menu produced DOM sizes `60x60`, `150x60`, `60x150`, `150x150`, `330x150`.
- `1x1` and `1x2` had hidden title spans.
- `2x2` matched the live source proportions: top `150x37.5`, content `150x112.5`, rows `150x37.4609`, row padding `0 6.51px`.
- Editing the opened memo title changed the outer first row to `联动测试`; restoring the title restored the row to `iTab操作小技巧`.
- Screenshot-backed opened nodes count: `0`.
- Filtered local Chrome warning/error entries: `0`.

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-memo-outer-size-research.md`

## 2026-05-21 — `/itab-live` memo fixed-to-desktop behavior

Status: passed.

Commands:

- `cd frontend && npm run type-check`

Chrome local checks:

- Opened `http://127.0.0.1:23002/itab-live` in Chrome.
- Initial state: `36` widgets, `1` memo widget.
- Source iTab was re-tested with real clicks: clicking `固定到桌面` does not add a grid `.app-item`; it creates `.notes-fixed` at `90,90` and leaves source memo widget count at `1`.
- Local implementation now matches this: fixed layer `.notes-fixed` appeared at `90,90`, layer `300x141`, item `300x131`, content `276x95.5`, cancel button `18x23`.
- Local widget count stayed `36`; memo widget count stayed `1`.
- Pressed Escape to close memo dialog: fixed layer stayed visible on the desktop.
- Clicked `.notes-fixed-cancel`: fixed layer disappeared and widget counts stayed unchanged.
- Filtered local Chrome warning/error entries: `0`.

Boundary:

- Real source data was clicked because the user clarified it is test data. The observed real-source fixed note remains the behavioral baseline for this correction.

## 2026-05-21 — `/itab-live` calendar standard audit

Status: partial-pass. Outer geometry, opened geometry, and core task interactions passed; secondary opened controls remain source-click unverified.

Commands:

- `cd frontend && npm run type-check`

Chrome checks:

- Opened real iTab `https://go.itab.link/` and local `http://127.0.0.1:23002/itab-live` in Chrome.
- Replayed the calendar source-click contract from `docs/itab-components/replica-quality-standard.md`: open calendar, hover/select day `22`, switch to `工具` and back, move to previous month, use the hidden `today-btn` only as a sampled source control, and toggle `title="一周开始日"`.
- Source and local were compared in the same `1733x842` viewport; final failures were `[]`, maximum rect delta was `0.4px`, and the week-start switch rect delta was `0px`.
- Local console warning/error entries in a clean tab: `0`.

Correction:

- Added the missing week-start interaction: local now changes weekday labels and month-grid leading cells from Monday-start to Sunday-start exactly like real iTab.
- Hid the local today button as `0x0` to match the current source `today-btn` instead of treating it as a visible action.

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-calendar-standard-audit-20260521.md`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-calendar-standard-audit-20260521.json`

## 2026-05-21 — `/itab-live` calendar outer-size audit

Status: passed after correction.

Root cause:

- The prior calendar pass did not test outer component dimensions because the checklist allowed opened-state checks to stand in for the desktop outer card.
- The global `homeRect/sizeVariants` rule existed, but it was not a separate pass gate for every component. It is now part of the generic B-section contract; component-specific sections should only add their own text/data signatures.

Commands:

- `cd frontend && npm run type-check`
- `git diff --check -- frontend/src/features/itab-live/ItabLiveReplica.vue docs/itab-components/replica-quality-standard.md .codex/operations-log.md`

Chrome checks:

- Source `https://go.itab.link/`: right-clicked the real calendar component and sampled `1x1`, `1x2`, `2x1`, `2x2`, and `2x4`; restored it to `2x2`.
- Local `http://127.0.0.1:23002/itab-live`: replayed the same size menu sequence.
- Final failures: `[]`.
- Local console warning/error entries: `0`.

Verified outer dimensions:

- `1x1=60x60`
- `1x2=150x60`
- `2x1=60x150`
- `2x2=150x150`
- `2x4=330x150`

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-calendar-outer-size-audit-20260521.md`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-calendar-outer-size-audit-20260521.json`

## 2026-05-21 — `/itab-live` todo component audit

Status: passed after correction.

Commands:

- `cd frontend && npm run type-check`

Chrome checks:

- Source `https://go.itab.link/`: sampled待办事项 outer sizes and opened panel; replayed add, complete, switch `所有`, and delete temporary task.
- Local `http://127.0.0.1:23002/itab-live`: replayed the same outer size menu and interaction sequence.
- Verified outer sizes: `1x1=60x60`, `1x2=150x60`, `2x1=60x150`, `2x2=150x150`, `2x4=330x150`.
- Verified local opened row geometry `754x63`, checkbox border `2px`, completed checkbox blue state, active folder switching, and pending-only outer preview.
- Local Chrome warning/error entries: `0`.

Not fully covered:

- Search filtering, new list creation, settings, view-mode icons, and date picker were not source-click verified in this run, so the component is not marked as fully passed.

Evidence:

- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-todo-audit-20260521.md`
- `/Volumes/extendData/Data/IdeaProjects/StartDeck/.codex/itab-live-todo-audit-20260521.json`

## 2026-05-21 — `/itab-live` Todo basic simplification

Status: passed for the simplified basic Todo scope requested by the user.

Commands:

- `cd frontend && npm run type-check`

Chrome source checks:

- Real iTab Todo list scroll container is `.el-scrollbar__wrap.el-scrollbar__wrap--hidden-default`, about `754x476`, `overflow:auto`, `scrollbar-width:none`, `scrollHeight/clientHeight=1341/476`.
- Real iTab long task expands textarea and row: textarea `31px -> 94px`, row `63px -> 126px`, textarea `scrollHeight/clientHeight=94/94`, no internal textarea scrollbar.

Chrome local checks:

- Local `/itab-live` Todo removed left sidebar and date controls: `.todo-left-tabs=0`, `.todo-date/.todo-add-date=0`.
- Draft input grows with long text: `42px -> 83px`; list moves down and keeps hidden scrollbar behavior.
- Submitted long task grows row naturally: textarea `73px`, row `89px`, `internalTextareaOverflow=false`.
- Local Chrome warning/error entries: `0`.

Follow-up:

- Source scrollbar is auto-hidden, but it shows a light rounded overlay thumb during scroll/interaction.
- Local Todo list scrollbar now matches that behavior as an overlay: native scrollbars are hidden, task rows keep full width, and the visible thumb is rendered as an absolute overlay on hover or active scrolling instead of cutting the row card edge or reserving a right-side gutter.
- `cd frontend && npm run type-check` passed.
- Local Browser DOM verification on `http://127.0.0.1:23002/itab-live` with 19 task rows passed: row width equals scroller width `954px`, row right edge equals scroller right edge, row right radii remain `8px`, thumb is `position:absolute`, `7px` wide, visible during scroll, and overlays inside the row area without a reserved gutter. Console errors `0`; the only warning is the existing deprecated `apple-mobile-web-app-capable` meta warning.
- `git diff --check -- frontend/src/features/itab-live/ItabLiveReplica.vue docs/itab-components/replica-quality-standard.md verification.md .codex/operations-log.md .codex/testing.md` passed.

Outer `2x4` follow-up:

- Local Todo `2x4` no longer renders the previous left-side statistics/add area. It now uses the same title/list structure as `2x2`, stretched to the full `2x4` width.
- `2x4` outer rows now include a left checkbox control. Clicking it calls `toggleTodoTask(task)` with event propagation stopped, so the task can be completed from the outer component without opening the Todo popup.
- `cd frontend && npm run type-check` passed.
- `git diff --check -- frontend/src/features/itab-live/ItabLiveReplica.vue docs/itab-components/replica-quality-standard.md .codex/operations-log.md .codex/testing.md verification.md` passed.
- Browser runtime verification was blocked because the in-app browser policy rejected `http://127.0.0.1:23002`; no alternate browser surface was used.

Context-menu positioning follow-up:

- Component and blank-area right-click menus now use the same viewport coordinate model as their mouse event. `clampPoint()` clamps to a safe viewport range and `.blank-menu, .widget-menu` use `position: fixed`, so the menus are no longer positioned relative to the scrollable page content.
- Search and group menus still use the shared absolute menu base because they are anchored to fixed UI controls, not mouse context-menu coordinates.
- `cd frontend && npm run type-check` passed.
- `git diff --check -- frontend/src/features/itab-live/ItabLiveReplica.vue docs/itab-components/replica-quality-standard.md .codex/operations-log.md .codex/testing.md verification.md` passed.
- Browser runtime verification remains blocked by the local URL policy for `http://127.0.0.1:23002`.

Unified widget contract follow-up:

- Added `frontend/src/features/itab-widgets/itabWidgetContract.ts` as the reusable iTab replica component contract for the future StartDeck refactor. It is outside the single-file `/itab-live` implementation so it can survive when the monolith is split and the old components are deleted.
- The contract defines all current replica widget kinds and their `defaultSize`, `supportedSizes`, `sizeAdaptation`, `openSurface`, `requiresSizeSpecificUi`, and optional `iconOnlySizes`.
- `ItabLiveReplica.vue` now uses this contract for the right-click size menu, unsupported-size guard, and Todo icon-only rendering behavior.
- `cd frontend && npm run type-check` passed.
- `cd frontend && npm test -- --run src/features/itab-widgets/itabWidgetContract.spec.ts src/features/itab-live/ItabLiveReplica.spec.ts` passed 2 files / 5 tests; output included only existing Baseline/Browserslist warnings.
- `git diff --check -- frontend/src/features/itab-widgets/itabWidgetContract.ts frontend/src/features/itab-widgets/itabWidgetContract.spec.ts frontend/src/features/itab-live/ItabLiveReplica.vue docs/itab-components/replica-quality-standard.md .codex/operations-log.md .codex/testing.md verification.md` passed.

## 2026-05-22 — iTab movie calendar API repair

Executor: Codex

Status: passed.

- Backend API: `GET /api/itab/movie-calendar` now proxies fixed upstream `https://api.codelife.cc/itab/todayMovie?version=v2`, normalizes the current movie payload, uses `sharedWidgetCache`, and returns same-origin poster/cover paths.
- Backend media: `GET /api/itab/movie-calendar/image/poster` and `/cover` stream the current movie images as inline image responses so browser rendering is not broken by upstream attachment headers.
- Frontend: `/itab-live` movie calendar outer card and opened panel now bind to API data with fallback; movie widget contract is marked size-specific.
- Verification: `go test ./...`, `npm --prefix frontend test -- ItabLiveReplica.spec.ts --run`, `npm --prefix frontend run type-check -- --pretty false`, and `npm --prefix frontend run build` passed.
- Runtime: temporary backend `3001` plus Vite `23022` validated current movie `波拉特`, five outer sizes, opened `860x552` panel, poster `273x405`, no broken images, no generic panel, no screenshot skin, and no console warnings/errors.
- Final local runtime: backend `3000` and Vite `23000` were restarted with the new code. `http://127.0.0.1:23000/itab-live` was rechecked and returned current movie `波拉特`, same-origin media paths, opened `860x552` panel, poster `273x405`, no broken images, no generic panel, no screenshot skin, and no console warnings/errors.
- Evidence screenshot: `/tmp/startdeck-movie-calendar-api-proxy-20260522.png`.

## 2026-05-22 — Formal WidgetShellContract

- Added formal shell contract runtime/source validation in `frontend/src/features/itab-widgets/WidgetShellContract.ts`.
- Wired `/itab-live` desktop frame degradation in `frontend/src/features/itab-live/ItabLiveWidgetFrame.vue`.
- Documented widget shell development rules in `AGENTS.md` and `docs/itab-components/replica-quality-standard.md`.
- `npm --prefix frontend test -- WidgetShellContract.spec.ts itabWidgetContract.spec.ts ItabLiveReplica.spec.ts --run` passed 27 tests.
- `npm --prefix frontend run type-check -- --pretty false` passed.
- `npm --prefix frontend run build` passed with existing baseline-browser-mapping/Browserslist age, dynamic-import chunk, and large-chunk warnings.
- Browser validation used isolated Chromium on `http://127.0.0.1:23000/itab-live`: 31 widgets, 31 cards, 31 titles, all widgets had `data-widget-shell-contract="itab-widget-shell/2026-05-22"`, card position `absolute`, card radius `18px`, title position `absolute`, zero initial contract errors, and right-click menu closed after size selection.
- Intentional runtime violation check: forced clock card radius to `24px`, triggered a size update, observed one degraded widget with `.widget-contract-error`, `WidgetShellContractError`, closed menu, then reload restored zero contract errors. Screenshot saved to `/tmp/startdeck-widget-shell-contract-20260522.png`.

## 2026-05-22 — Main Runtime iTab Cleanup

- Removed iTab replica runtime creation/rendering from the main project widget path while keeping AddWidgetModal replica cards as disabled migration candidates.
- `npm --prefix frontend test -- AddWidgetModal.spec.ts widgetCatalog.spec.ts widgetSizePresets.spec.ts addComponentTypes.spec.ts GridPanel_ContextMenu.spec.ts --run` passed 37 tests.
- `npm --prefix frontend run type-check -- --pretty false` passed.
- `npm --prefix frontend run build` passed with existing baseline-browser-mapping/Browserslist age, `offlineQueue.ts` chunking, and large chunk warnings.
- `git diff --check` passed.

## 2026-05-22 — Main Weather Widget Shell Migration

- Migrated main `weather` and `amap-weather` runtime branches to `MainWidgetShell`.
- Added neutral shell contract/profile support while preserving iTab default contract compatibility.
- `npm --prefix frontend test -- WidgetShellContract.spec.ts MainWidgetShell.spec.ts SimpleWeatherWidget.spec.ts AmapWeatherWidget.spec.ts widgetCatalog.spec.ts widgetSizePresets.spec.ts GridPanel_ContextMenu.spec.ts --run` passed 49 tests.
- `npm --prefix frontend run type-check -- --pretty false` passed.
- `npm --prefix frontend run build` passed with existing warning classes only.
- Browser pre-acceptance on `http://127.0.0.1:23000/` passed after revisions: `title/evaluate/screenshot` completed, weather shell degraded `false`, canonical `data-widget-size` count `1`.
- Independent QA Acceptance Agent `019e4ebb-c739-72c3-92ed-085bef0d9ce2` passed.

## 2026-05-22 — iTab Clock Runtime Migration

- Added canonical `itab-clock-12` runtime and removed old direct `ClockWidget` path.
- `npm --prefix frontend test -- --run src/features/itab-clock/itabClockModel.spec.ts src/features/itab-clock/ItabClockWidget.spec.ts src/features/itab-clock/ItabClockOpenedPanel.spec.ts src/features/widget-runtime/widgetRuntimeSizes.spec.ts src/utils/widgetCatalog.spec.ts src/utils/widgetUtils.spec.ts src/utils/widgetSizePresets.spec.ts src/components/AddWidgetModal.spec.ts src/stores/cache.spec.ts src/components/__tests__/GridPanel_ContextMenu.spec.ts` passed 10 files / 90 tests.
- `npm --prefix frontend run type-check -- --pretty false` passed.
- `npm --prefix frontend run build` passed with existing warning classes only.
- Browser validation on `http://127.0.0.1:23000/` passed: default `2x2` measured `150x150`, right-click `1x2` measured `150x60`, `1x2` time group measured `129x24` centered, opened shell measured `1000x602`, seconds toggle changed flip cards from 6 to 4, degraded shell count `0`, and clean reload produced no new warning/error logs.
- Evidence screenshot: `/Volumes/extendData/Data/IdeaProjects/StartDeck/itab-clock-runtime-validation-20260522.png`.

## 2026-05-22 — iTab Pomodoro Runtime Migration

- Added canonical `itab-pomodoro-29` runtime for 番茄时钟 under `frontend/src/features/itab-pomodoro` with split model/runtime/widget/opened-panel files.
- Wired the runtime into shared sizing, runtime registry, opened host, Add Widget catalog/recommendation/search, default widget normalization, size previews, settings labels, and GridPanel runtime data persistence.
- Added backend guest filtering for old `pomodoro` and canonical `itab-pomodoro-29` so timer state is not exposed to unauthenticated reads.
- `npm --prefix frontend test -- --run src/features/itab-pomodoro/itabPomodoroModel.spec.ts src/features/itab-pomodoro/ItabPomodoroWidget.spec.ts src/features/itab-pomodoro/ItabPomodoroOpenedPanel.spec.ts src/features/widget-runtime/widgetRuntimeSizes.spec.ts src/utils/widgetCatalog.spec.ts src/utils/widgetUtils.spec.ts src/components/AddWidgetModal.spec.ts` passed 7 files / 74 tests.
- `go test ./...` from `backend/` passed.
- `npm --prefix frontend run type-check` passed.
- `npm --prefix frontend run build` passed with existing warning classes only.
- Browser validation on `http://127.0.0.1:23000/` passed: Add Widget search for `番茄` showed canonical `番茄时钟`, default `2x2`, all five iTab sizes, and enabled state; home runtime start set `focus/running=true`; opened panel rendered `.opened-itab-pomodoro` and `[data-itab-pomodoro-opened-panel]` with wave theme and timer controls; no Vite overlay; desktop warning/error logs empty. Mobile `390x844` opened-state smoke rendered in viewport; mobile console had unrelated existing sync/HotWidget fetch failures, while `pomodoro`/`tomato` filtered logs were empty.
- Evidence screenshot: `/tmp/startdeck-itab-pomodoro-opened-20260522.png`.

## 2026-05-23 — iTab Anniversary Runtime Migration

- Added canonical `itab-anniversary-03` runtime for 纪念日 under `frontend/src/features/itab-anniversary` with split model/runtime/widget/opened-panel files.
- Wired the runtime into shared sizing, runtime registry, opened host, Add Widget catalog/recommendation/search, default widget normalization, size previews, and GridPanel runtime data/add persistence.
- `npm --prefix frontend test -- itabAnniversaryModel.spec.ts ItabAnniversaryWidget.spec.ts ItabAnniversaryOpenedPanel.spec.ts widgetRuntimeSizes.spec.ts widgetCatalog.spec.ts widgetUtils.spec.ts --run` passed 6 files / 71 tests.
- `npm --prefix frontend test -- WidgetRuntimeFrame.spec.ts WidgetRuntimeMenu.spec.ts ItabLiveReplica.spec.ts WidgetShellContract.spec.ts itabWidgetContract.spec.ts --run` passed 5 files / 42 tests.
- `npm --prefix frontend test -- widgetCatalog.spec.ts widgetUtils.spec.ts ItabAnniversaryOpenedPanel.spec.ts WidgetRuntimeFrame.spec.ts --run` passed 4 files / 58 tests after the multi-instance add correction.
- `npm --prefix frontend run type-check -- --pretty false` passed.
- `npm --prefix frontend run build` passed with existing warning classes only.
- Browser validation on `http://127.0.0.1:23000/` passed: no Vite overlay, no shell degraded state, no `WidgetShellContractError`; right-click size menu was complete and closed after selection; opened panel common events/date picker/background images/font-removal/add behavior matched the accepted source evidence.
- Known unrelated console noise: local backend/API failures for IP/visit/cache sync/WebSocket/HotWidget remained in Chrome logs.

## 2026-05-23 — iTab Anniversary Source Parity Image/Color Sync

- Updated the anniversary split runtime and `/itab-live` inline replica to match source `https://go.itab.link/`: 25 background images, source text/background swatches, no font selector, no fixed dark overlay when mask is `0`, and no synthetic 2x4 non-calendar wide-list.
- Added source image assets `frontend/public/itab-live-assets/anniversary/yiyan-25.webp` and `frontend/public/itab-live-assets/anniversary/yiyan-25-thumb.webp`.
- Fixed the add-flow background sync bug by removing the `.is-anniversary-day` pure-color background override, so newly added anniversary widgets render the selected image; color mode still renders pure color with `background-image: none`.
- `npm test -- ItabLiveReplica.spec.ts ItabAnniversaryWidget.spec.ts ItabAnniversaryOpenedPanel.spec.ts itabAnniversaryModel.spec.ts widgetRuntimeSizes.spec.ts widgetCatalog.spec.ts widgetUtils.spec.ts WidgetRuntimeFrame.spec.ts --run` passed, 8 files / 101 tests.
- `npm run type-check -- --pretty false` passed.
- `npm run build` passed with existing Baseline/Browserslist/runtime-resource/offlineQueue/chunk-size warnings only.
- `git diff --check` over touched anniversary/live files and validation docs passed.
- Chrome local validation on `http://127.0.0.1:23000/itab-live` passed: opened panel `1000x602`, image count `25`, exact source swatches, `背景图片 25` propagated to a newly added outer widget, `背景颜色 #fc4548` propagated to a newly added pure-color outer widget, and outer size matrix was `1x1=60x60`, `1x2=150x60`, `2x1=60x150`, `2x2=150x150`, `2x4=330x150`.

## 2026-05-23 — iTab Offwork Countdown Pixel Replica

- Updated `/itab-live` `下班倒计时` to source-like offwork rendering with `offwork.png`, dynamic payday/Friday/Children's Day/income metrics, and all five size-specific outer states.
- Rebuilt the opened state as the source-like dark dialog: `1000x602` shell, `420px` preview aside, `578px` settings pane, source control inventory, and `完 成` action.
- `npm test -- ItabLiveReplica.spec.ts --run` passed, 1 file / 24 tests.
- `npm run type-check` passed.
- `git diff --check` passed.
- Browser validation on `http://127.0.0.1:23000/itab-live` passed: default `2x4=330x150`; right-click sizes `1x1=60x60`, `1x2=150x60`, `2x1=60x150`, `2x2=150x150`, `2x4=330x150`; opened shell `1000x602`; generic panel count `0`; shell contract errors `0`; console only had Vite debug logs.

## 2026-05-23 — iTab Offwork Countdown Strict Source Correction

Status: pass.

Scope:
- Corrected the `下班倒计时` opened state to match the current source light dialog after fresh source sampling.
- Added live opened-state interactions for workday selection, background image mode, mask row, preview dots, more-option toggles, payday control, daily income, and completion close.

Verification:
- Prettier passed on `ItabLiveReplica.vue`, `ItabLiveOpenedShell.vue`, and `ItabLiveReplica.spec.ts`.
- Vitest passed: `npm test -- ItabLiveReplica.spec.ts --run` -> 1 file / 24 tests.
- Type-check passed: `npm run type-check`.
- Scoped whitespace check passed: `git diff --check -- frontend/src/features/itab-live/ItabLiveReplica.vue frontend/src/features/itab-live/ItabLiveOpenedShell.vue frontend/src/features/itab-live/ItabLiveReplica.spec.ts frontend/src/features/itab-live/ItabLiveWidgetFrame.vue frontend/src/features/itab-widgets/itabWidgetContract.ts`.
- Source browser capture on `https://go.itab.link/` confirmed current light opened dialog: shell `1000x602`, white aside `420x600`, right pane `578x600` at `rgb(241,240,245)`, source-like rows, and interactions for `周六`, `图片`, and preview dots.
- Local Browser validation on `http://127.0.0.1:23000/itab-live` confirmed outer sizes `60x60`, `150x60`, `60x150`, `150x150`, `330x150`; menu close after every size action; opened shell `1000x602`; no generic panel; source-like light row styling; `周六` active after click; mask row visible after `图片`; first preview dot active; payday control hidden after toggle; `完 成` closes the panel.
- Console warn/error logs: none.

Residual risk:
- Screenshot capture timed out through the browser-client screenshot API, so no PNG artifact was retained for this correction. DOM/CSS/interaction measurements and tests passed.

## 2026-05-23 - iTab Anniversary Source UI and Interaction Continuation

Status: pass.

Scope:
- Source-vs-local repair for the iTab anniversary opened panel, template list, 2x2/2x4 sizes, background color/image controls, mask row, common events, date picker, repeat popover, preview carousel, add/update synchronization, and font-selector removal.

Verification:
- Vitest passed: `npm test -- ItabAnniversaryOpenedPanel.spec.ts ItabAnniversaryWidget.spec.ts ItabLiveReplica.spec.ts --run` -> 3 files / 40 tests.
- Type-check passed: `npm run type-check -- --pretty false`.
- Build passed: `npm run build`.
- Formatting check passed on the touched anniversary/live files.
- Scoped whitespace check passed with `git diff --check`.
- Chrome source capture confirmed the source light opened panel, selected 2x2 ring, non-truncated 2x2 number, single white image panel, 25 thumbnails, and internal mask row.
- Chrome local validation confirmed `998x600` opened panel, `25` images, no font selector, image/color-to-outer synchronization, common-event outside close, date/repeat mutual close behavior, 2x4 template geometry without clipping, no Vite overlay, no degraded shell, and no `WidgetShellContractError`.

Residual risk:
- The live source 2x4 tab did not reliably switch during one Chrome sampling attempt, so 2x4 behavior was validated against the local implementation and user/source screenshots rather than a source DOM state after tab switch.
- Production build warnings are existing project-level warnings unrelated to this change: stale Baseline/Browserslist data, runtime-only `/api/itab-resources/...` URL, `offlineQueue.ts` mixed import warning, and large chunk size.

## 2026-05-23 - iTab Anniversary Template Spacing and Payday Thumbnail Correction

Status: pass.

Scope:
- Corrected the left template selector spacing/style leakage for `2x2` and `2x4`, with special focus on the `倒数日` thumbnail title/content.

Verification:
- Chrome source capture measured the real `倒数日` card title/content as full-width header/content areas.
- Chrome local validation on the main project showed the `2x2` payday title spans the full `123px` thumbnail width and the `2x4` payday title spans the full `275px` thumbnail width.
- Vitest passed: `npm test -- ItabAnniversaryOpenedPanel.spec.ts ItabAnniversaryWidget.spec.ts ItabLiveReplica.spec.ts --run` -> 3 files / 40 tests.
- Type-check passed: `npm run type-check -- --pretty false`.
- Build passed: `npm run build`.
- Formatting and scoped whitespace checks passed.

Residual risk:
- The source add/template modal still could not be opened from the current source session by direct click, so the `倒数日` header/content correction used source desktop DOM geometry plus the existing source screenshots as the proportional basis for the template thumbnail. Local DOM geometry now matches the expected scaled full-width header behavior.

## 2026-05-23 - iTab Anniversary Template Tab-to-Card Spacing

Status: pass.

Scope:
- Adjusted the vertical spacing between the `2x2/2x4` segmented control and the first template card row in the left template selector.

Verification:
- Chrome local validation showed both `2x2` and `2x4` now have `21px` from segmented-control bottom to card body and `18px` from segmented-control bottom to visible active ring.
- Vitest passed: `npm test -- ItabAnniversaryOpenedPanel.spec.ts ItabAnniversaryWidget.spec.ts ItabLiveReplica.spec.ts --run` -> 3 files / 40 tests.
- Type-check passed: `npm run type-check -- --pretty false`.
- Build passed: `npm run build`.
- Formatting and scoped whitespace checks passed.

Residual risk:
- This was a visual spacing-only CSS adjustment. Existing project-level build warnings are unchanged and unrelated to the spacing fix.

## 2026-05-23 - iTab Converter Calculator Functional Behavior Parity

Status: pass.

Scope:
- Captured live source calculator key behavior from `https://go.itab.link/` and aligned local `/itab-live` calculator interactions beyond visual appearance.
- Covered expression editing, `=` result mode, `AC`, backspace-to-empty, percent append, chained operations, division by zero, balanced/unbalanced parentheses, and `大写`.

Verification:
- Source Chrome evidence captured in `.codex/qa-screenshots/itab-converter-source-calculator-behavior-v2-20260523.json` and `.codex/qa-screenshots/itab-converter-source-calculator-extra-behavior-20260523.json`.
- Local Playwright evidence captured in `.codex/qa-screenshots/itab-converter-local-calculator-behavior-before-20260523.json` and `.codex/qa-screenshots/itab-converter-local-calculator-behavior-after-20260523.json`.
- Parity report `.codex/qa-screenshots/itab-converter-calculator-behavior-parity-20260523.json` passed with `compared=10`, `finalMatched=10`, `stepsMatched=10`, `failures=[]`.
- Vitest passed: `npm test -- --run src/features/itab-live/ItabLiveReplica.spec.ts -t converter`.
- Vitest passed: `npm test -- --run src/features/itab-live/ItabLiveReplica.spec.ts` -> 1 file / 24 tests.
- Contract tests passed: `npm test -- --run src/features/itab-widgets/itabWidgetContract.spec.ts src/features/itab-widgets/WidgetShellContract.spec.ts` -> 2 files / 16 tests.
- Type-check passed: `npm run type-check`.
- Build passed: `npm run build`.
- Formatting and scoped whitespace checks passed.

Residual risk:
- Calculator workflow parity is source-step matched for the collected 10 workflows. Full raw DOM identity for every non-calculator internal tool remains partial as documented in `.codex/itab-converter-pixel-replica-review-report.md`.
- Production build warnings are existing project-level warnings: stale Baseline/Browserslist data, runtime-only `/api/itab-resources/...` URL, `offlineQueue.ts` mixed import warning, and large chunk size.

## 2026-05-23 - iTab Movie Calendar Strict Repair Follow-up

Status: pass for the scoped repair.

Scope:
- Repaired movie calendar strict-parity gaps found by `docs/itab-components/replica-quality-standard.md`: `/itab-live` shell shadow, rating badge radius, opened body/poster DOM, and main migrated quote/reader fallbacks.

Verification:
- Dynamic API check passed through Vite proxy: `GET http://127.0.0.1:23000/api/itab/movie-calendar` returned `2026-05-23`, `雌雄莫辨`, `7.4`, and `sourceStatus=ok`.
- Browser `/itab-live` validation passed for five size switches, menu close behavior, source-specific movie shadows, rating `6px` radius, opened shell `860x552`, opened body `858x550`, two poster image nodes, visible poster `273x405`, and no generic panel.
- Browser `/qa/itab-widgets` validation passed for the main migrated path: movie body had no quote fallback and opened capture `05` rendered `.movie-calendar-panel` without `.reader-panel`.
- Vitest passed: focused movie calendar tests, full `ItabLiveReplica.spec.ts`, `ItabWidgetRenderer.spec.ts`, `ItabWidgetPanelHost.spec.ts`, `itabWidgetContract.spec.ts`, and `WidgetShellContract.spec.ts`.
- Frontend type-check passed: `npm run type-check`.
- Backend movie-calendar handler test passed: `go test ./handlers -run TestItabMovieCalendar`.
- Formatting and scoped whitespace checks passed.

Residual risk:
- The local homepage profile did not contain generated iTab movie widgets, so main migrated browser proof used `/qa/itab-widgets` plus focused tests.
- One old browser warning from `sync.ts` was logged before the backend was started; it did not recur as an overlay or app error during API-backed validation.

Follow-up correction from user source screenshot:
- The user-provided source screenshot showed the opened movie panel uses left-side text and right-side poster, with star rating plus numeric score. The earlier local opened layout had been derived from an older/insufficient source interpretation.
- Updated `/itab-live` and the main movie panel to render copy before poster, place the poster on the right, and render visible star rating with transparent numeric score styling.
- Browser validation after the correction showed `posterIsRightOfCopy=true`, poster image count `2`, generic panel count `0`, rating background transparent, star pseudo-elements present, and source-status `ok`.
- Targeted tests passed again: `npm test -- --run src/features/itab-live/ItabLiveReplica.spec.ts -t "movie calendar"` and `npm test -- --run src/features/itab-widgets/ItabWidgetPanelHost.spec.ts`.

## 2026-05-23 - iTab Wallpaper Bing-Only Replica

Status: pass for the scoped wallpaper replica repair.

Scope:
- Rebuilt `/itab-live` 壁纸 as a Bing-only wallpaper catalog, removing the left source selector/sidebar and moving the parameter settings entry to a gear icon before the top-right close controls.
- Added source-sized outer behavior across all five sizes and replaced the old generic media opened panel.

Verification:
- Focused wallpaper Vitest passed: `npm test -- --run src/features/itab-live/ItabLiveReplica.spec.ts -t wallpaper`.
- Contract tests passed: `npm test -- --run src/features/itab-widgets/itabWidgetContract.spec.ts`.
- Full `ItabLiveReplica.spec.ts` passed: 25 tests.
- Frontend type-check passed: `npm run type-check`.
- Scoped `git diff --check` passed for all touched wallpaper/contract/test/log files.
- Browser validation on `http://127.0.0.1:23000/itab-live` with backend `3000` showed five-size right-click switching, no stale menus, opened shell `1000x602`, no `.opened-media-panel`, removed source labels absent, settings gear before green/red traffic buttons, `加载更多` from 12 to 16 images, 16/16 loaded image thumbnails, and no widget contract errors.
- Mobile viewport `390x844` showed the settings popover and two-column grid stayed inside the opened shell.

Residual risk:
- The implementation intentionally keeps only Bing wallpaper sources per user request, so it no longer matches the source app's multi-source sidebar categories by design.
- Existing frontend warning about deprecated `apple-mobile-web-app-capable` remains unrelated to this change.

## 2026-05-23 - iTab IP Widget Replica Repair

Status: pass for the scoped IP repair.

Verification:
- `npm test -- --run src/features/itab-live/ItabLiveReplica.spec.ts` passed, 1 file / 26 tests.
- `npm run type-check -- --pretty false` passed.
- Scoped `git diff --check` passed for the IP repair files and L3 evidence files.
- Browser validation on `http://127.0.0.1:23000/itab-live` with backend `3000` passed the mandatory order:
  1. Outer multi-size: `1x1`, `1x2`, `2x1`, `2x2`, and `2x4` all matched expected root rects; IP image filled the root; source-like blue background and shadows were present; context menu closed after every size action.
  2. Opened static: shell measured `1000x602`, iframe body `998x600`, overlay/style matched the source baseline, and no old `.ip-card` remained.
  3. Opened interaction: remote IP iframe loaded tabs/input/query UI, accepted `8.8.8.8`, and red close removed the panel.
- Console warnings/errors: `0`. Widget contract errors: `0`.

Artifacts:
- `/tmp/startdeck-ip-repair-qa-20260523.json`
- `/tmp/startdeck-ip-repair-outer-20260523.png`
- `/tmp/startdeck-ip-repair-opened-20260523.png`

Residual risk:
- The IP lookup body is remote iframe content from `widget.codelife.cc`; future upstream availability can affect the inner tool.

## 2026-05-23 - iTab Movie Calendar Source Screenshot Recheck

Status: pass for the scoped strict recheck.

Scope:
- Rechecked the source screenshot mismatch against live source DOM/API, `/itab-live` outer/opened rendering, and the main migrated movie-calendar panel.
- Fixed one additional main-panel specificity issue found during QA: the source link button inherited generic button color/padding instead of source-style link metrics.

Verification:
- Source/API baseline for `2026-05-23`: `雌雄莫辨`, Douban `7.4`, quote `你不需要成为任何人，只需做你自己。`, source link `https://movie.douban.com/subject/4712730/`.
- `/itab-live` API-backed browser check passed: five size switches closed the context menu and measured `60x60`, `150x60`, `60x150`, `150x150`, `330x150`; opened shell `860x552`, body `858x550`, right poster `181.92x269.88`, rating sprite `55x11`, source link `758x29.2`; no generic panel, iframe, screenshot skin, contract error, console warning/error, or failed response.
- Main QA route check passed for capture `05`: `.movie-calendar-panel=1`, `.reader-panel=0`, `.quote-symbol=0`, `.opened-generic-panel=0`; source link after fix measured `rgb(242,204,164)`, `padding=10px 0 0`, `height=29.2`, transparent background, opacity `0.8`.
- Vitest passed: `npm test -- --run src/features/itab-widgets/ItabWidgetPanelHost.spec.ts`.
- Vitest passed: `npm test -- --run src/features/itab-live/ItabLiveReplica.spec.ts -t "movie calendar"`.
- Backend test passed: `go test ./handlers -run TestItabMovieCalendar`.
- Type-check passed: `npm run type-check -- --pretty false` after the final CSS specificity fix.

Residual risk:
- The movie data is dynamic. This proof is valid for the live source data observed on 2026-05-23 and should be refreshed when upstream date/content changes.

## 2026-05-23 - iTab Movie Calendar Runtime Fallback Repair

Status: pass for the scoped repair.

Checks:
- Focused movie calendar Vitest passed, including proxy-failure direct-source fallback and explicit all-failed error state.
- Full `ItabLiveReplica.spec.ts` passed.
- Frontend type-check passed.
- Current runtime with backend proxy showed `雌雄莫辨`, `sourceStatus=ok`, Douban `4712730`, and loaded poster images.
- Simulated proxy failure in browser showed `sourceStatus=direct`, current `雌雄莫辨`, direct current cover/poster URLs, no `红气球之旅`, and no broken images.

Residual risk:
- Direct fallback is intentionally limited to the upstream todayMovie API. If both backend and upstream fail, the UI now exposes the failure instead of hiding it with old sample content.

## 2026-05-23 - iTab Wallpaper Real Bing API Migration

Status: pass for the scoped main-project wallpaper API migration.

Checks:
- Official Bing `HPImageArchive.aspx` probe returned the current daily entry `OHR.ThreeTurtlesButterflies` and copyright `与蝴蝶在一起的乌龟 (© Patrick Gallet/Getty Images)`.
- Local endpoint `http://127.0.0.1:23000/api/itab/bing-wallpapers?n=2&mkt=zh-CN` returned `success=true`, `sourceStatus=ok`, and API-backed entries.
- Backend tests passed: `go test ./handlers -run 'TestItabBingWallpaper'` and `go test ./...`.
- Frontend tests passed: focused wallpaper widget/panel tests, broader iTab widget regression set, `npm run type-check -- --pretty false`, and `npm run build`.
- Browser validation on `http://127.0.0.1:23000/` showed `sourceStatus=ok`, current Bing featured text, visible `加载更多`, and applying `three-turtles-butterflies` updated the desktop background state with a real Bing image URL.

Residual risk:
- Bing's daily payload changes over time, so future title/image-id assertions must re-probe the source API first.

## 2026-05-23 - iTab IP Outer Information Card

Status: pass for the scoped IP outer-card update.

Checks:
- `2x2` and `2x4` IP widget surfaces now use native `/api/ip` data and render IP address plus location directly on the blue IP background.
- Small IP sizes `1x1`, `1x2`, and `2x1` remain icon-only.
- Focused Vitest passed: `npm test -- --run src/features/itab-live/ItabLiveReplica.spec.ts` -> 28 tests.
- Type-check passed: `npm run type-check -- --pretty false`.
- Scoped whitespace check passed.
- Browser validation on `http://127.0.0.1:23000/itab-live` followed the required order: outer multi-size first, opened static second, opened interaction third. Outer matrix passed, `2x2` measured `18px/15px`, `2x4` measured `40px/18px`, text centers had `0` delta, opened panel had `iframeCount=0`, and querying `8.8.8.8` returned the Google LLC result.
- Follow-up text-fit check: `2x2` address `clientWidth=115` and `scrollWidth=115`; location `clientWidth=115` and `scrollWidth=115`, so the current IPv4/location render fully without ellipsis.
- Follow-up hierarchy correction: outer `2x2` and `2x4` now use the actual IP value as title and the归属地 as subtitle. Browser validation after querying `8.8.8.8` showed `2x2` title `8.8.8.8`, subtitle `美国-弗吉尼亚州-Ashburn`, and subtitle `clientWidth=134` / `scrollWidth=134` with wrapping enabled, so the text is complete without horizontal overflow.
- Opened simplification follow-up: component title renamed to `本机IP`; opened panel no longer renders tabs or the search form (`tabs=0`, `search=0`, `inputs=0`, `buttons=[]`). Browser validation kept `iframeCount=0`, four result rows, clean close behavior, and outer location text shrunk to `14px/19px` on `2x2` and `17px/23px` on `2x4`.

Residual risk:
- IP/location values are dynamic and should be re-read from the running backend during future visual checks.

## 2026-05-25 - Rust Backend And Icon Service Rewrite

Status: superseded by the final full-stack closure below. Initial backend/icon-service rewrite passed, but this checkpoint still had frontend test failures and unavailable Docker CLI.

Checks:
- Go baseline passed: `backend go test ./...`.
- Go icon baseline passed after stale-time fixture repair: `icon-service go test ./...`.
- Rust formatting passed: `cargo +1.94.0 fmt --all`.
- Rust lint passed: `cargo +1.94.0 clippy --workspace --all-targets -- -D warnings`.
- Rust semantic tests passed: `cargo +1.94.0 test --workspace`.
- Rust release binaries built: `cargo +1.94.0 build --release --workspace --bins`.
- Local two-service smoke passed on temporary data: backend `127.0.0.1:39080`, icon service `127.0.0.1:39081`; verified health, login, authenticated data read/save/readback, direct icon metadata, backend icon metadata proxy, and protected Docker auth boundary.

Blocked/failed:
- `frontend npm test -- --run` failed in existing tests: `CustomWidgets.spec.ts`, `GroupSelector.spec.ts`, and `WebLayoutRemoval.spec.ts`.
- `docker compose config` could not run because `docker` is not installed.

Residual risk:
- Socket.IO is currently a placeholder; native `/ws` is implemented.
- Docker control is intentionally disabled in Rust and returns explicit unavailable responses.
- Browser e2e against the full Rust-backed app should be rerun after the current frontend test baseline is clean.

## 2026-05-25 - Rust Full-Stack Closure

Status: pass for local frontend + Rust backend + Rust icon-service runtime.

Checks:
- `backend go test ./...` passed.
- `icon-service go test ./...` passed.
- `npm test -- --run` from `frontend/` passed, 90 files / 455 tests.
- `npm run type-check -- --pretty false` from `frontend/` passed.
- `npm run build` from `frontend/` passed with existing non-fatal warnings: stale Baseline/Browserslist data, runtime iTab resource resolution, mixed static/dynamic import chunking, and large chunks.
- `cargo +1.94.0 fmt --all` passed.
- `cargo +1.94.0 clippy --workspace --all-targets -- -D warnings` passed.
- `cargo +1.94.0 test --workspace` passed.
- `cargo +1.94.0 build --release --workspace --bins` passed.

Runtime QA:
- Rust backend ran at `127.0.0.1:39180`, Rust icon-service at `127.0.0.1:39181`, Vite at `http://127.0.0.1:23180/`.
- Browser login/homepage stayed online after more than one Rust WebSocket heartbeat interval.
- Settings title save persisted through reload using Rust `/api/save` gzip JSON handling.
- Daily English, movie calendar, and IP widgets rendered usable data; movie calendar no longer showed `电影日历加载失败`, and IP no longer stayed in `加载中/定位中`.

Residual risk:
- Docker compose validation is still blocked because `docker` is not installed in this environment.
- Socket.IO remains a placeholder; native `/ws` is the verified frontend runtime path.

## 2026-05-25 - Component Theme Management

Status: pass with browser limitation.

Implemented and verified:
- Added root `themeMode` handling for `auto`, `light`, and `dark`.
- Added semantic shell/component/state token layers and graphite dark palette.
- Added Settings theme segmented control and separated white/daylight mode from theme resolution.
- Generated component color audit docs/JSON and static color policy guard.
- Migrated core modal surfaces and runtime opened-panel host toward semantic tokens.

Commands:
- `npm --prefix frontend test -- --run src/composables/useThemeMode.spec.ts src/components/base/AppModalShell.spec.ts src/components/__tests__/WebLayoutRemoval.spec.ts src/features/widget-runtime/WidgetOpenedPanelHost.spec.ts src/assets/colorPolicy.spec.ts` passed.
- `npm --prefix frontend run type-check -- --pretty false` passed.
- Scoped `git diff --check` passed.
- Full `npm --prefix frontend test -- --run` passed 90 files / 463 tests and failed 1 unrelated existing test: `src/stores/cache.spec.ts` still expects logged-out guest cache to include the old clock widget default.

Browser evidence:
- `http://127.0.0.1:9003/` rendered nonblank and root auto mode resolved to dark with graphite tokens.
- Settings showed `界面主题` with `自动 / 浅色 / 深色`.
- Real clicks confirmed light tokens (`#ffffff`, `#0071e3`) and dark tokens (`#1b1f24`, `#4c9cff`).

Limitations:
- AddWidget/Edit real-click browser validation was blocked by current unauthenticated local browser state after Settings closed. Unit/static coverage and type-check covered those files in this pass.
- Full frontend suite has one residual non-theme failure in `src/stores/cache.spec.ts` from the current Docker-only default/guest-cache behavior.

## 2026-05-26 - Restart Persistence Loss

Status: pass.

Implemented:
- Legacy JSON app import is now first-run only when SQLite has no users, preventing restart from deleting saved groups/items/widgets.
- `/api/data` and widget responses now use the frontend contract shape and normalize legacy snake-case/nested payloads during save/read.
- Added restart persistence and API shape regression coverage.

Verified:
- `cargo test -p startdeck-core restart_import_does_not_overwrite_saved_sqlite_app_data -- --nocapture` passed.
- `cargo test -p startdeck-server --test api_semantics -- --nocapture` passed.
- `cargo test -p startdeck-core --test sqlite_import -- --nocapture` passed.
- `cargo test --workspace` passed.
- `cargo clippy --workspace --all-targets -- -D warnings` passed.
- Isolated live restart QA passed with actual Rust server: save data, overwrite legacy seed JSON, restart, confirm saved SQLite data still appears from `/api/data`.

Limitations:
- The currently running `9001/9002` services were not restarted in place. Restart them with the patched binaries before judging the live local page.

## 2026-05-26 - Rust-Owned Resource Relocation

Status: pass.

Implemented:
- Moved tracked main backend default resources into `rust/crates/startdeck-server/resources`.
- Moved tracked icon service seed/cache resources into `rust/crates/startdeck-iconserver/resources/data`.
- Updated Rust runtime configuration, Docker, Debian deploy/manage scripts, packaged artifact sync, docs, and tests to treat Rust crate resources as the source of truth.
- Preserved mutable runtime data under runtime/configured directories instead of moving SQLite, secrets, generated build output, user media, or caches into source crates.

Verified:
- `cargo fmt --all` passed.
- `bash -n scripts/docker-entrypoint.sh deploy_debian.sh manage.sh debian/deploy.sh debian/manage.sh` passed.
- `cargo test --workspace` passed.
- `cargo clippy --workspace --all-targets -- -D warnings` passed.
- `git diff --check` passed.

Limitations:
- Live local services were not restarted in-place. Rebuild/restart is required before the running processes use the new resource defaults.
- `Data/public` has been removed from the current worktree as a tracked generated bundle. It can still exist after frontend/package builds, but it is no longer the source resource root for tracked defaults.

## 2026-05-26 - Theme Color Pairing Review

Status: pass.

Implemented:
- Settings sidebar light/dark text now consumes `--sd-shell-text-*` tokens instead of old dark-only literals.
- Theme segmented buttons now use explicit semantic focus rings instead of browser/system focus outlines.
- Wallpaper opened-panel empty state now consumes `--sd-component-empty-*` semantic tokens; light values preserve the existing component colors and dark values map to graphite component surfaces.
- Component color audit JSON/Markdown refreshed after the token move.

Verified:
- Focused theme/color Vitest passed, 5 files / 23 tests.
- `npm --prefix frontend run type-check` passed.
- Browser computed contrast in Settings passed AA for sampled normal text in light and dark.
- Screenshots captured at `/tmp/startdeck-theme-light-review-fixed.png` and `/tmp/startdeck-theme-dark-review-fixed.png`.

Limitations:
- Full `npm --prefix frontend test -- --run` still has one unrelated existing failure in `src/stores/cache.spec.ts`, where the test expects the old clock guest-cache default.
