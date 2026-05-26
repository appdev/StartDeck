# Icon Service

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
    "icon": ["https://cdn.example.com/icon.png"],
    "description": "Example description",
    "backgroundColor": null,
    "fetchedAt": "2026-04-22T08:11:51Z"
  },
  "msg": "请求成功"
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
- `data.icon`: 图标地址数组，通常使用第一个即可
- `data.description`: 站点描述
- `data.backgroundColor`: 背景色配置，调用方可自行决定是否参与图标合成
- `data.fetchedAt`: 当前缓存记录最近一次抓取时间
- 未命中时会先回源 Microlink，再回源 iTab；Microlink 返回的 `data.title`、`data.logo.url` 和 `data.logo.background_color` 会映射到现有返回结构

### Metadata 接口返回

`GET /api/site/metadata?url=https://example.com`

返回结构：

```json
{
  "url": "https://example.com",
  "finalUrl": "https://example.com/",
  "title": "Example Domain",
  "iconUrl": "http://127.0.0.1:9002/cache/example.com.png",
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
- 未命中时调用 iTab `website/info` 接口
- 未命中时优先调用 Microlink API，若 Microlink 没有返回 `logo.url` 再回退到 iTab `website/info`
- 自动下载图标到本地并更新缓存
- 缓存记录超过一个月会自动重新抓取；重抓失败时继续回退已有缓存
- 支持输出 StartDeck 兼容的 metadata 结构
- 支持按指定 `host/url` 强制刷新缓存
- 支持删除指定 `host/url` 的缓存并回退默认数据
- 通过 Rust 运行时环境变量控制端口和数据根目录

## 配置

Rust 图标服务默认读取 `rust/crates/startdeck-iconserver/resources/data` 中的只读种子资源，部署时通过 `ICON_SERVICE_DATA_DIR` 指向可写运行期缓存目录，默认监听 `9002`。服务独立运行，不依赖主服务；主服务通过 HTTP 调用它。常用环境变量：

- `BASE_DIR`: StartDeck 运行根目录，默认由当前工作目录推断。
- `ICON_SERVICE_PORT`: 图标服务监听端口，默认 `9002`。
- `ICON_SERVICE_RESOURCE_DIR`: 图标服务只读种子资源目录，只包含 `seed-data.json` 和默认 `icons/`。Docker 镜像中默认是 `/app/icon-service-defaults/data`。
- `ICON_SERVICE_DATA_DIR`: 图标服务可写运行期数据目录，用于外部挂载 `cache/` 和迁移来的 `cache.json`。未设置时默认使用运行根目录下的 `icon-service/data`。

服务不再读取旧版 `config.json`。若缓存未命中，服务会优先使用只读 seed 数据，再使用运行期 cache 数据；外部回源能力由 Rust 服务实现和部署环境决定。

图标目录分层：

- 默认种子数据图标保存在 `ICON_SERVICE_RESOURCE_DIR/icons`
- 非默认缓存图标保存在 `ICON_SERVICE_DATA_DIR/cache`
- 对外返回地址会保留这个分流，例如 `/icons/www.youtube.com.svg` 或 `/cache/apkdv.com.svg`

## 运行

```bash
cargo run --bin startdeck-iconserver
```

或：

```bash
./startdeck-iconserver
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
cargo build --release --locked --bin startdeck-iconserver
```

## StartDeck 接入

StartDeck server 保持前端 BFF，不直接让前端访问本服务。

在 StartDeck server 环境中配置：

```bash
ICON_SERVER_BASE_URL=http://127.0.0.1:9002
ICON_SERVER_TIMEOUT_MS=5000
```

这样 StartDeck 后端会继续对前端暴露 `/api/site/metadata` 与 `/api/site/icon`，内部再调用本服务。
