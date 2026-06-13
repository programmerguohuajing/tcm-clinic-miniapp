# 青囊中医馆小程序

这是根据桌面上的《中医馆小程序功能需求说明.md》搭建的前后端工程，覆盖“预约 + 分销/提成基础 + 健康管理 + 内嵌管理端”的 MVP 骨架。

## 技术栈

- 小程序前端：微信原生小程序
- 后端：Node.js + Express
- 数据库：PostgreSQL
- 数据校验：Zod
- 数据访问：node-postgres `pg`
- 管理端 PC：Vue 3 + Vite + Element Plus
- 管理端 H5/多端：uni-app + Vue 3，可面向 H5、支付宝小程序、抖音小程序构建
- 工作区：pnpm workspace，`pc-admin` 与 `uni-admin` 复用 `packages/admin-shared` 的接口定义、状态枚举与格式化方法

## 目录结构

```text
D:\code\tcm-clinic-miniapp
├─ backend                 后端 REST API
│  ├─ database             PostgreSQL schema 与演示数据
│  ├─ scripts              初始化与种子脚本
│  └─ src                  Express 应用源码
├─ miniprogram             微信小程序源码
├─ packages
│  └─ admin-shared         管理端共享接口定义、请求适配、常量与格式化方法
├─ pc-admin                PC 管理端，Element Plus 桌面后台
├─ uni-admin               H5/支付宝/抖音小程序管理端，uni-app 跨端后台
├─ pnpm-workspace.yaml     pnpm workspace 配置
└─ project.config.json     微信开发者工具项目配置
```

## 已实现功能

- 用户端：首页活动、养生资讯、项目/技师/排班筛选预约、预约成功页
- 用户端：健康档案新增与历史记录、个人中心、订单列表、家庭成员列表、邀请分享入口
- 管理端：小程序内嵌管理页、经营看板、订单列表、订单核销
- 后端：项目、技师、排班、预约、健康档案、个人中心、管理看板、订单状态 API
- 数据库：用户、家庭成员、服务项目、技师、排班、预约、提成规则、结算单、活动、资讯、优惠券、健康档案表

## 本地启动

1. 安装依赖：

```bash
cd /d D:\code\tcm-clinic-miniapp
pnpm install
```

2. 准备 PostgreSQL 数据库：

```sql
create database tcm_clinic;
```

3. 创建后端环境变量：

```bash
copy backend\.env.example backend\.env
```

按需修改 `backend\.env` 中的 `DATABASE_URL`。

4. 初始化表结构并写入演示数据：

```bash
pnpm db:init
pnpm db:seed
```

5. 启动后端：

```bash
pnpm dev:api
```

健康检查：

```bash
curl http://localhost:3000/health
```

6. 打开小程序：

用微信开发者工具导入 `D:\code\tcm-clinic-miniapp`，AppID 可先使用测试号或游客模式。开发阶段已关闭合法域名校验，接口默认请求 `http://127.0.0.1:3000/api`。

7. 启动 PC 管理端：

```bash
pnpm dev:pc
```

默认访问 `http://127.0.0.1:5173/pc-admin/`，本地开发时会把 `/api` 代理到 `http://127.0.0.1:3000`。

8. 启动 H5 管理端：

```bash
pnpm dev:h5-admin
```

默认访问 `http://127.0.0.1:5175/h5-admin/`，同样通过 `/api` 代理本地后端。

## 管理端多端构建

```bash
pnpm build:pc
pnpm build:h5-admin
pnpm build:mp-alipay-admin
pnpm build:mp-toutiao-admin
```

`packages/admin-shared` 中的 `createAdminApi(request)` 是接口定义唯一来源，PC 端通过 `fetch` 适配，uni-app 端通过 `uni.request` 适配。后续新增接口时优先改共享包，再由 `pc-admin` 与 `uni-admin` 引用，避免两套管理端重复维护。

## API 摘要

- `GET /api/activities` 活动推荐
- `GET /api/articles` 养生资讯
- `GET /api/services` 服务项目
- `GET /api/practitioners?serviceId=1` 技师列表
- `GET /api/schedules?practitionerId=1&date=2026-06-12` 可约排班
- `POST /api/appointments` 创建预约
- `GET /api/me/appointments` 我的预约
- `GET /api/health-records` 健康档案列表
- `POST /api/health-records` 新增健康档案
- `GET /api/profile/summary` 个人中心概览
- `GET /api/admin/dashboard` 管理看板
- `GET /api/admin/orders` 管理端订单
- `PATCH /api/admin/orders/:id/status` 更新订单状态

## 后续接入建议

- 微信登录：把 `backend/src/middleware/auth.js` 的开发期 `x-demo-user-id` 替换为 `wx.login` 换取 `openid` + JWT。
- 微信支付：在预约创建后增加支付单，接入 JSAPI 支付与回调，更新 `payment_status`。
- 文件存储：健康档案舌诊/脉诊图片建议接腾讯云 COS 或微信云存储。
- 权限体系：管理端正式上线前需要角色权限，至少区分用户、技师、管理员。
- 小程序类目：医疗健康相关能力上线前需确认资质；若走生活服务/保健类目，功能文案和审核材料要更克制。
