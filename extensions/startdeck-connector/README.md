# StartDeck Connector

执行者：Codex
日期：2026-06-02

这个目录是 StartDeck 的 Chrome MV3 浏览器插件形态。它的作用不是替代 StartDeck Web 服务，而是让部分受限上游请求可以通过当前用户浏览器网络访问，避开部署服务器 IP 被 TAPD、ChatGPT 或远程图片源限制的问题。

## 安装

1. 打开 Chrome `chrome://extensions/`。
2. 开启开发者模式。
3. 选择“加载已解压的扩展程序”。
4. 选择本目录 `extensions/startdeck-connector`。
5. 打开插件弹窗，将当前 StartDeck 部署来源加入允许列表。

## 安全边界

- 插件只接受允许列表中的 StartDeck 页面来源。
- 插件只实现 `aiUsage.query`、`tapdDefects.query`、`tapdDefects.workspace`、`icons.fetchRemoteImage` 和 `ping`。
- `icons.fetchRemoteImage` 只用于导入远程图片为 StartDeck 托管图标，限制 HTTP/HTTPS、无用户名密码 URL、非本地地址、图片 MIME、非空内容和最大 5MB。
- 插件不提供任意 URL 代理能力。
- Connector 模式下，StartDeck 页面不会把 TAPD 或 AI Usage 凭据发送到 StartDeck 服务端。

## 部署关系

外部端部署保持现有 StartDeck Web/Server 方式。用户安装插件后，TAPD 和 AI Usage 组件通过插件请求上游；远程图标保存时，如果服务端抓取失败且页面因 CORS 不能读取图片字节，前端会自动尝试通过插件读取图片，再上传到 StartDeck 的 `/api/icons` 托管接口。
