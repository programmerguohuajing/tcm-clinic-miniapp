# 项目级 Agent 协作指南

## 基本约定

- 默认使用中文与项目维护者沟通，解释问题时优先给出结论、影响范围和可执行下一步。
- 本仓库包含中文文档、SQL 注释和界面文案；读取、写入或重写含中文的文本文件时，始终显式使用 UTF-8 编码。
- 在 PowerShell 中处理中文文件时优先使用 `Get-Content -Encoding utf8`、`Set-Content -Encoding utf8`、`Add-Content -Encoding utf8`、`Out-File -Encoding utf8`，输出中文前先设置 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`。
- 修改含中文文件后，立即用 UTF-8 重新读取确认没有乱码。
- 查找文件、搜索文本、定位符号、分析调用关系、理解项目结构前，先检查仓库根目录是否存在 `.codegraph`。当前仓库已存在 `.codegraph`，应优先使用 CodeGraph；只有结果不足或工具不适用时再回退到限定路径搜索，并说明回退原因。

## 项目定位

这是一个中医馆预约与管理系统 MVP，覆盖用户端微信原生小程序、技师端、微信小程序内嵌管理端、Express REST API、PostgreSQL 数据库、PC 管理后台，以及 Playwright E2E。

核心业务域：

- 用户端：首页门店与内容展示、服务项目/技师/排班选择、预约下单、预约成功页。
- 用户端个人能力：健康档案、家庭成员、个人中心、订单列表。
- 技师端：技师工作台、我的排班、我的提成。
- 管理端：经营看板、多门店、服务项目、技师、排班、订单核销、提成规则、首页配置、活动/文章、会员权限、评价、操作日志。
- 数据层：用户、门店、家庭成员、项目、技师、技师-门店、技师-项目、排班、预约、优惠券、健康档案、评价、提成、首页配置、审计日志。

## 目录职责

- `backend/`：Express API、数据库脚本和生产静态托管入口。
- `backend/src/app.js`：组合中间件、静态资源、健康检查和 `/api` 路由。
- `backend/src/routes/`：业务 REST 路由，公开端与管理端都在这里。
- `backend/src/services/booking-service.js`：预约排班可用性和下单核心逻辑，改预约规则时优先看这里。
- `backend/database/schema.sql`：表结构；`seed.sql`：演示数据；`comments.sql`：数据库中文注释。
- `miniprogram/`：微信原生小程序用户端、技师端和内嵌管理端。
- `miniprogram/pages/admin/`：小程序内嵌管理端，覆盖原移动管理端功能。
- `miniprogram/utils/request.js`：小程序请求封装，默认带 token 与开发期 `x-demo-user-id`。
- `miniprogram/utils/mock-data.js`：接口失败时的用户端兜底演示数据。
- `packages/admin-shared/`：PC 管理端共享接口、常量和格式化工具。
- `pc-admin/`：Vue 3 + Vite + Element Plus PC 管理后台，包含管理员视角和技师本人工作台。
- `e2e/`：Playwright 端到端测试，覆盖 PC 管理端。

## 技术栈与运行命令

- 包管理器：`pnpm@11.1.2`，workspace 包括 `backend`、`pc-admin`、`packages/*`。
- 后端：Node.js ESM、Express、Zod、node-postgres、dotenv、helmet、cors、morgan。
- PC 管理端：Vue 3、Vite、Vue Router、Element Plus。
- 小程序端：微信原生小程序。
- E2E：Playwright，默认使用 `C:/Program Files/Google/Chrome/Application/chrome.exe`，可通过 `E2E_CHROME_PATH` 覆盖。

常用命令：

```bash
pnpm install
pnpm db:init
pnpm db:seed
pnpm dev:api
pnpm dev:pc
pnpm build:pc
pnpm e2e
pnpm verify:all
```

本地服务默认地址：

- API 健康检查：`http://127.0.0.1:3000/health`
- PC 管理端：`http://127.0.0.1:5173/pc-admin/`
- 小程序接口默认：`http://127.0.0.1:3000/api`

## 后端约定

- API 统一挂载在 `/api` 下，`attachDemoUser` 会根据 `x-demo-user-id` 注入 `req.user`，默认用户 ID 为 `1`。
- 管理端路由在 `backend/src/routes/admin.js`，通过 `adminRouter.use("/admin", requireAdmin)` 保护，需要 `users.can_manage = true`。
- 所有入参优先使用 Zod 校验；新增接口应保持 `res.json({ data })` 响应形态，便于前端 request 适配复用。
- 数据库访问统一走 `backend/src/config/db.js` 的 `query` 或 `pool`，慢查询超过 250ms 会在非测试环境打印警告。
- 公开端门店筛选通常允许 `store_id = 指定门店 or store_id is null`，管理端门店筛选通常只看指定门店；新增 SQL 时要区分这两类语义。
- 修改预约、排班、订单状态时，要同步检查 `appointments`、`schedules`、`commission_rules`、`commission_settlements` 的影响，避免只改列表不改业务闭环。
- 修改表结构后同步更新 `schema.sql`、必要的 `seed.sql` 和 `comments.sql`，再执行 `pnpm db:init && pnpm db:seed` 验证。

## 管理端约定

- PC 管理端继续通过 `packages/admin-shared/src/admin-api.js` 维护接口定义；小程序管理端直接使用 `miniprogram/utils/request.js` 请求 `/api/admin/*`。
- PC 管理端路由与导航分离：路由在 `pc-admin/src/router/index.js`，导航项在 `pc-admin/src/constants/nav.js`。新增页面时两边都要检查。
- PC 管理端页面通过 `AdminLayout` 下发 `storeId` 与刷新事件；列表页通常 `watch(() => props.storeId, load)`，新增页面要保留门店切换刷新能力。
- PC 管理端通用表格、弹窗和提示优先复用 `DataTable.vue`、`FormDialog.vue`、`PageSection.vue`、`StatusPill.vue`、`useCrudEditor.js`、`useToast.js`。
- 小程序管理端集中在 `miniprogram/pages/admin/admin.*`，采用“横向模块 tabs + 门店筛选 + 列表卡片 + 通用编辑弹层”的移动端模式。
- 首页配置的 JSON 字段会 `JSON.parse`，新增字段时要给出合法 JSON 默认值，并考虑错误提示。

## 用户小程序约定

- 用户端使用微信原生小程序结构，页面在 `miniprogram/pages/*`。
- 小程序请求统一通过 `miniprogram/utils/request.js`，响应默认解包 `response.data.data ?? response.data`。
- 当前是开发期演示鉴权，所有请求会带 `x-demo-user-id`；正式接入微信登录时，应替换 `backend/src/middleware/auth.js` 与前端请求头逻辑。
- 多个用户页有 mock 兜底，接口失败时会展示演示数据或演示订单。修复真实接口时不要误删兜底，除非已确认产品不再需要离线演示。
- 门店选择存储在 `getApp().globalData.storeId`，首页选店会影响项目、技师、排班筛选。

## 验证策略

- 后端接口或数据库变更：至少运行 `pnpm db:init`、`pnpm db:seed`，并启动 `pnpm dev:api` 访问 `/health`。
- PC 管理端变更：运行 `pnpm build:pc`；涉及页面交互时再跑 `pnpm e2e -- --project=pc-admin` 或完整 `pnpm e2e`。
- 小程序管理端变更：用微信开发者工具手工验证管理端入口、12 个模块、门店筛选、通用编辑弹层和订单状态操作。
- 全量发版前优先使用 `pnpm verify:all`，它会构建 PC 管理端并运行 E2E；小程序原生页面需补充手工验证记录。

## 常见风险

- 不要把公开端和管理端的门店过滤逻辑混用：公开端要能展示通用内容，管理端通常需要明确门店归属。
- 不要依赖终端默认编码处理中文 SQL、README、界面文案或本文件。
- 不要遍历 `node_modules`、`.postgres-data`、`playwright-report`、`test-results` 做项目理解，优先用 CodeGraph 或限定路径搜索。
- 不要把医疗健康文案写得像诊断结论；用户侧文案应保持“调理、建议、需线下复核”的克制表达。
- 不要在正式能力未接入前假设已有微信登录、微信支付、文件存储或细粒度 RBAC；当前这些仍是后续接入项。
