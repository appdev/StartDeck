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

# Stage 2: Build Backend
FROM --platform=$BUILDPLATFORM golang:alpine AS backend-builder

# 接收构建参数
ARG HTTP_PROXY
ARG HTTPS_PROXY
# Go Proxy 设置，默认使用 goproxy.cn
ARG GOPROXY=https://goproxy.cn,direct

ENV HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY \
    GOPROXY=$GOPROXY

WORKDIR /app/backend

# Copy go mod files
COPY backend/go.mod backend/go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY backend/ .

# Build binary
# Use ARG TARGETOS and TARGETARCH to support cross-compilation
ARG TARGETOS=linux
ARG TARGETARCH=amd64
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -ldflags="-s -w" -o startdeck-backend .

# Stage 3: Build Icon Service
FROM --platform=$BUILDPLATFORM golang:alpine AS icon-service-builder

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG GOPROXY=https://goproxy.cn,direct

ENV HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY \
    GOPROXY=$GOPROXY

WORKDIR /app/icon-service

COPY icon-service/go.mod ./

RUN go mod download

COPY icon-service/ .

ARG TARGETOS=linux
ARG TARGETARCH=amd64
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -ldflags="-s -w" -o startdeck-iconserver .

# Stage 4: Final Image
FROM alpine:latest

WORKDIR /app

# Install necessary runtime dependencies
# tzdata is important for correct timezone handling
RUN apk --no-cache add ca-certificates tzdata

# 设置时区和 Gin 模式
ENV TZ=Asia/Shanghai \
    GIN_MODE=release \
    BASE_DIR=/app \
    ICON_SERVER_BASE_URL=http://127.0.0.1:8080 \
    ICON_SERVER_TIMEOUT_MS=5000

# Copy backend binary
COPY --from=backend-builder /app/backend/startdeck-backend .

# Copy icon service binary, config, seed data, and startup script.
COPY --from=icon-service-builder /app/icon-service/startdeck-iconserver ./icon-service/startdeck-iconserver
COPY icon-service/config.json ./icon-service/config.json
COPY icon-service/data ./icon-service-defaults/data
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

# Copy frontend dist to public directory
# This includes the built assets and the static files copied from server/public during build
COPY --from=frontend-builder /app/frontend/dist ./server/public

# Create necessary directories for volumes
RUN mkdir -p server/data server/music server/PC server/APP server/doc server/icon-cache icon-service/data/icons icon-service/data/cache \
    && chmod +x ./scripts/docker-entrypoint.sh

# Expose port
EXPOSE 3000 8080

# Run the application
CMD ["./scripts/docker-entrypoint.sh"]
