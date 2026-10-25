# AI待办软件

本地优先的日程 + 待办桌面应用：一周课表一眼看清，任务清单随手勾掉。数据全部存在自己电脑上，不注册账号、不上传云端。

## 环境要求

- **Node.js ≥ 22**（仓库里 `.nvmrc` 钉的是 22）
- **pnpm ≥ 11**

Windows 上从零开始装：

```powershell
winget install --id OpenJS.NodeJS.LTS -e
# 关掉终端重新打开，然后：
corepack enable
corepack prepare pnpm@latest --activate
node -v
pnpm -v
```

## 快速开始

```bash
pnpm install
pnpm dev
```

首次安装如果卡在 Electron 下载，设置镜像后重试：

```bash
# Windows (PowerShell)
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
pnpm install
```

> **pnpm 11 注意**：构建脚本白名单在 `pnpm-workspace.yaml` 的 `onlyBuiltDependencies` 里，不要在 `package.json` 里写 `pnpm` 字段（pnpm 11 已不读取）。非交互环境（CI）需要 `CI=true`。

> **`ELECTRON_RUN_AS_NODE` 陷阱**：如果环境里设了 `ELECTRON_RUN_AS_NODE=1`（某些 IDE、容器或代理工具会设），Electron 会以纯 Node 模式启动，表现为 `Cannot read properties of undefined (reading 'whenReady')`。启动前先清掉：
>
> ```powershell
> Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
> ```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动开发模式（主进程 + 渲染进程热更新） |
| `pnpm build` | 产出生产构建到 `out/` |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | 单元测试（node 环境） |
| `pnpm test:ui` | 组件测试（jsdom 环境） |
| `pnpm e2e` | Playwright 驱动真实 Electron 的端到端测试 |

`pnpm e2e` **只在本地和发布前跑**，不进 CI（Linux runner 需要 xvfb，Windows runner 太慢）。

## 目录结构

```
src/
├─ shared/      主进程与渲染进程共用：纯函数与类型，零依赖
├─ main/        Electron 主进程：窗口、数据库、仓储、IPC
├─ preload/     contextBridge，向渲染进程暴露 window.api
└─ renderer/    React 界面
test/           Vitest 单元测试
test-ui/        Vitest 组件测试
e2e/            Playwright 端到端
scripts/        一次性验证脚本（如 SQLite 探针）
```

## 数据库

使用 **`node-sqlite3-wasm`**（SQLite 的 WebAssembly 构建）：不引入原生模块，**不需要编译器工具链**，也不挑 Electron 版本。

> 为什么不用 `node:sqlite`：它要求 Electron ≥ 35，而本项目实测 **Electron ≥ 35 在本机启动即崩**（`0x80000003`），只有 33 可用；Electron 33 带的是 Node 20，没有 `node:sqlite`。详见下面的「已知限制」。

驱动封装在 `src/main/db/driver.ts`，对外只暴露 `prepare / exec / pragma / transaction / close`，换底层只改这一个文件。

## 已知限制（重要）

### 1. Electron 必须锁在 33

`package.json` 里 `electron` 固定为 `33.4.11`。实测 **35 / 40 / 42 / 45 启动即崩溃**（Windows 事件日志：`electron.exe` 异常代码 `0xc0000005`，退出码 `-2147483645`），33 正常。已用同一二进制在不同目录做过对照，排除路径与安装损坏。

升级 Electron 前，必须先在目标机器上跑一遍 `scripts/probe-window.cjs` 确认能开窗。

### 2. `.npmrc` 必须保留 `node-linker=hoisted`

pnpm 默认用符号链接农场（`node_modules/.pnpm`）组织依赖。**Electron 在这种结构下启动会崩**，改成扁平的真实目录才正常。删掉 `.npmrc` 会重现崩溃。

### 3. `ELECTRON_RUN_AS_NODE` 必须清掉

见上文「快速开始」里的说明。

### 4. 高 DPI 下窗口尺寸会取整

150% 缩放下请求 `1000×700` 实际得到 `1002×702`。端到端测试断言窗口尺寸时用容差（±4），不要写成精确相等。

## 参与贡献

见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可

[MIT](./LICENSE)