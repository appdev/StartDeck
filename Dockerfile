ARG BUILDPLATFORM=linux/amd64
ARG TARGETOS=linux
ARG TARGETARCH=amd64

# Stage 1: Build Frontend
FROM node:20.19-bookworm-slim AS frontend-builder

# 1. 接收构建参数（代理地址）
ARG HTTP_PROXY
ARG HTTPS_PROXY

# 2. 设置环境变量
ENV HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY \
    NPM_CONFIG_REGISTRY=https://registry.npmmirror.com

WORKDIR /app

WORKDIR /app/frontend

# Copy package files first to cache dependencies
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY frontend/ .

# Build frontend (使用 server/public 作为 publicDir，与上方 COPY 一致)
ENV TAILWIND_DISABLE_NATIVE=1
ENV VITE_DOCKER_BUILD=1
RUN npm run build-only

# Stage 2: Build Rust backend and icon service
FROM --platform=$BUILDPLATFORM rust:1.94-bookworm AS rust-builder

ARG HTTP_PROXY
ARG HTTPS_PROXY

ENV HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY \
    CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse

WORKDIR /app

COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY rust ./rust

RUN cargo build --release --locked --workspace --bins

# Stage 3: Final Image
FROM alpine:latest

WORKDIR /app

# Install necessary runtime dependencies
# tzdata is important for correct timezone handling
RUN apk --no-cache add ca-certificates tzdata

# 设置时区和 Gin 模式
ENV TZ=Asia/Shanghai \
    GIN_MODE=release \
    BASE_DIR=/app \
    PORT=9001 \
    ICON_SERVICE_PORT=9002 \
    ICON_SERVER_BASE_URL=http://127.0.0.1:9002 \
    ICON_SERVER_TIMEOUT_MS=5000

# Copy Rust backend binary
COPY --from=rust-builder /app/target/release/startdeck-server .

# Copy Rust icon service binary, seed data, and startup script.
COPY --from=rust-builder /app/target/release/startdeck-iconserver ./icon-service/startdeck-iconserver
COPY icon-service/data ./icon-service-defaults/data
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

# Copy frontend dist to public directory
# This includes the built assets and the static files copied from server/public during build
COPY --from=frontend-builder /app/frontend/dist ./server/public

# Create necessary directories for volumes
RUN mkdir -p server/data server/music server/PC server/APP server/icon-cache icon-service/data/icons icon-service/data/cache \
    && chmod +x ./scripts/docker-entrypoint.sh

# Expose port
EXPOSE 9001 9002

# Run the application
CMD ["./scripts/docker-entrypoint.sh"]
