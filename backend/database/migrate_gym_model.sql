-- 健身房数据模型最小集（Phase 1 P1 / PRD: prd-multi-industry-cpages R9）
-- 在现有 services 模型上扩展，不破坏中医馆存量；新增 membership_cards（会员卡/次卡）。

-- 1) services 增加 goods_type（与支付模型对齐）与 tenant_id 冗余列
alter table if exists services
  add column if not exists goods_type varchar(20) not null default 'real_service'; -- real_service / virtual
alter table if exists services
  add column if not exists tenant_id bigint;

-- 回填 tenant_id：通过 store 的 tenant_id 关联（Phase 0 已为 stores 加 tenant_id）
do $$
begin
  update services s
     set tenant_id = st.tenant_id
    from stores st
   where s.store_id = st.id
     and s.tenant_id is distinct from st.tenant_id;
  -- 无 store 的服务默认挂到 qingnang（现有 demo 数据均为中医馆）
  update services s
     set tenant_id = (select id from tenants where slug = 'qingnang' limit 1)
   where s.tenant_id is null;
end $$;

create index if not exists idx_services_tenant_cat on services(tenant_id, category);

-- 2) 会员卡 / 次卡（特殊商品类型，不进预约流程，走支付）
create table if not exists membership_cards (
  id bigserial primary key,
  tenant_id bigint not null references tenants(id) on delete cascade,
  store_id bigint references stores(id) on delete set null,
  name varchar(100) not null,
  type varchar(20) not null default 'month',       -- month（时长卡） / count（次卡）
  sessions integer,                                 -- 次卡有效次数（month 型为 null）
  validity_days integer not null default 30,       -- 时长卡有效天数
  price numeric(10,2) not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_membership_cards_tenant on membership_cards(tenant_id, is_active);

-- 3) 幂等种子：健身房演示租户 dongneng 的团课/私教/会员卡
do $$
declare
  v_gym bigint;
  v_store bigint;
begin
  select id into v_gym from tenants where slug = 'dongneng' limit 1;
  if v_gym is null then return; end if;

  -- 健身房默认门店（若尚未存在）
  select id into v_store from stores where tenant_id = v_gym limit 1;
  if v_store is null then
    insert into stores (name, address, city, tenant_id, is_default, status)
    values ('动能健身·旗舰店', '示例路 1 号', '示例市', v_gym, true, 'active')
    returning id into v_store;
  end if;

  -- 团课 / 私教（复用 services，category=gym_course）
  insert into services (tenant_id, store_id, name, category, goods_type, description, duration_minutes, price, cover_url, sort_order)
  values
    (v_gym, v_store, '燃脂搏击操', 'gym_course', 'real_service', '高强度间歇，全身燃脂', 45, 89.00, '', 1),
    (v_gym, v_store, '瑜伽塑形', 'gym_course', 'real_service', '舒缓拉伸，改善体态', 60, 79.00, '', 2),
    (v_gym, v_store, '自由力量私教', 'gym_course', 'real_service', '一对一器械指导', 60, 199.00, '', 3)
  on conflict do nothing;

  -- 会员卡 / 次卡
  insert into membership_cards (tenant_id, store_id, name, type, sessions, validity_days, price, description, sort_order)
  values
    (v_gym, v_store, '月卡', 'month', null, 30, 299.00, '30 天内不限次到店', 1),
    (v_gym, v_store, '季卡', 'month', null, 90, 799.00, '90 天内不限次到店', 2),
    (v_gym, v_store, '10 次次卡', 'count', 10, 180, 699.00, '180 天内有效 10 次', 3)
  on conflict do nothing;
end $$;
