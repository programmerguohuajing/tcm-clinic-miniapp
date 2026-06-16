# 青囊中医馆小程序

这是根据桌面上的《中医馆小程序功能需求说明.md》搭建的前后端工程，覆盖“预约 + 分销/提成基础 + 健康管理 + 小程序内嵌管理端 + PC 管理端”的 MVP 骨架。

## 技术栈

- 小程序前端：微信原生小程序
- 后端：Node.js + Express
- 数据库：PostgreSQL
- 数据校验：Zod
- 数据访问：node-postgres `pg`
- 管理端 PC：Vue 3 + Vite + Element Plus
- 小程序内嵌管理页：微信原生小程序，承载移动管理能力
- 工作区：pnpm workspace，包含 `backend`、`pc-admin`、`packages/*`

## 目录结构

```text
D:\code\tcm-clinic-miniapp
├─ backend                 后端 REST API
│  ├─ database             PostgreSQL schema 与演示数据
│  ├─ scripts              初始化与种子脚本
│  └─ src                  Express 应用源码
├─ miniprogram             微信小程序源码，包含用户端、技师端和内嵌管理端
├─ packages
│  └─ admin-shared         PC 管理端共享接口定义、状态枚举与格式化方法
├─ pc-admin                PC 管理端，Element Plus 桌面后台
├─ pnpm-workspace.yaml     pnpm workspace 配置
└─ project.config.json     微信开发者工具项目配置
```

## 已实现功能

- 用户端：首页活动、养生资讯、项目/技师/排班筛选预约、预约成功页
- 用户端：健康档案新增与历史记录、个人中心、订单列表、家庭成员列表、邀请分享入口
- 技师端：技师工作台、我的排班、排班新增、我的提成明细
- 小程序管理端：经营看板、多门店、服务项目、技师管理、技师排班、预约订单、提成结算、首页配置、内容营销、会员权限、评价管理、操作日志
- PC 管理端：桌面后台经营看板、资源管理、订单管理、提成、内容、权限、评价、审计日志、技师工作台
- 后端：项目、技师、排班、预约、健康档案、个人中心、管理看板、管理端 CRUD、订单状态 API
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

## 管理端构建与验证

```bash
pnpm build:pc
pnpm build:admin
pnpm e2e
pnpm verify:all
```

移动管理能力已收敛到微信小程序内嵌管理端；原 H5/多端管理端已移除，不再提供 `dev:h5-admin` 或多端管理端构建脚本。PC 管理端继续通过 `packages/admin-shared` 复用接口定义、状态枚举与格式化方法；小程序管理端直接复用 `miniprogram/utils/request.js` 请求 `/api/admin/*`。

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
- `GET /api/admin/bootstrap` 管理端下拉基础数据
- `GET /api/admin/orders` 管理端订单
- `PATCH /api/admin/orders/:id/status` 更新订单状态
- `GET/POST/PATCH /api/admin/*` 管理端门店、项目、技师、排班、提成、首页配置、内容、会员、评价与审计接口

## 后续接入建议

- 微信登录：把 `backend/src/middleware/auth.js` 的开发期 `x-demo-user-id` 替换为 `wx.login` 换取 `openid` + JWT。
- 微信支付：在预约创建后增加支付单，接入 JSAPI 支付与回调，更新 `payment_status`。
- 文件存储：健康档案舌诊/脉诊图片建议接腾讯云 COS 或微信云存储。
- 权限体系：管理端正式上线前需要角色权限，至少区分用户、技师、管理员。
- 小程序类目：医疗健康相关能力上线前需确认资质；若走生活服务/保健类目，功能文案和审核材料要更克制。
