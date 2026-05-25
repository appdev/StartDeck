# Static Assets

`rust/crates/startdeck-server/resources/public` 是 Rust 主后端拥有的默认公共资源目录。

请把这些文件放在这里维护：
- 图标
- 默认壁纸
- 固定图片素材
- `favicon.svg`
- `favicon.ico` 仅保留给旧浏览器兼容

注意：
- `frontend/public` 仍是 Vue 前端构建时的静态素材源目录。
- `server/public` 是运行时/发布包构建输出目录，不是源码资源目录。
- Windows 本地执行前端构建时，会清空并重写 `server/public`。
- 如果直接修改 `server/public`，下次构建时这些改动可能会被覆盖。
