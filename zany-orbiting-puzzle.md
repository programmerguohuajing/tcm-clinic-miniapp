# tcm-clinic-miniapp 生产级测试计划

## Context

当前项目是“微信小程序用户端 + 小程序内嵌管理端 + Node/Express 后端 + PC 管理端”的 monorepo，已具备预约、健康档案、订单管理、经营看板、内容营销等 MVP 闭环。原 H5/多端管理端已移除，移动管理能力统一由微信小程序内嵌管理端承载。

本计划目标是建立可重复、可自动化、可进入 CI 门禁的测试体系，使核心业务在发版前能被稳定验证，并为后续接入真实微信登录、JWT、支付、对象存储等生产能力预留质量基线。

## 现状基线

- 根目录 `package.json` 已有：
  - `build:pc`
  - `build:admin`
  - `e2e`
  - `e2e:ui`
  - `verify:all`
- `verify:all` 当前执行 PC 管理端构建并运行 Playwright E2E。
- `playwright.config.js` 当前已有：
  - `testDir: ./e2e`
  - `pc-admin` 项目
  - 自动启动 API 与 PC 管理端
  - 失败保留 trace、screenshot、video
- 现有 E2E 文件：
  - `e2e/pc-admin.spec.js`
  - `e2e/helpers.js`
- 小程序原生页面无法直接由当前 Playwright 配置覆盖，需通过微信开发者工具执行手工验证清单。
- 当前缺口：后端单元测试、后端集成测试、测试数据库初始化脚本、CI workflow、明确覆盖率门槛与 P0 场景断言。

## 推荐测试分层

### 1. 后端单元测试

覆盖核心业务函数和边界逻辑，优先围绕：

- `backend/src/services/booking-service.js`
  - 预约创建成功
  - 排班不存在
  - 排班容量不足
  - 重复/非法参数
  - 事务回滚
  - 并发预约不超卖的内部逻辑
- `backend/src/middleware`
  - `x-demo-user-id` 识别
  - 管理权限边界
  - 非法身份拒绝
- 后端参数校验与统一错误结构。

建议引入 `vitest` 或 Node 原生 test runner；若后续希望更丰富的 mock、覆盖率与 watch 体验，优先选 `vitest`。

### 2. 后端集成测试

基于真实测试数据库启动 Express 应用，直接请求 API，重点验证路由、数据库、事务和权限的组合行为。

优先覆盖：

- 预约下单 API
- 排班库存并发 API
- 管理端 CRUD API
- 订单状态流转 API
- 健康档案 API
- 经营看板统计 API
- 管理端写操作是否写入 `admin_audit_logs`

并发预约必须放在集成测试中通过多请求竞争验证，不依赖 UI E2E。

### 3. PC 管理端页面与组件测试

PC 管理端优先覆盖：

- `pc-admin/src/views/StoresView.vue`
- `pc-admin/src/views/UsersView.vue`
- `pc-admin/src/views/ReviewsView.vue`
- `pc-admin/src/views/AuditView.vue`
- `pc-admin/src/components/DataTable.vue`

如果当前项目不想立即引入组件测试框架，可以先用 Playwright 覆盖页面级行为，后续再补 Vitest + Vue Test Utils。

### 4. 小程序管理端手工测试

小程序管理端集中在 `miniprogram/pages/admin/admin.*`，需要通过微信开发者工具验证：

- 管理入口权限
- 经营看板
- 多门店
- 服务项目
- 技师管理
- 技师排班
- 预约订单
- 提成结算
- 首页配置
- 内容营销
- 会员权限
- 评价管理
- 操作日志
- 门店筛选、刷新、横向 tab、通用编辑弹层、订单状态操作

### 5. E2E 测试

保留并扩展现有 Playwright 体系，继续复用：

- `playwright.config.js`
- `e2e/helpers.js` 中的 `watchPageErrors` 与 `expectLoaded`

新增或扩展场景：

- PC 管理端冒烟：登录/身份初始化、看板加载、门店列表、用户列表、审计日志列表。
- 管理端写操作闭环：新增/编辑关键资源后，在审计日志中能看到对应记录。
- 用户预约闭环：门店展示 → 服务选择 → 排班选择 → 创建预约 → 管理端订单可见。

小程序原生自动化作为后续阶段引入；当前阶段以手工验证清单作为发版补充。

## 测试数据与环境

### 测试数据库

新增独立测试数据库配置，禁止复用开发库或生产库。

建议新增：

- `.env.test` 或等价测试环境变量
- `backend/scripts/seed-test-db.js`
- 根脚本 `db:seed:test`
- 可选脚本 `db:reset:test`

测试数据应具备确定性，并覆盖：

- 多门店
- 通用数据 `store_id is null`
- 多服务
- 多医师
- 多排班
- 低库存/满库存排班
- 普通用户
- 管理员用户
- 历史预约
- 健康档案
- 内容配置
- 审计日志基线数据

### 测试隔离

