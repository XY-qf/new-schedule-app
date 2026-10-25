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

使用 **Electron 内置的 Node `node:sqlite`**（`DatabaseSync`），不引入任何原生模块，因此**不需要编译器工具链**。

## 参与贡献

见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可

[MIT](./LICENSE)