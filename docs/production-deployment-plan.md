# 青囊中医馆小程序最小代价生产级部署方案

> 版本：v1  
> 适用仓库：`tcm-clinic-miniapp`  
> 目标：以尽量低的云资源和运维成本，让当前 MVP 具备可审核、可访问、可恢复、可观测的生产运行能力。

## 1. 结论先行

推荐采用“单台云服务器 + Docker Compose + PostgreSQL 本机持久化 + 对象存储异地备份 + HTTPS 域名”的最小生产方案。

这不是高可用架构，但在预约类小程序早期流量、预算敏感、功能仍在快速迭代的阶段，性价比最高。只要补齐鉴权、HTTPS、备份、日志、健康检查和回滚机制，就可以达到“小团队可长期维护”的最低生产标准。

推荐第一阶段只上线三类入口：

- 微信小程序用户端与内嵌管理端：`miniprogram/`
- 后端 API：`https://api.example.com/api`
- PC 管理端：`https://admin.example.com/pc-admin/` 或 `https://api.example.com/pc-admin/`

暂缓正式对外开放：

- 微信支付、文件上传、精细 RBAC 等未完成生产能力，除非上线范围明确需要。

## 2. 当前项目部署形态

当前仓库是 pnpm workspace：

- `backend`：Node.js + Express REST API，使用 `pg` 连接 PostgreSQL。
- `backend/src/app.js`：已提供 `/health` 健康检查，并将 `pc-admin/dist` 挂载到 `/pc-admin`。
- `backend/database/schema.sql`：数据库结构脚本。
- `backend/database/seed.sql`：演示数据脚本，生产环境不建议原样导入。
- `pc-admin`：Vue 3 + Vite + Element Plus，构建产物为 `pc-admin/dist`。
- `miniprogram`：微信原生小程序，包含用户端、技师端和内嵌管理端，当前 API 地址在 `miniprogram/app.js` 中硬编码为本地地址。

当前生产阻塞点：

- API 鉴权仍依赖开发态 `x-demo-user-id`，上线前必须替换为 `wx.login` + 后端 session/JWT。
- 小程序 API 地址仍是 `http://127.0.0.1:3000/api`，上线前必须改为 HTTPS 正式域名。
- `cors()` 当前全开放，生产需限制来源。
- `helmet` 关闭了 CSP，管理端上线前至少需要明确静态资源策略。
- 数据库初始化脚本可用，但缺少迁移版本管理和生产种子数据拆分。

## 3. 推荐架构

```text
用户微信小程序
   |
   | HTTPS
   v
Nginx / Caddy 反向代理
   |-- /api       -> Node.js Express API
   |-- /pc-admin  -> Node.js 静态挂载或 Nginx 静态目录
   |
   v
PostgreSQL 本机容器/本机服务
   |
   v
每日备份到对象存储 COS/OSS
```

建议生产域名：

- `api.example.com`：API 与可选的 `/pc-admin`。
- `admin.example.com`：如果希望管理端独立域名，可单独配置。
- 小程序后台合法域名：配置 `https://api.example.com`。

服务器建议：

- 入门：2 核 2G / 2 核 4G 云服务器，系统盘 40GB 起。
- 数据库：初期可与应用同机部署 PostgreSQL，但必须做每日异地备份。
- 操作系统：Ubuntu LTS。
- 进程形态：Docker Compose 管理 `api`、`postgres`、`nginx/caddy`。

为什么不首选 Serverless：

- 该项目包含 Express API、PostgreSQL、静态管理端和小程序审核域名配置，单机容器化更直观、可控、迁移成本低。
- 早期流量不稳定时，Serverless 的冷启动、数据库连接和日志排查成本可能高于节省的服务器费用。

## 4. 成本估算

按国内云厂商常见规格估算，最低生产成本主要来自：

- 云服务器：约几十元/月，活动价可能更低，但需以下单页为准。
- 域名：约几十元/年。
- HTTPS 证书：可用免费 DV 证书或 Let's Encrypt。
- 对象存储备份：早期数据量小，通常为个位数元/月以内。
- 短信、支付、COS 图片存储：未接入前可不计入首发成本。

建议预算口径：

- 极简生产：约 50-150 元/月，应用与 PostgreSQL 同机，外加对象存储备份。
- 更稳妥生产：约 150-400 元/月，应用服务器 + 云数据库 PostgreSQL 基础规格。
- 等日预约量、支付订单或门店数上来后，再升级到云数据库、CDN、WAF、独立日志服务。

价格核对入口：

