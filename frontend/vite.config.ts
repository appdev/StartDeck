import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isWindows = process.platform === "win32";
  // 默认本机开发；需手机/局域网访问时设置 VITE_DEV_HOST 为局域网 IP（如 192.168.x.x）。
  const devHost = process.env.VITE_DEV_HOST?.trim() || "127.0.0.1";
  const backendTarget = process.env.VITE_BACKEND || "http://127.0.0.1:9001";
  const backendWsTarget = backendTarget.replace(/^http/i, "ws");
  const isDockerBuild = process.env.VITE_DOCKER_BUILD === "1";
  const appBase = process.env.VITE_APP_BASE_PATH?.trim() || "./";
  // 注意：
  // 1. frontend/public 是静态素材源目录，图标/默认图片等应放这里维护。
  // 2. Data/public 是本地运行时构建输出目录，会被 emptyOutDir 清空后重写。
  // 3. 不要再把 Data/public 当作素材源目录，否则执行构建时素材会被误覆盖。
  const runtimePublicDirAbs = fileURLToPath(
    new URL("../Data/public", import.meta.url),
  );
  const outDir = isDockerBuild ? "dist" : runtimePublicDirAbs;
  return {
    // 默认使用相对 base，避免构建产物在子路径反代下把静态资源写死到站点根目录。
    base: appBase,
    // 始终从 frontend/public 复制静态素材，避免和运行时输出目录耦合。
    publicDir: fileURLToPath(new URL("./public", import.meta.url)),
    build: {
      sourcemap: false,
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        // 避免 UNRESOLVED_IMPORT 被 Vite 转为 throw（依赖中若存在 commonjs external 等会触发）
        onwarn(warning, warn) {
          if (warning.code === "UNRESOLVED_IMPORT") return;
          if (
            typeof warning.message === "string" &&
            warning.message.includes("external")
          )
            return;
          warn(warning);
        },
      },
    },
    plugins: [vue(), mode === "development" && vueDevTools()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 9003,
      host: devHost,
      hmr: {
        host: devHost,
      },
      watch: {
        ignored: ["**/data/**", "**/Data/**"],
        usePolling: isWindows,
        interval: isWindows ? 180 : undefined,
      },
      proxy: {
        // 告诉 Vite：遇到 /api 开头的请求，转给 9001 端口
        "/api": {
          target: backendTarget,
          changeOrigin: true,
        },
        // ✨ Backgrounds 代理
        "/backgrounds": {
          target: backendTarget,
          changeOrigin: true,
        },
        "/mobile_backgrounds": {
          target: backendTarget,
          changeOrigin: true,
        },
        "/icon-cache": {
          target: backendTarget,
          changeOrigin: true,
        },
        // ✨ CGI 代理
        "^.*\\.cgi.*": {
          target: backendTarget,
          changeOrigin: true,
        },
        // ✨ WebSocket 代理（原生 ws）
        "/ws": {
          target: backendWsTarget,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
