-- 多租户 + 多业态可配置 C 端页面引擎（Phase 1 / PRD: prd-multi-industry-cpages）
-- 新增表均为增量，不改动现有 homepage_configs / stores 等表。

-- 1) 业态模板：模块清单 + 术语字典 + 默认区块 + 导航 + 预约路线
create table if not exists industry_templates (
  key varchar(60) primary key,
  name varchar(100) not null,
  version integer not null default 1,
  modules jsonb not null default '[]',
  terms jsonb not null default '{}',
  default_sections jsonb not null default '[]',
  nav jsonb not null default '[]',
  booking_route jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- 2) 租户：关联业态模板，持有品牌名 / 主体类型 / 主题 token
create table if not exists tenants (
  id bigserial primary key,
  name varchar(100) not null,
  slug varchar(80) unique not null,
  industry_template_key varchar(60) not null references industry_templates(key),
  subject_type varchar(40) not null default 'individual_business', -- personal / individual_business / enterprise
  theme_tokens jsonb not null default '{}',
  brand_tagline varchar(200),
  status varchar(20) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) 租户术语覆盖：在模板术语基础上做商户级微调（R3）
create table if not exists tenant_terms (
  tenant_id bigint not null references tenants(id) on delete cascade,
  term_key varchar(60) not null,
  label varchar(120) not null,
  primary key (tenant_id, term_key)
);

-- 4) 租户级页面区块配置：升级 homepage_configs 到 tenant 级 + 多 page（R4）
create table if not exists tenant_page_configs (
  id bigserial primary key,
  tenant_id bigint not null references tenants(id) on delete cascade,
  page_key varchar(40) not null default 'home',
  section_key varchar(60) not null,
  title varchar(120),
  payload jsonb not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, page_key, section_key)
);

create index if not exists idx_tenant_page_configs on tenant_page_configs(tenant_id, page_key, sort_order);
create index if not exists idx_tenant_terms on tenant_terms(tenant_id);

-- 5) 幂等种子：两套内置模板 + 两个演示租户
do $$
declare
  v_tcm bigint;
  v_gym bigint;
begin
  -- 中医馆模板
  if not exists (select 1 from industry_templates where key = 'tcm_clinic') then
    insert into industry_templates (key, name, version, modules, terms, default_sections, nav, booking_route)
    values ('tcm_clinic', '中医馆', 1,
      '["booking","technician","health_record","info","store"]'::jsonb,
      '{"technician":"技师","booking":"预约","health_record":"健康档案","service":"服务项目","info":"健康资讯","nav_home":"首页","nav_book":"预约","nav_record":"档案","nav_me":"我的","route_1":"选服务","route_2":"选技师","route_3":"选时段","brand_tagline":"把脉问诊 · 调理身心"}'::jsonb,
      '[{"section_key":"service_list","kind":"service_list","titleKey":"service","payload":{"source":"services"}},{"section_key":"info_list","kind":"info_list","titleKey":"info","payload":{"source":"articles"}}]'::jsonb,
      '["nav_home","nav_book","nav_record","nav_me"]'::jsonb,
      '["route_1","route_2","route_3"]'::jsonb);
  end if;

  -- 健身房模板
  if not exists (select 1 from industry_templates where key = 'gym') then
    insert into industry_templates (key, name, version, modules, terms, default_sections, nav, booking_route)
    values ('gym', '健身房', 1,
      '["booking","coach","body_test","info","membership"]'::jsonb,
      '{"technician":"教练","booking":"约课","health_record":"体测报告","service":"课程","info":"健身干货","nav_home":"首页","nav_book":"约课","nav_record":"体测","nav_me":"我的","route_1":"选课程","route_2":"选教练","route_3":"选时段","brand_tagline":"科学训练 · 突破极限"}'::jsonb,
      '[{"section_key":"service_list","kind":"service_list","titleKey":"service","payload":{"source":"courses"}},{"section_key":"info_list","kind":"info_list","titleKey":"info","payload":{"source":"articles"}},{"section_key":"membership","kind":"membership","title":"会员卡","payload":{}}]'::jsonb,
      '["nav_home","nav_book","nav_record","nav_me"]'::jsonb,
      '["route_1","route_2","route_3"]'::jsonb);
  end if;

  -- 演示租户：青囊中医馆
  if not exists (select 1 from tenants where slug = 'qingnang') then
    insert into tenants (name, slug, industry_template_key, subject_type, theme_tokens, brand_tagline)
    values ('青囊中医馆', 'qingnang', 'tcm_clinic', 'individual_business',
      '{"primary":"#E76F3C","primarySoft":"#FFF0E7","accentBorder":"#FFD8C7"}'::jsonb,
      '把脉问诊 · 调理身心')
    returning id into v_tcm;
  else
    select id into v_tcm from tenants where slug = 'qingnang';
  end if;

  -- 演示租户：动能健身
  if not exists (select 1 from tenants where slug = 'dongneng') then
    insert into tenants (name, slug, industry_template_key, subject_type, theme_tokens, brand_tagline)
    values ('动能健身', 'dongneng', 'gym', 'individual_business',
      '{"primary":"#0EA5A4","primarySoft":"#E6FAF8","accentBorder":"#BDEDE9"}'::jsonb,
      '科学训练 · 突破极限')
    returning id into v_gym;
  else
    select id into v_gym from tenants where slug = 'dongneng';
  end if;

  -- 健身房演示租户：关闭"资讯"区块，验证商户可关区块（R4）
  if not exists (select 1 from tenant_page_configs where tenant_id = v_gym and page_key = 'home' and section_key = 'info_list') then
    insert into tenant_page_configs (tenant_id, page_key, section_key, title, payload, sort_order, is_active)
    values (v_gym, 'home', 'info_list', '健身干货', '{"source":"articles"}'::jsonb, 4, false);
  end if;
end $$;
