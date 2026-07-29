# 青囊中医馆小程序

一个全栈中医馆管理平台，包含微信小程序用户端 + 内嵌管理端 + Node.js/Express 后端 + PC 管理端。

## 架构

```
tcm-clinic-miniapp/
├── backend/                    # Node.js + Express API 服务端
│   ├── src/
│   │   ├── routes/             # REST API 路由
│   │   ├── middleware/         # 认证、限流、错误处理
│   │   └── config/             # 数据库连接池、环境配置
│   └── database/               # SQL 建表脚本、迁移、种子数据
├── miniprogram/                # 微信小程序（用户端 + 管理端）
│   ├── pages/
│   │   ├── home/               # 首页（服务展示、文章、活动）
│   │   ├── booking/            # 预约下单流程
│   │   ├── health/             # 健康档案管理
│   │   ├── profile/            # 个人中心、订单、会员信息
│   │   ├── admin/              # 内嵌管理控制台
│   │   ├── technician/         # 技师工作台
│   │   └── ...                 # 13+ 功能页面
│   └── utils/                  # 请求封装、常量、Mock 数据
├── pc-admin/                   # PC 管理端仪表盘（Vite + 原生）
└── packages/
    └── admin-shared/           # 共享类型定义、API 契约、枚举
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js, Express, Zod 校验, PostgreSQL |
| 小程序 | 微信原生小程序框架 |
| PC 管理端 | Vite, 原生 TypeScript |
|  Monorepo | pnpm workspaces |

## 核心功能

### 用户端
- **首页** — 服务展示、养生文章、营销活动、门店信息
- **预约** — 服务选择、技师选择、时段选择、订单确认
- **健康档案** — 中医体质评估、症状记录、舌诊图片、脉象记录
- **个人中心** — 订单历史、会员等级与积分、优惠券、消息、收藏、设置
- **订单管理** — 订单详情、取消预约、支付、评价提交、改期
- **会员体系** — 积分、等级进阶、会员权益
- **优惠券与收藏** — 促销优惠券、收藏的门店/技师
- **内容中心** — 养生文章、营销活动、消息通知

### 管理控制台（内嵌于小程序）
- **经营看板** — 营业额、订单量、技师、用户数指标及排行
- **多门店管理** — 门店 CRUD、默认门店切换
- **服务项目管理** — 项目定价、时长、上下架
- **技师管理** — 技师档案、擅长方向、状态管理
- **排班管理** — 单条排班 + 批量生成，含容量控制
- **预约订单** — 订单列表、状态操作（确认/核销/取消）
- **提成结算** — 按技师/项目/业绩门槛配置提成比例
- **首页配置** — 基于 Section 的首页布局配置
- **内容营销** — 活动与文章管理
- **会员与权限** — 角色管理（店主/前台/管理员/普通会员）
- **评价管理** — 评价审核、门店回复
- **支付配置** — 微信支付参数、模拟支付开关、超时设置
- **操作日志** — 管理员操作审计追踪

### 技师工作台
- 排班概览、提成查看

## 快速开始

### 环境要求

- Node.js >= 18
- PostgreSQL >= 14
- pnpm >= 11
- 微信开发者工具（用于小程序开发）

### 后端启动

```bash
# 安装依赖
pnpm install

# 初始化数据库（建表 + 种子数据）
pnpm db:init

# 启动开发服务
pnpm dev:api
```

### 小程序

1. 打开 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入 `miniprogram/` 目录
3. 在 `miniprogram/project.config.json` 中配置 AppID
4. 确保后端 API 地址与环境一致

### PC 管理端

```bash
pnpm dev:pc
```

### 演示模式

后端支持通过 `x-demo-user-id` 请求头跳过鉴权的演示模式，开发环境设置 `NODE_ENV=development` 即可启用。

## 数据库设计

项目使用 PostgreSQL，覆盖以下核心实体：

- **用户与会员** — 个人资料、角色、会员等级、积分
- **门店** — 多门店支持、默认门店逻辑
- **服务项目** — 中医理疗项目与定价
- **技师** — 员工档案、擅长方向、多门店执业
- **排班** — 时段管理、容量控制、预约锁
- **预约订单** — 状态流转（待确认→已确认→已完成→已取消/已退款）
- **健康档案** — 中医体质评估与调理建议
- **评价** — 评分评价系统
- **内容** — 文章、活动、优惠券
- **提成规则** — 按项目/技师/业绩门槛配置
- **首页配置** — 灵活的 Section 化首页布局
- **操作日志** — 管理端操作审计
- **支付配置** — 按门店配置支付方式

## 项目结构

```
backend/
├── src/
│   ├── app.js                    # Express 应用配置、路由注册
│   ├── config/
│   │   ├── db.js                 # PostgreSQL 连接池
│   │   └── env.js                # 环境变量、特性开关
│   ├── middleware/
│   │   ├── auth.js               # JWT 认证、角色鉴权
│   │   ├── async-handler.js      # 异步错误处理
│   │   └── rate-limit.js         # 接口限流
│   └── routes/
│       ├── admin.js              # 管理端全部 API 路由
│       ├── catalog.js            # 公开目录接口
│       ├── orders.js             # 用户端订单管理
│       ├── reviews.js            # 用户评价
│       ├── content.js            # 文章、活动、优惠券
│       ├── user.js               # 用户资料、支付、消息、技师详情
│       └── favorites.js          # 用户收藏
├── database/
│   ├── schema.sql                # 全部表定义
│   ├── comments.sql              # 表与字段说明
│   ├── migrate_favorites.sql     # user_favorites + messages 表
│   ├── migrate_payment_configs.sql # payment_configs 表
│   ├── seed.sql                  # 演示数据
│   └── seed_messages.sql         # 演示消息
├── scripts/
│   ├── init-db.js                # 建表 + 迁移执行器
│   └── seed-db.js                # 种子数据执行器
└── package.json

miniprogram/
├── pages/
│   ├── home/                     # 首页
│   ├── booking/                  # 预约
│   ├── health/                   # 健康档案
│   ├── profile/                  # 个人中心
│   ├── admin/                    # 管理控制台
│   ├── technician/               # 技师工作台
│   ├── order-detail/             # 订单详情
│   ├── order-cancel/             # 取消确认
│   ├── order-pay/                # 支付
│   ├── order-review/             # 评价提交
│   ├── order-reschedule/         # 改期
│   ├── article-detail/           # 文章阅读
│   ├── activity-detail/          # 活动详情
│   ├── messages/                 # 消息中心
│   ├── coupons/                  # 优惠券中心
│   ├── store-detail/             # 门店详情
│   ├── member/                   # 会员权益
│   ├── settings/                 # 设置
│   └── favorites/                # 收藏管理
├── utils/
│   ├── request.js                # API 请求封装（含降级）
│   ├── constants.js              # 状态文本映射
│   └── mock-data.js              # 离线演示数据
├── app.json                      # 小程序配置
├── app.wxss                      # 全局样式
└── sitemap.json

pc-admin/
├── src/                          # PC 管理端源码
├── index.html
├── vite.config.js
└── package.json
```

## 开发命令

```bash
# 启动后端开发服务
pnpm dev:api

# 启动 PC 管理端开发服务
pnpm dev:pc

# 初始化数据库
pnpm db:init

# 填充种子数据
pnpm db:seed

# 全量验证
pnpm verify:all
```

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

MIT
