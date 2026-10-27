<#
.SYNOPSIS
  把 AI待办软件更新到仓库里的最新版本，并生成新的安装包。

.DESCRIPTION
  依次做这几件事：
    1. 检查环境（Node / pnpm / 仓库位置）
    2. 从远程拉取最新代码（可选，离线时用 -Offline 跳过）
    3. 检查并修复依赖（Electron 二进制、扁平 node_modules）
    4. 跑类型检查与测试（可用 -SkipTests 跳过）
    5. 构建并打包出 NSIS 安装包
    6. 启动安装包做覆盖升级（安装程序会自动保留 %APPDATA% 里的数据）

.PARAMETER Offline
  不执行 git pull，只用当前工作区的代码打包。

.PARAMETER SkipTests
  跳过类型检查与测试，直接打包（更快，但不保证代码正确）。

.PARAMETER NoLaunch
  打完包不自动启动安装程序，只告诉你路径。

.PARAMETER Force
  工作区有未提交改动时也继续（默认会停下询问）。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\更新.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\更新.ps1 -SkipTests -NoLaunch
#>

[CmdletBinding()]
param(
  [switch]$Offline,
  [switch]$SkipTests,
  [switch]$NoLaunch,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Say([string]$Message, [string]$Color = 'Gray') {
  Write-Host $Message -ForegroundColor $Color
}

function Fail([string]$Message) {
  Write-Host ""
  Write-Host "✗ $Message" -ForegroundColor Red
  Write-Host ""
  exit 1
}

function Step([string]$Message) {
  Write-Host ""
  Write-Host "── $Message " -ForegroundColor Cyan -NoNewline
  Write-Host ('─' * [Math]::Max(2, 60 - $Message.Length)) -ForegroundColor DarkGray
}

# ── 0. 定位仓库 ────────────────────────────────────────────────
$repo = $PSScriptRoot
if (-not (Test-Path (Join-Path $repo 'package.json'))) {
  Fail "脚本要放在 AI待办软件 仓库根目录下运行。当前目录：$repo"
}
Push-Location $repo

try {
  Step '检查环境'

  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  $node = if ($nodeCmd) { $nodeCmd.Source } else { $null }
  if (-not $node) { Fail '没找到 node。请先装 Node.js 22 或更高版本：winget install OpenJS.NodeJS.LTS' }
  $nodeVersion = (& node --version).Trim()
  Say "node           $nodeVersion" 'DarkGray'

  $pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
  $pnpm = if ($pnpmCmd) { $pnpmCmd.Source } else { $null }
  if (-not $pnpm) {
    Fail '没找到 pnpm。安装方式：npm install -g pnpm（或 corepack enable）'
  }
  $pnpmVersion = (& pnpm --version).Trim()
  Say "pnpm           $pnpmVersion" 'DarkGray'

  $version = (Get-Content 'package.json' -Raw -Encoding UTF8 | ConvertFrom-Json).version
  Say "当前代码版本   $version" 'DarkGray'

  # 这个环境变量会让 Electron 以纯 Node 启动，必须去掉
  if ($env:ELECTRON_RUN_AS_NODE) {
    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    Say '已清除 ELECTRON_RUN_AS_NODE（它会让 Electron 起不来）' 'DarkGray'
  }

  # 网络镜像：GitHub 直连常被挡，用国内镜像更稳
  if (-not $env:ELECTRON_MIRROR) { $env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/' }
  if (-not $env:ELECTRON_BUILDER_BINARIES_MIRROR) {
    $env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
  }
  # 没有代码签名证书，跳过自动发现，否则会卡住
  $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'

  # ── 1. 拉取最新代码 ──────────────────────────────────────────
  if (-not $Offline) {
    Step '拉取最新代码'

    $dirty = & git status --porcelain
    if ($dirty -and -not $Force) {
      Say '工作区有未提交的改动：' 'Yellow'
      $dirty | Select-Object -First 10 | ForEach-Object { Say "  $_" 'DarkGray' }
      Say ''
      Say '这些改动会被 git pull 影响。要继续请加 -Force，或先自己提交/暂存。' 'Yellow'
      Fail '已停止（未做任何修改）'
    }

    & git pull --ff-only
    if ($LASTEXITCODE -ne 0) {
      Say 'git pull 失败（可能是网络或分支冲突）。' 'Yellow'
      Say '可以先 -Offline 用当前代码打包，或手动处理后再来。' 'Yellow'
      Fail '拉取代码失败'
    }
    $version = (Get-Content 'package.json' -Raw -Encoding UTF8 | ConvertFrom-Json).version
    Say "更新后版本     $version" 'Green'
  } else {
    Say '已跳过 git pull（-Offline）' 'DarkGray'
  }

  # ── 2. 依赖 ──────────────────────────────────────────────────
  Step '检查依赖'

  $electronExe = Join-Path $repo 'node_modules\electron\dist\electron.exe'
  $needInstall = -not (Test-Path 'node_modules') -or -not (Test-Path $electronExe)

  if ($needInstall) {
    Say '依赖不完整，开始安装（第一次会比较慢）…' 'DarkGray'

    # 必须用扁平布局：符号链接结构下 Electron 启动会崩
    & pnpm install --config.node-linker=hoisted --config.confirmModulesPurge=false
    if ($LASTEXITCODE -ne 0) { Fail 'pnpm install 失败，请把上面的报错发给我' }

    if (-not (Test-Path $electronExe)) {
      Say 'Electron 二进制没下全，单独补一次…' 'DarkGray'
      & node 'node_modules/electron/install.js'
      if ($LASTEXITCODE -ne 0) { Fail 'Electron 下载失败，检查网络或镜像设置' }
    }
  } else {
    Say '依赖已就绪（跳过安装）' 'DarkGray'
  }

  if (-not (Test-Path $electronExe)) { Fail 'Electron 二进制仍然缺失，无法打包' }

  # ── 3. 检查 ──────────────────────────────────────────────────
  if (-not $SkipTests) {
    Step '类型检查'
    & pnpm typecheck
    if ($LASTEXITCODE -ne 0) { Fail '类型检查没过，代码有问题，不打包' }

    Step '单元测试'
    & pnpm test
    if ($LASTEXITCODE -ne 0) { Fail '测试没过，不打包' }

    Step '组件测试'
    & pnpm test:ui
    if ($LASTEXITCODE -ne 0) { Fail '组件测试没过，不打包' }
  } else {
    Say '已跳过检查（-SkipTests）' 'DarkGray'
  }

  # ── 4. 构建与打包 ────────────────────────────────────────────
  Step '构建渲染进程与主进程'
  & pnpm build
  if ($LASTEXITCODE -ne 0) { Fail '构建失败' }

  Step '打包安装程序'
  & pnpm exec electron-builder --win nsis --config electron-builder.yml
  if ($LASTEXITCODE -ne 0) { Fail '打包失败，看上面的报错' }

  $setup = Get-ChildItem (Join-Path $repo 'release') -Filter '*setup.exe' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $setup) { Fail '没找到生成的安装包' }

  $sizeMb = [Math]::Round($setup.Length / 1MB, 1)

  Step '完成'
  Say "安装包   $($setup.FullName)" 'Green'
  Say "大小     $sizeMb MB" 'DarkGray'
  Say "版本     $version" 'DarkGray'
  Say "生成时间 $($setup.LastWriteTime)" 'DarkGray'
  Say ''
  Say '安装说明：' 'Cyan'
  Say '  · 直接运行上面这个 exe 即可覆盖升级，会自动装到原来的位置'
  Say '  · 你的数据在 %APPDATA%\AI待办软件，升级不会动它'
  Say '  · 如果弹出「已保护你的电脑」，点「更多信息 → 仍要运行」（没有代码签名证书）'

  if (-not $NoLaunch) {
    Say ''
    Say '正在启动安装程序…' 'Cyan'
    Start-Process -FilePath $setup.FullName
  } else {
    Say ''
    Say '（-NoLaunch）没有自动启动，你需要自己双击它。' 'DarkGray'
  }
}
finally {
  Pop-Location
}
