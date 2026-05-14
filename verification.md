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
