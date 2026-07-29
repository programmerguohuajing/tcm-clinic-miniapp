create table if not exists payment_configs (
  id bigserial primary key,
  store_id bigint references stores(id) on delete cascade,
  config_key varchar(80) not null,
  config_value jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, config_key)
);

create index if not exists idx_payment_configs_store on payment_configs(store_id);

comment on table payment_configs is '支付配置表，支持按门店和全局配置微信支付、模拟支付等参数';
comment on column payment_configs.store_id is '所属门店 ID，为空表示全局配置';
comment on column payment_configs.config_key is '配置键，wechat_pay 微信支付，mock_payment 模拟支付';
comment on column payment_configs.config_value is '配置值 JSON，根据 config_key 不同结构各异';
comment on column payment_configs.is_active is '配置是否启用';

do $$
begin
  if not exists (select 1 from payment_configs where store_id is null and config_key = 'wechat_pay') then
    insert into payment_configs (store_id, config_key, config_value, is_active)
    values (null, 'wechat_pay', '{"merchant_id":"","api_key":"","app_id":"","mch_id":""}'::jsonb, true);
  end if;
  if not exists (select 1 from payment_configs where store_id is null and config_key = 'mock_payment') then
    insert into payment_configs (store_id, config_key, config_value, is_active)
    values (null, 'mock_payment', '{"enabled":true,"timeout_minutes":30}'::jsonb, true);
  end if;
end $$;
