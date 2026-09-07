-- R7 多 page 区块化：industry_templates 增加 default_pages（按 page 组织的默认区块）
-- 不改动 default_sections（兼容仅首页模板），resolvePage 优先 default_pages[pageKey]。

alter table if exists industry_templates
  add column if not exists default_pages jsonb not null default '{}';

-- 仅当未配置时回填（幂等：平台后续升级模板不应被覆盖）
do $$
begin
  -- 中医馆模板
  update industry_templates set default_pages = '{
    "home": [{"section_key":"service_list","kind":"service_list","titleKey":"service","payload":{"source":"services"}},{"section_key":"info_list","kind":"info_list","titleKey":"info","payload":{"source":"articles"}}],
    "booking": [{"section_key":"service_list","kind":"service_list","titleKey":"service","payload":{"source":"services"}}],
    "personal": [{"section_key":"membership","kind":"membership","title":"会员卡","payload":{},"is_active":false}]
  }'::jsonb
  where key = 'tcm_clinic' and (default_pages is null or default_pages = '{}'::jsonb);

  -- 健身房模板
  update industry_templates set default_pages = '{
    "home": [{"section_key":"service_list","kind":"service_list","titleKey":"service","payload":{"source":"courses"}},{"section_key":"info_list","kind":"info_list","titleKey":"info","payload":{"source":"articles"}},{"section_key":"membership","kind":"membership","title":"会员卡","payload":{}}],
    "booking": [{"section_key":"service_list","kind":"service_list","titleKey":"service","payload":{"source":"courses"}},{"section_key":"membership","kind":"membership","title":"会员卡","payload":{}}],
    "personal": [{"section_key":"membership","kind":"membership","title":"会员卡","payload":{}}]
  }'::jsonb
  where key = 'gym' and (default_pages is null or default_pages = '{}'::jsonb);
end $$;
