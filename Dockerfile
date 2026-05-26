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

# Build frontend into a temporary dist; Rust-owned resource defaults are copied later.
ENV TAILWIND_DISABLE_NATIVE=1
ENV VITE_DOCKER_BUILD=1
RUN npm run build-only

# Stage 2: Build Rust backend and icon service
FROM --platform=$BUILDPLATFORM rust:1.94-bookworm AS rust-builder

ARG HTTP_PROXY
ARG HTTPS_PROXY

ENV HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY \
    CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse \
    CARGO_BUILD_JOBS=1

WORKDIR /app

COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY rust ./rust

RUN cargo build --release --locked --workspace --bins
RUN strip target/release/startdeck-server target/release/startdeck-iconserver

# Stage 3: Runtime files copied into the slim final image.
FROM debian:bookworm-slim AS runtime-deps

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*

# Stage 4: Keep server fallback resources without duplicating public icons.
FROM busybox:1.37.0-glibc AS server-resource-filter

WORKDIR /server-resources
COPY rust/crates/startdeck-server/resources .
RUN rm -rf public/icons

# Stage 5: Keep icon defaults read-only; runtime cache belongs to the mounted data dir.
FROM busybox:1.37.0-glibc AS icon-resource-filter

WORKDIR /icon-resources
COPY rust/crates/startdeck-iconserver/resources/data .
RUN rm -rf cache cache.json

# Stage 6: Final Image
FROM busybox:1.37.0-glibc

ARG QWEATHER_API_HOST=""
ARG QWEATHER_PROJECT_ID=""
ARG QWEATHER_CREDENTIAL_ID=""
ARG QWEATHER_PRIVATE_KEY_FILE=""
ARG TENCENT_MAP_API_HOST=""
ARG TENCENT_MAP_KEY=""

WORKDIR /app

# Runtime dependencies for HTTPS, local timezone, and GCC unwinding symbols used
# by the Debian-built Rust binaries.
COPY --from=runtime-deps /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=runtime-deps /usr/share/zoneinfo/Asia/Shanghai /usr/share/zoneinfo/Asia/Shanghai
COPY --from=runtime-deps /lib/x86_64-linux-gnu/libgcc_s.so.1 /lib/libgcc_s.so.1

# 设置时区和 Gin 模式
ENV TZ=Asia/Shanghai \
    GIN_MODE=release \
    BASE_DIR=/app \
    STARTDECK_SERVER_RESOURCE_DIR=/app/startdeck-server-defaults \
    STARTDECK_PUBLIC_DIR=/app/Data/public \
    DATA_DIR=/app/Data/data \
    MUSIC_DIR=/app/Data/music \
    PC_DIR=/app/Data/PC \
    APP_DIR=/app/Data/APP \
    ICON_SERVICE_DATA_DIR=/app/icon-service/data \
    ICON_SERVICE_RESOURCE_DIR=/app/icon-service-defaults/data \
    PORT=9001 \
    ICON_SERVICE_PORT=9002 \
    ICON_SERVER_BASE_URL=http://127.0.0.1:9002 \
    ICON_SERVER_TIMEOUT_MS=5000 \
    QWEATHER_API_HOST=$QWEATHER_API_HOST \
    QWEATHER_PROJECT_ID=$QWEATHER_PROJECT_ID \
    QWEATHER_CREDENTIAL_ID=$QWEATHER_CREDENTIAL_ID \
    QWEATHER_PRIVATE_KEY_FILE=$QWEATHER_PRIVATE_KEY_FILE \
    TENCENT_MAP_API_HOST=$TENCENT_MAP_API_HOST \
    TENCENT_MAP_KEY=$TENCENT_MAP_KEY

# Copy Rust backend binary
COPY --from=rust-builder /app/target/release/startdeck-server .

# Copy Rust icon service binary, seed data, and startup script.
COPY --from=rust-builder /app/target/release/startdeck-iconserver ./icon-service/startdeck-iconserver
COPY --from=server-resource-filter /server-resources/. ./startdeck-server-defaults
COPY --from=icon-resource-filter /icon-resources/. ./icon-service-defaults/data
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

# Copy frontend dist to public directory
# This includes the built assets and static files copied from frontend/public during build.
COPY --from=frontend-builder /app/frontend/dist ./Data/public

# Create necessary directories for volumes
RUN mkdir -p Data/data Data/public Data/music Data/PC Data/APP Data/doc icon-service/data/cache \
    && chmod +x ./scripts/docker-entrypoint.sh

# Expose port
EXPOSE 9001 9002

# Run the application
CMD ["./scripts/docker-entrypoint.sh"]
