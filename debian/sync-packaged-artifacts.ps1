# 将「当前仓库」里刚构建的产物同步到本目录（Debian 离线包 / deploy.sh 所用布局）。
# Rust 默认资源源头位于 crate resources 目录；Data/public 仅作为前端构建输出兼容路径。
# 用法（在仓库根目录）:  powershell -ExecutionPolicy Bypass -File debian/sync-packaged-artifacts.ps1
# 可选: 跳过前端构建 -SkipFrontend   跳过后端构建 -SkipBackend   跳过元数据服务 -SkipMetaServer

param(
    [switch] $SkipFrontend,
    [switch] $SkipBackend,
    [switch] $SkipMetaServer
)

$ErrorActionPreference = "Stop"
$debianRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $debianRoot

if ((-not $SkipBackend) -or (-not $SkipMetaServer)) {
    Push-Location $repoRoot
    try {
        cargo build --release --locked --workspace --bins
    } finally {
        Pop-Location
    }
}

if (-not $SkipBackend) {
    Copy-Item -Force (Join-Path $repoRoot "target\release\startdeck-server") (Join-Path $debianRoot "startdeck-server")
}

if (-not $SkipMetaServer) {
    Copy-Item -Force (Join-Path $repoRoot "target\release\startdeck-metaserver") (Join-Path $debianRoot "startdeck-metaserver")
}

if (-not $SkipFrontend) {
    Push-Location (Join-Path $repoRoot "frontend")
    try {
        npm run build
    } finally {
        Pop-Location
    }
}

$srcPublicCandidates = @(
    (Join-Path $repoRoot "Data\public"),
    (Join-Path $repoRoot "frontend\dist")
)
$srcPublic = $srcPublicCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$dstPublic = Join-Path $debianRoot "Data\public"
if (-not $srcPublic) {
    Write-Error "缺少前端静态目录，请先构建前端。"
}
New-Item -ItemType Directory -Force -Path $dstPublic | Out-Null
robocopy $srcPublic $dstPublic /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { exit $LASTEXITCODE }

$srcServerResources = Join-Path $repoRoot "rust\crates\startdeck-server\resources"
$dstServerResources = Join-Path $debianRoot "startdeck-server\resources"
if (-not (Test-Path $srcServerResources)) {
    Write-Error "缺少 $srcServerResources。"
}
New-Item -ItemType Directory -Force -Path $dstServerResources | Out-Null
robocopy $srcServerResources $dstServerResources /MIR /XF .DS_Store /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { exit $LASTEXITCODE }

$srcMetaData = Join-Path $repoRoot "rust\crates\startdeck-metaserver\resources\data"
$dstMetaData = Join-Path $debianRoot "startdeck-metaserver\resources\data"
if (-not (Test-Path $srcMetaData)) {
    Write-Error "缺少 $srcMetaData。"
}
New-Item -ItemType Directory -Force -Path $dstMetaData | Out-Null
robocopy $srcMetaData $dstMetaData /MIR /XD .gocache /XF .DS_Store /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { exit $LASTEXITCODE }

Write-Host "已同步: startdeck-server + startdeck-metaserver + Data/public + Rust resources -> debian/"
