## 改了什么

<!-- 一句话说清这次改动 -->

## 为什么

<!-- 关联 issue，「Fixes #12」之类 -->

## 自查

- [ ] 本地 `pnpm typecheck && pnpm test && pnpm test:ui` 通过
- [ ] 涉及窗口/托盘/通知的改动已跑 `pnpm e2e`
- [ ] 没有提交 `node_modules/`、`out/`、`*.db`、`.env`、API Key
- [ ] 代码里没有写死本机绝对路径
- [ ] 新增函数有对应测试，且是先写测试后写实现