- 腾讯云轻量应用服务器活动与价格页：https://cloud.tencent.com/product/lighthouse
- 腾讯云 PostgreSQL 价格页：https://cloud.tencent.com/product/postgres/pricing
- 阿里云轻量应用服务器：https://www.aliyun.com/product/swas
- 阿里云 RDS PostgreSQL：https://www.aliyun.com/product/rds/postgresql

## 5. 上线前必须完成的最小改造

### 5.1 鉴权与用户身份

必须移除生产环境对 `x-demo-user-id` 的信任。

最低可行实现：

1. 小程序调用 `wx.login()` 获取 `code`。
2. 后端新增 `POST /api/auth/wechat-login`，使用微信接口换取 `openid`。
3. 后端按 `openid` 创建或读取 `users`。
4. 后端签发短期 JWT 或 session token。
5. 小程序和管理端请求改为 `Authorization: Bearer <token>`。
6. `requireAdmin` 继续基于 `users.can_manage` 控制管理权限。

临时过渡规则：

- 可以保留 `x-demo-user-id` 作为 `NODE_ENV !== "production"` 的开发能力。
- 生产环境检测到 `x-demo-user-id` 应直接拒绝或忽略。

### 5.2 小程序正式 API 地址

修改 `miniprogram/app.js`：

```javascript
App({
  globalData: {
    apiBaseUrl: "https://api.example.com/api",
    storeId: null
  }
});
```

微信公众平台后台需配置：

- request 合法域名：`https://api.example.com`
- 不允许继续依赖开发者工具中的“关闭合法域名校验”。

### 5.3 CORS 与安全头

后端生产建议：

- `cors` 只允许管理端域名和必要来源。
- `helmet` 保持开启。
- 管理端如果继续由后端静态挂载，补充 CSP 白名单。
- Express JSON body limit 维持 2MB，文件上传改走对象存储直传或后端签名上传。

### 5.4 数据库生产初始化

生产环境执行：

```bash
pnpm install --frozen-lockfile
pnpm db:init
```

不建议直接执行：

```bash
pnpm db:seed
```

原因是当前 `seed.sql` 是演示数据。生产建议拆成：

- `seed-demo.sql`：本地演示用。
- `seed-prod-minimal.sql`：只创建默认门店、基础服务分类、首个管理员。

### 5.5 日志与错误处理

最低要求：

- API 日志写到 Docker stdout，由宿主机日志轮转。
- 保留 `/health`，用于探活和外部监控。
- 接入一个免费或低成本的 HTTP 监控，例如 UptimeRobot、云监控 URL 探测。
- 生产不要打印敏感 token、openid、手机号全量信息。

## 6. 部署步骤

### 6.1 准备云资源

1. 购买 2 核 2G 或 2 核 4G 云服务器。
2. 绑定公网 IP。
3. 购买并备案域名。如果使用中国大陆服务器，小程序正式访问通常需要备案域名。
4. 配置 DNS：
   - `api.example.com -> 服务器公网 IP`
   - 可选：`admin.example.com -> 服务器公网 IP`
5. 配置安全组：
   - 开放 80、443。
   - SSH 端口只允许维护人员 IP，或至少关闭密码登录。
   - PostgreSQL 不暴露公网。

### 6.2 构建产物

在 CI 或服务器上执行：

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build:pc
pnpm --filter tcm-clinic-api start
```

原 H5/支付宝/抖音多端管理端已移除，移动管理能力由微信小程序内嵌管理端承载，不再需要额外管理端构建命令。

### 6.3 推荐 Docker Compose 服务

建议新增以下部署文件：

- `Dockerfile`
- `docker-compose.prod.yml`
- `deploy/nginx.conf` 或 Caddyfile
- `deploy/backup-postgres.sh`

服务划分：

- `api`：运行 `pnpm --filter tcm-clinic-api start`。
- `postgres`：只监听 Docker 内网，挂载持久化 volume。
- `nginx` 或 `caddy`：负责 HTTPS、反向代理、静态缓存。
- `backup`：每日 `pg_dump`，上传到 COS/OSS。

最小环境变量：

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=<postgres connection string>
JWT_SECRET=至少32字节随机字符串
WECHAT_APP_ID=正式小程序 AppID
WECHAT_APP_SECRET=正式小程序 AppSecret
```

### 6.4 Nginx 路由建议

```nginx
server {
  listen 443 ssl http2;
  server_name api.example.com;

  location /api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }

  location /health {
    proxy_pass http://127.0.0.1:3000/health;
  }

  location /pc-admin/ {
    proxy_pass http://127.0.0.1:3000/pc-admin/;
  }
}
```