- 单元测试不依赖真实服务端口。
- 集成测试每个 suite 前重置核心表数据。
- E2E 每次运行前执行测试库 reset/seed。
- 并发测试使用唯一排班数据，避免和其他测试互相污染。

## P0 生产级核心场景

### 预约与库存

- 用户可以创建预约。
- 同一排班并发创建预约时，成功数不能超过容量。
- 库存不足时返回明确错误。
- 预约失败时不产生脏订单、不扣减错误容量。
- 非法门店、服务、医师、排班组合被拒绝。

### 管理端与审计

- 管理端关键写操作成功后必须写入 `admin_audit_logs`。
- 审计日志包含操作者、动作、资源类型、资源 ID、时间等必要信息。
- 普通用户不能访问管理端写接口。
- 缺失或非法 `x-demo-user-id` 时行为明确且可测试。

### 小程序管理端覆盖

- 小程序管理端覆盖原移动管理端全部模块。
- 每个模块都有加载态、空态或列表反馈。
- 通用编辑弹层能提交主要新增/编辑场景。
- 订单确认、核销、取消流程可用。
- 首页配置 JSON 输入错误时应提示并阻止提交。

### 构建与运行

- PC 管理端可构建。
- API health 可访问。
- Playwright E2E 在干净环境可稳定通过。
- 小程序管理端手工验证清单通过。

## 建议修改/新增文件

### 根目录

- 修改 `package.json`
  - 新增 `test:unit`
  - 新增 `test:integration`
  - 新增 `test:e2e` 或保留 `e2e` 并统一命名
  - 新增 `lint`（如暂不引入，可先设为后续阶段）
  - 升级 `verify:all`：先跑单元/集成，再构建与 E2E
- 修改 `playwright.config.js`
  - 增加测试前数据库 reset/seed 流程
  - 按需增加用户端或 API 基础 URL
  - 保留失败 trace、screenshot、video
- 新增 `.github/workflows/ci.yml`
  - PR 门禁执行 P0 自动化
  - main 分支执行全量验证

### 后端

- 新增 `backend/tests/unit`
- 新增 `backend/tests/integration`
- 新增 `backend/scripts/seed-test-db.js`
- 可选新增 `backend/scripts/reset-test-db.js`
- 修改 `backend/package.json`
  - 增加后端测试脚本
  - 增加测试数据库初始化脚本

### E2E

- 扩展 `e2e/pc-admin.spec.js`
- 复用并按需扩展 `e2e/helpers.js`
- 新增代表性用户预约闭环 spec，例如 `e2e/booking-flow.spec.js`

### 小程序验证

- 在 `TEST_PLAN.md` 维护小程序管理端手工验证清单。
- 后续如引入微信开发者工具自动化，再新增对应脚本和 CI 任务。

## CI 门禁策略

### PR 必跑

- 依赖安装校验
- 后端单元测试
- 后端集成测试 P0
- PC 管理端构建
- 管理端基础 E2E 冒烟

### main 分支必跑

- 完整 `verify:all`
- 全量 Playwright E2E
- 覆盖率报告
- Playwright HTML report、trace、screenshot、video 归档

### 覆盖率门槛

初始建议：

- 后端核心服务行覆盖率不低于 70%。
- `booking-service.js` 分支覆盖率不低于 80%。
- P0 API 集成测试覆盖率必须稳定。

后续目标：

- 后端核心服务逐步提升到 85%。
- 预约、订单、审计相关逻辑必须保持高覆盖。

## 分阶段落地路线

### 第一阶段：测试基础设施

- 引入测试框架。
- 建立测试数据库与 seed/reset 脚本。
- 增加根测试脚本。
- 调整 `verify:all`。
- 建立 CI workflow。

验收：干净环境能执行测试数据库初始化，并跑通最小测试集。

### 第二阶段：后端 P0 自动化

- 覆盖预约创建。
- 覆盖并发预约不超卖。
- 覆盖管理权限。
- 覆盖审计日志。
- 覆盖订单状态流转。

验收：后端 P0 单元与集成测试稳定通过，并能捕获库存超卖和审计遗漏。

### 第三阶段：PC 管理端与小程序管理端

- 扩展 PC 管理端 E2E。
- 完善小程序管理端手工验证清单。
- 对小程序管理端 12 个模块建立固定验收用例。

验收：PC 自动化稳定，小程序管理端手工验证可重复执行。

### 第四阶段：生产能力接入后的回归

接入真实微信登录、JWT、支付、对象存储后，新增专项测试：

- 微信登录授权失败/成功。
- JWT 过期与刷新。
- 支付成功、失败、回调重放、退款。
- 文件上传权限和访问控制。
- 生产 CORS、HTTPS、安全头。

## 验收标准

- `pnpm install`、`pnpm build:pc`、`pnpm e2e`、`pnpm verify:all` 可在干净环境通过。
- 后端 P0 API 有自动化覆盖。
- PC 管理端关键页面 E2E 稳定。
- 小程序管理端 12 个模块手工验证通过。
- 管理端关键写操作均有审计日志。
- 测试失败时能提供明确日志、trace 或截图，便于定位。
