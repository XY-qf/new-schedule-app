# 贡献指南

## 分支

从 `main` 切出，命名带前缀：

| 前缀 | 用途 |
| --- | --- |
| `feat/` | 新功能 |
| `fix/` | 缺陷修复 |
| `chore/` | 构建、依赖、配置 |
| `docs/` | 文档 |
| `test/` | 只改测试 |

例：`feat/week-view`、`fix/now-line-offset`。

## 提交信息

采用 Conventional Commits：

```
<type>: <简短描述>
```

| type | 含义 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 修缺陷 |
| `test` | 增删改测试 |
| `chore` | 杂务（依赖、脚手架） |
| `refactor` | 重构（不改行为） |
| `docs` | 文档 |

## 提 PR 之前

本地必须全绿：

```bash
pnpm typecheck && pnpm test && pnpm test:ui
```

涉及窗口、托盘、通知的改动，再跑一次 `pnpm e2e`。

## PR 要求

- 描述写清**改了什么、为什么改**，关联相关 issue。
- 勾选 PR 模板里的自查项。
- CI（typecheck + 单测 + 组件测）必须绿。
- 至少 1 人 review 通过后合并，合并前不要自行 push 到 `main`。

## 不要提交

`node_modules/`、`out/`、`*.db`、`.env`、任何 API Key、任何含本机绝对路径的配置。