如果使用 Caddy，可自动签发和续期 HTTPS 证书，运维成本更低。

## 7. 发布流程

建议使用最简单可控的手动发布：

1. 本地或 CI 运行：

```bash
pnpm build:pc
pnpm e2e
```

2. 打 tag：

```bash
git tag prod-YYYYMMDD-HHMM
```

3. 服务器拉取代码：

```bash
git fetch --all
git checkout prod-YYYYMMDD-HHMM
pnpm install --frozen-lockfile
pnpm build:pc
docker compose -f docker-compose.prod.yml up -d --build
```

4. 验证：

```bash
curl https://api.example.com/health
curl https://api.example.com/api/services
```

5. 登录小程序体验版，验证首页、预约、个人中心和管理入口。

## 8. 备份与恢复

最低备份策略：

- 每日凌晨 `pg_dump`。
- 备份文件保留 7 天每日、4 周每周、6 个月每月。
- 备份上传到 COS/OSS，不只存在服务器本机。
- 每月至少做一次恢复演练。

备份命名：

```text
tcm-clinic/prod/postgres/2026-06-13/tcm_clinic_20260613_030000.sql.gz
```

恢复演练：

```bash
createdb tcm_clinic_restore
gunzip -c backup.sql.gz | psql tcm_clinic_restore
```

## 9. 监控与告警

最低监控：

- `GET /health` 每 1 分钟探测。
- API 5xx 数量异常告警。
- 磁盘使用率超过 80% 告警。
- PostgreSQL 备份失败告警。
- HTTPS 证书到期前 14 天告警。

低成本工具选择：

- 云厂商自带云监控。
- UptimeRobot 或同类 HTTP 探活。
- Docker 日志 + logrotate。

## 10. 回滚预案

代码回滚：

```bash
git checkout <上一个生产 tag>
pnpm install --frozen-lockfile
pnpm build:pc
docker compose -f docker-compose.prod.yml up -d --build
```

数据库回滚原则：

- 上线初期避免破坏性 schema 变更。
- 每次上线前先做一次 `pg_dump`。
- 数据库结构变更需要单独迁移脚本，不要直接手改生产库。

小程序回滚：

- 微信公众平台保留上一个稳定版本。
- 新版本灰度观察后再全量发布。

## 11. 分阶段路线图

### 第一阶段：最低生产可用

必须完成：

- HTTPS 域名、备案、微信合法域名配置。
- `wx.login` + token 鉴权。
- 生产禁用 `x-demo-user-id`。
- PostgreSQL 持久化和异地备份。
- PC 管理端构建并通过 `/pc-admin` 访问。
- `/health` 外部探活。
- 小程序体验版全链路验收。

### 第二阶段：业务闭环

建议完成：

- 微信支付 JSAPI 与支付回调。
- 订单支付状态幂等更新。
- 管理端角色权限拆分。
- 图片上传接 COS/OSS。
- 生产种子数据与迁移脚本拆分。

### 第三阶段：稳定性升级

按流量再投入：

- PostgreSQL 迁移到云数据库。
- 静态资源接 CDN。
- 接入 WAF 或 API 网关。
- 日志集中化。
- 蓝绿发布或滚动发布。

## 12. 最小上线验收清单

上线前必须全部通过：

- `GET /health` 返回 `{ status: "ok" }`。
- 小程序首页能加载活动、文章、服务项目。
- 可完成一次预约创建。
- 个人中心能看到预约记录。
- 管理端账号必须有 `can_manage=true` 才能访问管理接口。
- 无管理权限用户访问 `/api/admin/*` 返回 403。
- 生产请求不再依赖 `x-demo-user-id`。
- PostgreSQL 不暴露公网。
- 备份任务成功生成并上传一份备份。
- 小程序后台合法域名配置完成。
- HTTPS 证书有效。

## 13. 推荐决策

本项目当前最小代价生产方案建议这样落地：

1. 先选 2 核 2G/4G 云服务器单机部署，PostgreSQL 同机容器化。
2. 使用 Caddy 或 Nginx 提供 HTTPS 与反向代理。
3. 首发只发布微信小程序 + Express API + PC 管理端。
4. 上线前优先实现微信登录鉴权，不先做支付。
5. 每日数据库异地备份作为生产底线。
6. 等真实订单量稳定后，再把 PostgreSQL 迁到云数据库。

这样能把首发成本控制在最低，同时不会牺牲生产系统最关键的安全、备份和可恢复能力。
