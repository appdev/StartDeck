# Static Assets

`debian/Data/public` 是 Debian 离线包的运行时静态目录镜像。

源码默认公共资源位于 `rust/crates/startdeck-server/resources/public`，前端构建素材仍位于 `frontend/public`。

注意：
- `Data/public` 和 `debian/Data/public` 都是运行时/发布包输出目录，不是源码资源目录。
- 请通过 `debian/sync-packaged-artifacts.ps1` 或构建流程同步，不要在这里手工维护默认资源。
