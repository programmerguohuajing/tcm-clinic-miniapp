-- ============================================================
-- Phase 1.5d 退款闭环 + 商户交易视图 + iOS IAP（R7–R9）
-- 依赖：migrate_payment_model.sql（payment_orders）
-- 幂等：可重复执行。
-- ============================================================

-- 退款记录表（R8）：每次退款请求落地，便于对账与 180 天手续费规则核查
create table if not exists payment_refunds (
  id bigserial primary key,
  tenant_id bigint references tenants(id) on delete cascade,
  payment_order_id bigint not null references payment_orders(id) on delete cascade,
  out_trade_no varchar(40) not null,
  out_refund_no varchar(40) not null unique,        -- 我方退款单号
  channel varchar(20) not null,                      -- virtual_pay | wechat_pay | iap
  reason varchar(255),
  amount numeric(10,2) not null,                     -- 退款金额（元）
  currency varchar(10) not null default 'CNY',
  channel_refund_id varchar(80),                     -- 微信 refund_id / 虚拟支付 refund_id
  status varchar(20) not null default 'refunding',   -- refunding | refunded | failed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_refunds_order on payment_refunds(payment_order_id);
create index if not exists idx_payment_refunds_tenant on payment_refunds(tenant_id);
create index if not exists idx_payment_refunds_out on payment_refunds(out_trade_no);

comment on table payment_refunds is '支付退款记录（R8），与 payment_orders 状态机联动：paid → refunding → refunded/failed';

-- 虚拟支付配置（R3 凭证）：offer_id / app_id / app_key / access_token
do $$
begin
  if not exists (select 1 from payment_configs where store_id is null and config_key = 'virtual_pay') then
    insert into payment_configs (store_id, config_key, config_value, is_active)
    values (null, 'virtual_pay', '{"offer_id":"","app_id":"","app_key":"","access_token":""}'::jsonb, true);
  end if;
end $$;

-- payment_orders 补充 iOS IAP / 平台字段（R7/R9）
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='payment_orders' and column_name='platform') then
    alter table payment_orders add column platform varchar(20) default 'wechat'; -- wechat | ios | android
    comment on column payment_orders.platform is '下单平台：wechat（微信支付/虚拟支付安卓）、ios（Apple IAP）、android';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='payment_orders' and column_name='delivered_at') then
    alter table payment_orders add column delivered_at timestamptz;
    comment on column payment_orders.delivered_at is '权益发放完成时间（R6 发货兜底写入）';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='payment_orders' and column_name='user_remark') then
    alter table payment_orders add column user_remark varchar(255);
  end if;
end $$;

-- 商户交易视图索引（R9）
create index if not exists idx_payment_orders_tenant_status on payment_orders(tenant_id, status);
create index if not exists idx_payment_orders_tenant_created on payment_orders(tenant_id, created_at desc);
