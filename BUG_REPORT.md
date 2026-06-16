# 测试 Bug 单

## BUG-001：PC 管理端快速导航时接口偶发 500，导致 E2E 首次执行失败

- 严重级别：P1
- 状态：已修复，待持续观察
- 发现日期：2026-06-13
- 影响范围：PC 管理端 E2E、管理端接口稳定性
- 关联测试计划：`zany-orbiting-puzzle.md`、`TEST_PLAN.md`

## 测试执行记录

已执行：

- `pnpm db:init`：通过
- `pnpm db:seed`：通过
- `pnpm verify:all`：首次失败
- `pnpm exec playwright test e2e/pc-admin.spec.js -g "菜单和顶部标签点击后都能切换页面" --project=pc-admin`：重跑通过
- `pnpm e2e`：重跑通过，8 passed
- `pnpm verify:all`：最终重跑通过，8 passed

首次失败位置：

- 测试文件：`e2e/pc-admin.spec.js`
- 用例：`PC 管理端核心交互 > 菜单和顶部标签点击后都能切换页面`
- 断言位置：`e2e/helpers.js` 中 `watchPageErrors().expectNoErrors()`

## 失败现象

首次执行 `pnpm verify:all` 时，PC 管理端快速点击侧边栏和顶部标签过程中，浏览器控制台捕获到 3 次接口 500，并出现 `请求失败`。Playwright 因页面错误集合不为空而失败。

失败摘要：

```text
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
请求失败
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
请求失败
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
请求失败
```

Trace 中定位到的 500 接口：

- `GET http://127.0.0.1:5173/api/admin/bootstrap`
- `GET http://127.0.0.1:5173/api/admin/bootstrap`
- `GET http://127.0.0.1:5173/api/admin/stores`

失败产物：

- `test-results/pc-admin-PC-管理端核心交互-菜单和顶部标签点击后都能切换页面-pc-admin/trace.zip`
- `test-results/pc-admin-PC-管理端核心交互-菜单和顶部标签点击后都能切换页面-pc-admin/test-failed-1.png`
- `test-results/pc-admin-PC-管理端核心交互-菜单和顶部标签点击后都能切换页面-pc-admin/error-context.md`

## 当前复现情况

失败后直接访问接口均返回 200：

- `GET http://127.0.0.1:3000/api/admin/bootstrap`
- `GET http://127.0.0.1:3000/api/admin/stores`
- `GET http://127.0.0.1:5173/api/admin/bootstrap`
- `GET http://127.0.0.1:5173/api/admin/stores`

随后单用例重跑、完整 `pnpm e2e` 重跑、完整 `pnpm verify:all` 重跑均通过，因此该问题目前表现为偶发稳定性风险，而不是稳定必现缺陷。

## 初步判断

PC 管理端 `AdminLayout` 挂载时会触发 `loadBootstrap()`，部分页面自身也会在挂载时请求列表数据。该用例会快速切换多个路由，可能在短时间内触发多个 `/api/admin/bootstrap` 与页面列表请求。首次失败集中在快速导航阶段，疑似与以下因素有关：

- 前端快速切页导致重复/并发请求，未做请求去重或取消后的错误抑制。
- Vite 代理或后端开发服务在并发请求/服务冷启动阶段偶发返回 500。
- 后端接口错误响应为纯文本，前端只能展示通用 `请求失败`，缺少可诊断的错误码和服务端日志上下文。

## 建议修复方向

- 已给 PC 管理端的 `loadBootstrap()` 增加请求复用和缓存，避免每次相关页面挂载都触发重复 bootstrap 请求。
- 已给 Web 管理端 GET 请求增加一次短暂 5xx 重试，用于缓解开发服务或代理瞬时抖动。
- 在 PC 管理端快速路由切换场景中，对已过期请求做取消或忽略，避免旧页面请求失败污染当前页面。
- 原 H5/uni-admin 管理端功能已迁移到微信小程序内嵌管理端，后续验证范围不再包含 H5/支付宝/头条管理端构建。
- 后端开发环境对 `/api/admin/bootstrap`、`/api/admin/stores` 增加结构化错误日志，记录 SQL 错误、请求 ID、操作者 ID。
- Playwright 用例可增加网络响应监听，失败时输出具体 URL、状态码和响应体，减少后续排查成本。
- 如果后续仍偶发，建议对 `pnpm e2e` 连续运行 5 到 10 次，确认波动概率。

## 修复记录

- `pc-admin/src/composables/useBootstrap.js`：增加 bootstrap 请求缓存、进行中请求复用和 `force` 刷新入口。
- 原 `uni-admin/src/shared/bootstrap.js` 的移动管理能力已迁移到 `miniprogram/pages/admin/admin.js`，小程序管理端通过 `/admin/bootstrap` 加载门店、项目和技师选项。
- `packages/admin-shared/src/web.js`：GET 请求遇到 `500/502/503/504` 时短暂等待后重试一次。

## 修复后验证

- 历史记录：`pnpm verify:all` 曾通过 PC/H5/支付宝/头条管理端构建，Playwright 8 passed。
- 当前验证范围：H5/支付宝/头条管理端已移除，后续以 `pnpm build:pc`、`pnpm e2e`、`pnpm verify:all` 与小程序管理端手工验证为准。
- `pnpm exec playwright test e2e/pc-admin.spec.js -g "菜单和顶部标签点击后都能切换页面" --project=pc-admin --repeat-each=5`：通过，5 passed。

## 非阻塞构建警告

`pnpm verify:all` 最终通过，但 PC 构建存在非阻塞警告：

- `@vueuse/core` 中 `/* #__PURE__ */` 注释位置无法被 Rollup 解释，构建时会移除该注释。
- `element-*.js` chunk 超过 500 kB，建议后续评估更细粒度拆包或调整 chunk 限制。

这些警告当前未导致测试失败，但可作为性能与构建噪音优化项跟进。
