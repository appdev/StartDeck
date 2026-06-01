# MetaServer

一个用于按 `host` 或 `url` 查询站点图标与 metadata 的 Rust 服务。

## 返回结构

接口返回固定结构：

```json
{
  "code": 200,
  "data": {
    "url": "https://example.com/page",
    "finalUrl": "https://example.com/page",
    "title": "Example",
    "name": "Example",
    "icon": "/api/site/icon?url=https%3A%2F%2Fexample.com%2Fpage",
    "iconUrl": "/api/site/icon?url=https%3A%2F%2Fexample.com%2Fpage",
    "description": "Example description",
    "backgroundColor": null,
    "fetchedAt": "2026-04-22T08:11:51Z",
    "fetchStatus": "ok"
  },
  "msg": "ok"
}
```

## 第三方接入

第三方可使用以下查询接口：

- `GET /api/icon?host=xxx`
- `GET /api/icon?url=xxx`
- `GET /api/site/metadata?url=https://example.com`

建议优先传 `host`，更直接也更稳定。

### 最简示例

按 `host` 查询：

```bash
curl 'http://icons.put.run/api/icon?host=www.youtube.com'
```

按 `url` 查询：

```bash
curl 'http://icons.put.run/api/icon?url=https://apkdv.com/posts/implementing_ios_liquid_glass_effect_in_android/'
```

### 图标接口字段说明

- `data.name`: 站点名称
- `data.title`: 站点标题
- `data.icon`: StartDeck 兼容的图标代理地址字符串，默认形如 `/api/site/icon?url=...`
- `data.iconUrl`: 与 `data.icon` 相同的图标代理地址字符串
- `data.description`: 站点描述
- `data.backgroundColor`: 背景色配置，调用方可自行决定是否参与图标合成
- `data.fetchedAt`: 当前缓存记录最近一次抓取时间
- `PUBLIC_META_BASE_URL` 非空时，`data.icon` / `data.iconUrl` 会带该公开前缀；JSON 不直接暴露 `/icons/*` 或 `/cache/*`
- 未命中时会先回源 Microlink，再回退到 HTML 与 `/favicon.ico` 解析；Microlink 返回的 `data.title`、`data.logo.url` 会映射到现有返回结构

### Metadata 接口返回

`GET /api/site/metadata?url=https://example.com`

返回结构：

```json
{
  "url": "https://example.com",
  "finalUrl": "https://example.com/",
  "title": "Example Domain",
  "icon": "/api/site/icon?url=https%3A%2F%2Fexample.com%2F",
  "iconUrl": "/api/site/icon?url=https%3A%2F%2Fexample.com%2F",
  "description": "Example description",
  "fetchedAt": "2026-04-19T08:00:00Z"
}
```

字段语义与 StartDeck 当前 `/api/site/metadata` 保持一致。

### 接入建议

- 优先使用 `host` 查询
- 渲染时默认取 `data.icon[0]`
- `backgroundColor` 可能为空，调用方应做好兜底
- 同一 `host` 下不同路径会归一化到同一条图标配置

### 管理接口

以下接口用于内部维护，不建议直接开放给第三方：

- `POST /api/icon/refresh?host=xxx`
- `POST /api/icon/refresh?url=xxx`
- `DELETE /api/icon/cache?host=xxx`
- `DELETE /api/icon/cache?url=xxx`

## 功能

- 启动时从本地种子文件导入已有图标数据
- 查询命中本地缓存时直接返回
- 默认种子资源和运行期缓存分开存储
- 未命中时调用 StartDeck `website/info` 接口
- 未命中时优先调用 Microlink API，若 Microlink 没有返回 `logo.url` 再回退到 StartDeck `website/info`
- 自动下载图标到本地并更新缓存
- 缓存记录超过一个月会自动重新抓取；重抓失败时继续回退已有缓存
- 支持输出 StartDeck 兼容的 metadata 结构
- 支持按指定 `host/url` 强制刷新缓存
- 支持删除指定 `host/url` 的缓存并回退默认数据
- 通过 Rust 运行时环境变量控制端口和数据根目录

## 配置

