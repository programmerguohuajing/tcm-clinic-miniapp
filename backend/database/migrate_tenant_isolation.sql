-- ============================================================================
-- Phase 0 — 多租户数据隔离
-- 为业务表增加 tenant_id 冗余列（行级隔离），并将现有 demo 数据回填到 qingnang 租户。
-- 依赖：migrate_multi_tenant_page.sql（先建 tenants / industry_templates ...）
-- 幂等：所有 ADD COLUMN 使用 IF NOT EXISTS；回填用 DO 块，可重复执行。
-- ============================================================================

-- 1) stores 增加租户外键（门店归属租户）
alter table stores
  add column if not exists tenant_id bigint references tenants(id) on delete cascade;

-- 2) 业务子表增加 tenant_id（冗余，便于隔离与查询）
alter table services           add column if not exists tenant_id bigint references tenants(id) on delete cascade;
alter table practitioners       add column if not exists tenant_id bigint references tenants(id) on delete cascade;
alter table schedules           add column if not exists tenant_id bigint references tenants(id) on delete cascade;
alter table appointments        add column if not exists tenant_id bigint references tenants(id) on delete cascade;
alter table activities          add column if not exists tenant_id bigint references tenants(id) on delete cascade;
alter table articles            add column if not exists tenant_id bigint references tenants(id) on delete cascade;
alter table reviews             add column if not exists tenant_id bigint references tenants(id) on delete cascade;
alter table homepage_configs    add column if not exists tenant_id bigint references tenants(id) on delete cascade;
alter table admin_audit_logs    add column if not exists tenant_id bigint references tenants(id) on delete cascade;
alter table health_records      add column if not exists tenant_id bigint references tenants(id) on delete cascade;
alter table coupons             add column if not exists tenant_id bigint references tenants(id) on delete cascade;
alter table commission_rules    add column if not exists tenant_id bigint references tenants(id) on delete cascade;
alter table commission_settlements add column if not exists tenant_id bigint references tenants(id) on delete cascade;

-- 3) 索引
create index if not exists idx_stores_tenant            on stores(tenant_id);
create index if not exists idx_services_tenant          on services(tenant_id);
create index if not exists idx_practitioners_tenant     on practitioners(tenant_id);
create index if not exists idx_schedules_tenant         on schedules(tenant_id);
create index if not exists idx_appointments_tenant      on appointments(tenant_id);
create index if not exists idx_activities_tenant        on activities(tenant_id);
create index if not exists idx_articles_tenant          on articles(tenant_id);
create index if not exists idx_reviews_tenant           on reviews(tenant_id);
create index if not exists idx_homepage_configs_tenant  on homepage_configs(tenant_id);
create index if not exists idx_admin_audit_logs_tenant  on admin_audit_logs(tenant_id);
create index if not exists idx_health_records_tenant    on health_records(tenant_id);
create index if not exists idx_coupons_tenant           on coupons(tenant_id);
create index if not exists idx_commission_rules_tenant  on commission_rules(tenant_id);
create index if not exists idx_commission_settle_tenant on commission_settlements(tenant_id);

-- 4) 回填现有 demo 数据到 qingnang 租户（现有工程全部是单一中医馆 demo）
do $$
declare
  v_tenant bigint;
begin
  select id into v_tenant from tenants where slug = 'qingnang' limit 1;
  if v_tenant is null then
    return; -- 模板租户未初始化则跳过回填
  end if;

  -- 门店直接挂到 demo 租户
  update stores set tenant_id = v_tenant where tenant_id is null;

  -- 通过 store 归属回填
  update services           set tenant_id = (select s.tenant_id from stores s where s.id = services.store_id)        where tenant_id is null;
  update practitioners       set tenant_id = (select s.tenant_id from stores s where s.id = practitioners.store_id)  where tenant_id is null;
  update schedules           set tenant_id = (select s.tenant_id from stores s where s.id = schedules.store_id)      where tenant_id is null;
  update appointments        set tenant_id = (select s.tenant_id from stores s where s.id = appointments.store_id)   where tenant_id is null;
  update activities          set tenant_id = (select s.tenant_id from stores s where s.id = activities.store_id)     where tenant_id is null;
  update articles            set tenant_id = (select s.tenant_id from stores s where s.id = articles.store_id)       where tenant_id is null;
  update reviews             set tenant_id = (select s.tenant_id from stores s where s.id = reviews.store_id)        where tenant_id is null;
  update homepage_configs    set tenant_id = (select s.tenant_id from stores s where s.id = homepage_configs.store_id) where tenant_id is null;

  -- 无 store 归属的全局行（store_id is null）统一归到 demo 租户
  update services            set tenant_id = v_tenant where tenant_id is null;
  update practitioners        set tenant_id = v_tenant where tenant_id is null;
  update schedules            set tenant_id = v_tenant where tenant_id is null;
  update appointments         set tenant_id = v_tenant where tenant_id is null;
  update activities           set tenant_id = v_tenant where tenant_id is null;
  update articles             set tenant_id = v_tenant where tenant_id is null;
  update reviews              set tenant_id = v_tenant where tenant_id is null;
  update homepage_configs     set tenant_id = v_tenant where tenant_id is null;
  update admin_audit_logs     set tenant_id = v_tenant where tenant_id is null;
  update health_records       set tenant_id = v_tenant where tenant_id is null;
  update coupons              set tenant_id = v_tenant where tenant_id is null;
  update commission_rules     set tenant_id = v_tenant where tenant_id is null;
  update commission_settlements set tenant_id = v_tenant where tenant_id is null;
end $$;

-- 5) 视图：管理端按租户查看门店（替代跨租户裸查）
create or replace view v_stores_by_tenant as
  select s.* from stores s where s.tenant_id is not null;
