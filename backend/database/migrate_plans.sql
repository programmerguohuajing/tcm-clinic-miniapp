-- ============================================================
-- Phase 3 套餐 / 能力包（R13，仅做能力门控，不做计费 / 用量）
-- 依赖：migrate_multi_tenant_page.sql（tenants）
-- 幂等：可重复执行。
-- ============================================================

-- 套餐定义：决定可用菜单(menu)与能力(capability)集合
create table if not exists plans (
  key varchar(40) primary key,
  name varchar(80) not null,
  description varchar(255),
  menus jsonb not null default '[]',        -- 可见 nav 菜单 key 列表
  capabilities jsonb not null default '[]', -- 开放能力标识列表（如 multi_store / marketing / data_board / pay）
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table plans is '套餐/能力包定义（R13）：仅门控菜单与能力，不涉及计费与用量';

-- 租户→套餐 关联
create table if not exists tenant_plans (
  id bigserial primary key,
  tenant_id bigint not null references tenants(id) on delete cascade,
  plan_key varchar(40) not null references plans(key),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, plan_key)
);

create index if not exists idx_tenant_plans_tenant on tenant_plans(tenant_id);
comment on table tenant_plans is '租户当前生效套餐（R13），与 tenants 解耦便于多套餐历史留存';

-- 种子套餐：基础 / 专业 / 旗舰（菜单与能力随业态在管理端/小程序按模板再过滤）
insert into plans (key, name, description, menus, capabilities, sort_order) values
  ('basic', '基础版', '核心预约能力，单门店', '["dashboard","stores","services","orders","users","pageConfig","transactions","plans"]', '["booking","single_store"]', 1),
  ('pro', '专业版', '多门店 + 营销 + 数据看板 + 支付', '["dashboard","stores","services","practitioners","schedules","orders","commissions","pageConfig","content","users","reviews","audit","transactions","plans"]', '["booking","multi_store","marketing","data_board","pay"]', 2),
  ('flagship', '旗舰版', '专业版全部能力 + 技师工作台 + 内容深度运营', '["dashboard","stores","services","practitioners","schedules","technicianPortal","orders","commissions","homepage","pageConfig","content","users","reviews","audit","transactions","plans"]', '["booking","multi_store","marketing","data_board","pay","technician_portal","content_ops"]', 3)
on conflict (key) do nothing;

-- 演示租户默认套餐关联（幂等）：青囊/动能 均挂专业版，便于展示套餐门控与商户交易视图
insert into tenant_plans (tenant_id, plan_key)
select t.id, 'pro' from tenants t where t.slug in ('qingnang', 'dongneng')
on conflict (tenant_id, plan_key) do nothing;