Rust 元数据服务默认读取 `rust/crates/startdeck-metaserver/resources/data` 中的只读种子资源，部署时通过 `META_SERVER_DATA_DIR` 指向可写运行期缓存目录，默认监听 `9002`。服务独立运行，不依赖主服务；主服务通过 HTTP 调用它。常用环境变量：

- `BASE_DIR`: StartDeck 运行根目录，默认由当前工作目录推断。
- `META_SERVER_PORT`: 元数据服务监听端口，默认 `9002`。
- `META_SERVER_RESOURCE_DIR`: 元数据服务只读种子资源目录，只包含 `seed-data.json` 和默认 `icons/`。Docker 镜像中默认是 `/app/meta-service-defaults/data`。
- `META_SERVER_DATA_DIR`: 元数据服务可写运行期数据目录，用于外部挂载运行期 `cache/`。未设置时默认使用运行根目录下的 `Data/meta-service`。
- `META_SERVER_MICROLINK_API_URL`: 网站媒体信息接口，默认 `https://api.microlink.io`。设置为空字符串可禁用 Microlink，直接回退到 HTML 与 `/favicon.ico` 解析。

服务不再读取旧版 `config.json`。若缓存未命中，服务会优先使用只读 seed 数据；seed 也没有命中时先调用 Microlink 获取站点标题、描述和 logo，再将 logo 缓存到运行期 `cache/`。Microlink 不可用或无可用 logo 时，回退到直接解析目标站 HTML 和 `/favicon.ico`。

图标目录分层：

- 默认种子数据图标保存在 `META_SERVER_RESOURCE_DIR/icons`
- 非默认缓存图标保存在 `META_SERVER_DATA_DIR/cache`
- 数据库存储内部引用时，默认种子图标使用 `icons/<file>`，运行期缓存图标使用 `cache/<file>`，远程兜底保留 `http(s)://...`
- `/icons/*` 和 `/cache/*` 仍作为静态读取路由可用，分别读取默认图标和运行期缓存；API JSON 返回的 `icon` / `iconUrl` 使用 `/api/site/icon?url=...` 代理地址，不直接返回静态路径

## 运行

```bash
cargo run --bin startdeck-metaserver
```

或：

```bash
./startdeck-metaserver
```

## API

### 1. 按 host 查询

```bash
curl 'http://127.0.0.1:9002/api/icon?host=www.youtube.com'
```

### 2. 按 url 查询

```bash
curl 'http://127.0.0.1:9002/api/icon?url=https://apkdv.com/posts/implementing_ios_liquid_glass_effect_in_android/'
```

服务会自动按 host 归一化，因此同一 host 下不同路径会返回同一条图标配置。

### 3. 查询站点 metadata

```bash
curl 'http://127.0.0.1:9002/api/site/metadata?url=https://example.com'
```

服务会先尝试抓取页面 title / description / finalUrl，再结合本地缓存或回源结果补全 iconUrl。

### 4. 强制刷新指定 host

只刷新指定 host 或 url，不会刷新全量数据。
如果该 host 属于默认种子数据，接口会直接返回失败，不能强制刷新。

```bash
curl -X POST 'http://127.0.0.1:9002/api/icon/refresh?host=apkdv.com'
```

或：

```bash
curl -X POST 'http://127.0.0.1:9002/api/icon/refresh?url=https://apkdv.com/posts/implementing_ios_liquid_glass_effect_in_android/'
```

### 5. 删除指定 host 的缓存

删除缓存后，如果种子数据里存在该 host，会自动回退到默认数据。

```bash
curl -X DELETE 'http://127.0.0.1:9002/api/icon/cache?host=apkdv.com'
```

## 构建 Linux x86_64

```bash
cargo build --release --locked --bin startdeck-metaserver
```

## StartDeck 接入

StartDeck server 保持前端 BFF，不直接让前端访问本服务。

在 StartDeck server 环境中配置：

```bash
META_SERVER_BASE_URL=http://127.0.0.1:9002
META_SERVER_TIMEOUT_MS=60000
```

这样 StartDeck 后端会继续对前端暴露 `/api/site/metadata` 与 `/api/site/icon`，内部再调用本服务。
