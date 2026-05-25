# 将「当前仓库」里刚构建的产物同步到本目录（Debian 离线包 / deploy.sh 所用布局）。
# 默认资源源头位于 Rust crate 的 resources 目录，server/public 仅作为运行时构建输出兼容路径。
# 用法（在仓库根目录）:  powershell -ExecutionPolicy Bypass -File debian/sync-packaged-artifacts.ps1
# 可选: 跳过前端构建 -SkipFrontend   跳过后端构建 -SkipBackend   跳过图标服务 -SkipIconService

param(
    [switch] $SkipFrontend,
    [switch] $SkipBackend,
    [switch] $SkipIconService
)

$ErrorActionPreference = "Stop"
$debianRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $debianRoot

if ((-not $SkipBackend) -or (-not $SkipIconService)) {
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

if (-not $SkipIconService) {
    Copy-Item -Force (Join-Path $repoRoot "target\release\startdeck-iconserver") (Join-Path $debianRoot "startdeck-iconserver")
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
    (Join-Path $repoRoot "server\public"),
    (Join-Path $repoRoot "frontend\dist"),
    (Join-Path $repoRoot "rust\crates\startdeck-server\resources\public")
)
$srcPublic = $srcPublicCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$dstPublic = Join-Path $debianRoot "server\public"
if (-not $srcPublic) {
    Write-Error "缺少前端静态目录，请先构建前端或检查 Rust resources。"
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

$srcIconData = Join-Path $repoRoot "rust\crates\startdeck-iconserver\resources\data"
$dstIconData = Join-Path $debianRoot "startdeck-iconserver\resources\data"
if (-not (Test-Path $srcIconData)) {
    Write-Error "缺少 $srcIconData。"
}
New-Item -ItemType Directory -Force -Path $dstIconData | Out-Null
robocopy $srcIconData $dstIconData /MIR /XD .gocache /XF .DS_Store /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { exit $LASTEXITCODE }

Write-Host "已同步: startdeck-server + startdeck-iconserver + server/public + Rust resources -> debian/"
