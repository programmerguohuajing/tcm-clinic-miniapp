-- ============================================================================
-- 商户管理员模型（tenant_admin）
-- users 增加归属商户列：单归属（null = 平台侧账号）。
-- 依赖：migrate_multi_tenant_page.sql（先建 tenants）。
-- 幂等：可重复执行。
-- ============================================================================

alter table users
  add column if not exists tenant_id bigint references tenants(id) on delete set null;

create index if not exists idx_users_tenant on users(tenant_id);
