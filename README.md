<p align="center">
  <img src="favicon.svg" alt="StartDeck 图标" width="96" height="96" />
</p>

# StartDeck

[![GitHub](https://img.shields.io/badge/GitHub-StartDeck-181717?style=flat&logo=github&logoColor=white)](https://github.com/appdev/StartDeck)
[![Docker Image](https://img.shields.io/badge/Docker-apkdv%2Fstartdeck-2496ED?style=flat&logo=docker&logoColor=white)](https://hub.docker.com/r/apkdv/startdeck)
[![License](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)

StartDeck 是一套面向 NAS、家庭服务器与个人工作流的自托管浏览器起始页。它将站点入口、组件化信息面板、系统状态、Docker 管理、智能图标识别和网络访问策略整合为一个可长期运行、可迁移、可备份的个人工作台。

![StartDeck 首页工作台](frontend/public/intro-assets/startdeck-home-real.jpg)

## 产品定位

StartDeck 不是简单的书签页，而是面向自托管场景的浏览器工作台。它适用于需要集中管理内网服务、公网入口、开发工具、个人日程、轻量运维信息和常用 API 服务的用户。

核心目标：

- **统一入口**：集中管理站点、分组、搜索引擎、内网地址与公网地址。
- **自托管数据**：布局、书签、组件配置、上传资源和运行缓存保存在用户自己的服务器中。
- **组件化桌面**：通过网格布局组合天气、日历、待办、备忘录、番茄时钟、Docker、系统状态、AI 使用量、TAPD 缺陷等组件。
- **智能元数据**：自动识别站点标题、描述和图标，并通过独立元数据服务维护内置图标库与运行期缓存。
- **运维友好**：提供系统状态、Docker 容器状态、IP 与网络信息、版本检查等自托管常用能力。
- **可扩展**：支持自定义 HTML/CSS/JS 组件、iframe 组件、全局自定义 CSS 和运行时脚本。

## 功能概览

| 模块         | 能力                                                                                 |
| ------------ | ------------------------------------------------------------------------------------ |
| 首页与导航   | 网格布局、站点卡片、分组管理、搜索引擎切换、编辑模式、移动端适配                     |
| 组件系统     | 时钟、天气、纪念日、日历、壁纸、备忘录、待办、番茄时钟、今日诗词、今日英语、电影日历 |
| 工具组件     | 本机 IP、金额换算、今天吃什么、AI 使用量、TAPD 缺陷                                  |
| 系统组件     | Docker 容器状态、系统状态、CPU/内存/磁盘信息                                         |
| 图标与元数据 | 独立 Rust 元数据服务、站点标题识别、描述识别、图标缓存、内置图标库                     |
| 网络访问     | 内网/公网地址配置、客户端 IP 信息、访问域名识别、延迟探测、反向代理适配              |
| 个性化       | 桌面端壁纸、移动端壁纸、卡片背景、图标背景色、上传图标、全局 CSS                     |
| 数据管理     | SQLite 本地存储、运行目录集中挂载、配置导入导出、版本恢复                            |
| 权限与安全   | 管理员登录、多用户管理、Docker Socket 可选挂载、外部服务凭证本地保存                 |

## 界面预览

| 天气组件                                                              | 待办组件                                                           | AI 使用量                                                                   | TAPD 缺陷                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| ![天气组件界面](frontend/public/intro-assets/widget-weather-real.jpg) | ![待办组件界面](frontend/public/intro-assets/widget-todo-real.jpg) | ![AI 使用量组件界面](frontend/public/intro-assets/widget-ai-usage-real.jpg) | ![TAPD 缺陷组件界面](frontend/public/intro-assets/widget-tapd-real.jpg) |

## 架构概览

StartDeck 由 Vue 前端、Rust 主服务和 Rust 元数据服务组成。Docker 镜像会同时启动主服务和元数据服务，生产环境通常只需要对外暴露主服务端口。

```text
Browser
  |
  | HTTP / WebSocket
  v
Vue 3 Frontend
  |
  | /api, static assets
  v
Rust startdeck-server
  |
  | SQLite, runtime files, Docker socket, icon API
  v
Rust startdeck-metaserver
```

- **Frontend**：Vue 3、TypeScript、Pinia、GridStack，负责首页、设置、组件运行态和交互。
- **Backend**：Rust + Axum，提供认证、配置持久化、站点元数据、代理、Docker、系统状态、天气/IP 等接口。
- **MetaServer**：独立 Rust 服务，负责站点元数据识别、图标库和图标缓存。
- **Storage**：SQLite 保存配置和运行数据，`Data/` 保存上传资源、背景图和元数据服务缓存。

## 部署方案

生产环境推荐直接使用 Docker Hub 镜像 `apkdv/startdeck:latest`。不建议在生产服务器上通过源码构建部署；源码构建更适合本地开发、镜像发布和问题排查。

当前 Docker Hub 发布工作流面向 `linux/amd64` 架构。ARM 服务器或其他架构需要确认运行环境是否支持该镜像，或自行发布对应架构镜像。

### Docker Compose 推荐配置

1. 准备目录和环境变量：

```bash
mkdir -p /opt/startdeck
cd /opt/startdeck

cat > .env <<'EOF'
STARTDECK_ADMIN_PASSWORD=change-me
STARTDECK_SECRET=replace-with-a-stable-random-secret
EOF
```

2. 创建 `compose.yml`：

```yaml
services:
  startdeck:
    image: apkdv/startdeck:latest
    container_name: startdeck
    restart: unless-stopped
    ports:
      - "9001:9001"
    env_file:
      - .env
    environment:
      PORT: "9001"
      HOST: "0.0.0.0"
      META_SERVER_PORT: "9002"
      META_SERVER_DATA_DIR: /app/Data/meta-service
      META_SERVER_RESOURCE_DIR: /app/meta-service-defaults/data
      META_SERVER_BASE_URL: http://127.0.0.1:9002
      META_SERVER_TIMEOUT_MS: "5000"
      QWEATHER_API_HOST: "${QWEATHER_API_HOST:-}"
      QWEATHER_PROJECT_ID: "${QWEATHER_PROJECT_ID:-}"
      QWEATHER_CREDENTIAL_ID: "${QWEATHER_CREDENTIAL_ID:-}"
      QWEATHER_PRIVATE_KEY_FILE: "${QWEATHER_PRIVATE_KEY_FILE:-}"
      TENCENT_MAP_API_HOST: "${TENCENT_MAP_API_HOST:-}"
      TENCENT_MAP_KEY: "${TENCENT_MAP_KEY:-}"
    volumes:
      - ./Data:/app/Data
      - /var/run/docker.sock:/var/run/docker.sock
```

如不使用 Docker 管理组件，请删除 `/var/run/docker.sock` 挂载。该挂载权限较高，仅应在可信服务器上启用。

3. 拉取并启动：

```bash
docker compose pull
docker compose up -d
docker compose logs -f startdeck
```

访问地址：

```text
http://<server-ip>:9001
```

默认管理员用户名为 `admin`。生产环境必须设置 `STARTDECK_ADMIN_PASSWORD`，并在首次登录后修改为长期使用的强密码。

### Docker CLI 快速启动

适合临时验证或单机快速部署：

```bash
docker run -d \
  --name startdeck \
  --restart unless-stopped \
  -p 9001:9001 \
  -v "$PWD/Data:/app/Data" \
  -e PORT=9001 \
  -e HOST=0.0.0.0 \
  -e STARTDECK_ADMIN_PASSWORD=change-me \
  -e STARTDECK_SECRET=replace-with-a-stable-random-secret \
  -e META_SERVER_PORT=9002 \
  -e META_SERVER_DATA_DIR=/app/Data/meta-service \
  -e META_SERVER_RESOURCE_DIR=/app/meta-service-defaults/data \
  -e META_SERVER_BASE_URL=http://127.0.0.1:9002 \
  -e META_SERVER_TIMEOUT_MS=5000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  apkdv/startdeck:latest
```

### 升级

升级前建议备份 `Data` 目录：

```bash
cd /opt/startdeck
docker compose down
tar -czf "startdeck-data-$(date +%F).tar.gz" Data
docker compose pull
docker compose up -d
```

升级后可检查主服务和元数据服务：

```bash
curl -fsS http://127.0.0.1:9001/healthz
docker compose logs --tail=100 startdeck
```

### 数据目录与备份

默认运行数据集中挂载在 `Data/`：

```text
Data/data/startdeck.sqlite3        # 布局、书签、组件配置、用户与系统配置
Data/data/users/                   # 用户配置数据
Data/PC/                           # 桌面端背景图
Data/APP/                          # 移动端背景图
Data/meta-service/                 # 元数据服务运行期缓存和数据
```

迁移到新服务器时，停止旧容器后复制整个 `Data` 目录，并在新服务器使用相同挂载路径启动。

### 反向代理

反向代理需要转发 HTTP 与 WebSocket：

- 应用入口：`/`
- API：`/api/*`
- WebSocket：`/ws`
- 图标与缓存：`/icons/*`、`/cache/*`、`/icon-cache/*`
- 背景图：`/backgrounds/*`、`/mobile_backgrounds/*`
- 代理接口：`/proxy`

子路径部署建议将完整路径转发到同一个容器端口，并保留 WebSocket Upgrade 头。前端默认使用相对资源路径，可适配常见子路径反代；如需要固定构建路径，请在构建阶段设置 `VITE_APP_BASE_PATH`。

### 环境变量

| 变量                                                      | 默认值                            | 说明                                                 |
| --------------------------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| `HOST`                                                    | `0.0.0.0`                         | 主服务监听地址                                       |
| `PORT`                                                    | `9001`                            | 主服务监听端口                                       |
| `STARTDECK_ADMIN_PASSWORD`                                | `admin`                           | 初始化或同步管理员密码                               |
| `STARTDECK_SECRET`                                        | 基于 SQLite 路径派生              | JWT 签名密钥；生产环境建议显式设置并长期保持稳定     |
| `STARTDECK_DATA_DIR` / `DATA_DIR`                         | `/app/Data/data`                  | SQLite 与运行数据目录                                |
| `STARTDECK_PC_DIR` / `PC_DIR`                             | `/app/Data/PC`                    | 桌面端背景图目录                                     |
| `STARTDECK_APP_DIR` / `APP_DIR`                           | `/app/Data/APP`                   | 移动端背景图目录                                     |
| `STARTDECK_PUBLIC_DIR` / `PUBLIC_DIR`                     | `/app/startdeck-public`           | 前端静态资源目录                                     |
| `STARTDECK_SERVER_RESOURCE_DIR`                           | `/app/startdeck-server-defaults`  | 主服务只读默认资源目录                               |
| `META_SERVER_PORT`                                       | `9002`                            | 元数据服务监听端口                                     |
| `META_SERVER_DATA_DIR`                                   | `/app/Data/meta-service`          | 元数据服务可写数据目录                                 |
| `META_SERVER_RESOURCE_DIR`                               | `/app/meta-service-defaults/data` | 元数据服务只读种子资源目录                             |
| `META_SERVER_BASE_URL`                                    | `http://127.0.0.1:9002`           | 主服务访问元数据服务的地址                             |
| `META_SERVER_TIMEOUT_MS`                                  | `5000`                            | 元数据服务请求超时时间                                 |
| `META_SERVER_MICROLINK_API_URL`                           | `https://api.microlink.io`        | 元数据服务优先使用的网站媒体信息接口；空值表示禁用      |
| `PUBLIC_META_BASE_URL`                                    | 空                                | 对外返回图标 URL 时使用的公共基础地址                |
| `DOCKER_HOST`                                             | 空                                | Docker API 地址；默认使用挂载的 Docker Socket        |
| `WALLPAPER_WHITELIST`                                     | Bing 相关域名                     | 壁纸代理额外允许的域名列表，支持逗号、分号或换行分隔 |
| `TENCENT_MAP_KEY` / `TENCENT_MAP_API_KEY`                 | 内置默认 Key                      | 腾讯地图 IP 定位 Key                                 |
| `TENCENT_MAP_API_HOST`                                    | `https://apis.map.qq.com`         | 腾讯地图 API Host                                    |
| `QWEATHER_API_HOST` / `QWEATHER_GEO_API_HOST`             | 空                                | QWeather GeoAPI Host                                 |
| `QWEATHER_PROJECT_ID`                                     | 空                                | QWeather 项目 ID                                     |
| `QWEATHER_CREDENTIAL_ID`                                  | 空                                | QWeather 凭证 ID                                     |
| `QWEATHER_PRIVATE_KEY_FILE` / `QWEATHER_PRIVATE_KEY_PATH` | 空                                | QWeather Ed25519 私钥文件路径                        |
| `STARTDECK_AI_USAGE_OPENAI_BASE_URL`                      | `https://chatgpt.com`             | AI 使用量组件访问 OpenAI/ChatGPT 的基础地址          |
| `STARTDECK_TAPD_BASE_URL`                                 | `https://api.tapd.cn`             | TAPD 缺陷组件访问 TAPD API 的基础地址                |

QWeather 需要同时配置 Host、项目 ID、凭证 ID 和私钥文件才会启用。私钥建议通过只读 volume 或 Docker secret 挂载，不要写入镜像或仓库。

### Debian / Ubuntu 脚本

仓库中仍保留 `deploy_debian.sh` 和 `manage.sh`，用于需要 systemd + Nginx 的自管理部署。但生产推荐路径已经调整为 Docker Hub 镜像部署。除非明确需要二进制包和 systemd 方式，否则不要优先使用源码或 Release 包脚本部署。

## 本地开发

### 环境要求

- Node.js `^20.19.0` 或 `>=22.12.0`
- Rust `1.94`
- npm

### 启动开发环境

```bash
cd frontend
npm ci
npm run start:hot
```

也可以分开启动：

```bash
# 终端 1：元数据服务
npm --prefix frontend run meta-server

# 终端 2：主服务
npm --prefix frontend run server:hot

# 终端 3：前端开发服务器
npm --prefix frontend run dev
```

默认端口：

| 服务          | 地址                    |
| ------------- | ----------------------- |
| 前端 Vite     | `http://127.0.0.1:9003` |
| StartDeck API | `http://127.0.0.1:9001` |
| MetaServer    | `http://127.0.0.1:9002` |

### 常用命令

```bash
# 前端
cd frontend
npm run build
npm test
npm run test:e2e
npm run lint

# 后端
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo run --bin startdeck-server
cargo run --bin startdeck-metaserver
```

### 本地容器构建

根目录的 `docker-compose.yml` 面向本地构建和容器路径验证，默认构建 `startdeck:local`：

```bash
docker compose up --build
```

Docker 构建默认使用国内可访问性更好的 Node 与 Rust 镜像源：

| 构建参数                    | 默认值                                                | 作用                            |
| --------------------------- | ----------------------------------------------------- | ------------------------------- |
| `NPM_CONFIG_REGISTRY`       | `https://registry.npmmirror.com`                      | `npm ci` 包下载                 |
| `NPM_CONFIG_DISTURL`        | `https://npmmirror.com/mirrors/node`                  | Node 二进制、headers 等下载     |
| `STARTDECK_CRATES_IO_INDEX` | `sparse+https://mirrors.ustc.edu.cn/crates.io-index/` | Cargo crates.io sparse registry |
| `RUSTUP_DIST_SERVER`        | `https://mirrors.ustc.edu.cn/rust-static`             | Rust toolchain 下载             |
| `RUSTUP_UPDATE_ROOT`        | `https://mirrors.ustc.edu.cn/rust-static/rustup`      | rustup 元数据下载               |

如需切回官方源或使用企业内网源，可通过环境变量覆盖：

```bash
NPM_CONFIG_REGISTRY=https://registry.npmjs.org \
STARTDECK_CRATES_IO_INDEX=sparse+https://index.crates.io/ \
docker compose build
```

这些参数只影响容器构建过程中的 Node/Rust 依赖下载；基础镜像 `node:*`、`rust:*`、`debian:*`、`busybox:*` 的拉取仍由 Docker daemon 的 registry mirror 配置控制。

## 目录结构

```text
frontend/                                  # Vue 3 frontend
  src/components/                          # UI components
  src/features/                            # Runtime widgets and feature modules
  src/stores/                              # Pinia stores
  public/                                  # Source static assets
rust/crates/startdeck-server/              # Main Rust backend
rust/crates/startdeck-metaserver/          # Site metadata service
rust/crates/startdeck-core/                # Shared SQLite/domain code
Data/                                      # Runtime data and generated public assets
debian/                                    # Debian/Ubuntu packaging and service files
Dockerfile
docker-compose.yml
```

## 发布前检查

```bash
cd frontend
npm run build
npm test

cd ..
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
docker compose up --build
```

涉及页面、组件、拖拽、移动端布局或浏览器交互的改动，应额外执行 Playwright 或浏览器验收。

## 官网发布

官网源文件是 [`frontend/public/intro.html`](frontend/public/intro.html)，GitHub Pages workflow 是 [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)。

推送到 `main` 后，workflow 会把官网页发布到 <https://appdev.github.io/StartDeck/>，并保留 `/intro.html` 入口。首次启用时需要在 GitHub 仓库 `Settings -> Pages` 中选择 `GitHub Actions` 作为发布来源。

## 项目地址

- GitHub: <https://github.com/appdev/StartDeck>
- Docker Hub: <https://hub.docker.com/r/apkdv/startdeck>
- 官网: <https://appdev.github.io/StartDeck/>

## License

StartDeck is released under the [GNU AGPLv3](LICENSE).
