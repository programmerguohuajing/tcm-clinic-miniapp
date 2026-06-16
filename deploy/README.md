# 生产部署支撑文件

## 启动

1. 复制环境变量：

```bash
cp backend/.env.example backend/.env
```

2. 修改 `backend/.env` 和根目录 `.env` 中的生产配置：

```env
APP_HOST=api.example.com
POSTGRES_DB=tcm_clinic
POSTGRES_USER=tcm_app
POSTGRES_PASSWORD=change-to-strong-password
```

`backend/.env` 中至少要配置：

```env
NODE_ENV=production
JWT_SECRET=change-to-a-long-random-secret
WECHAT_APP_ID=正式小程序 AppID
WECHAT_APP_SECRET=正式小程序 AppSecret
ADMIN_LOGIN_PHONE=管理员手机号
ADMIN_LOGIN_PASSWORD=管理员登录密码
```

3. 启动服务：

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

4. 初始化数据库：

```bash
docker compose -f docker-compose.prod.yml exec api pnpm db:init
```

生产环境不要直接执行演示数据 `pnpm db:seed`，除非确认要导入演示门店和演示用户。

## 备份

示例：

```bash
docker run --rm --network tcm-clinic-miniapp_default \
  -e POSTGRES_HOST=postgres \
  -e POSTGRES_DB=tcm_clinic \
  -e POSTGRES_USER=tcm_app \
  -e POSTGRES_PASSWORD=change-to-strong-password \
  -v "$PWD/backups:/backups" \
  -v "$PWD/deploy/backup-postgres.sh:/backup-postgres.sh:ro" \
  postgres:16-alpine sh /backup-postgres.sh
```

实际生产建议把备份目录同步到 COS/OSS，避免只保存在服务器本机。
