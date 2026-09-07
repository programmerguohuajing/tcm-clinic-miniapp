-- ============================================================
-- Phase 1.5a 支付模型（R1 商品类型 + 统一支付订单表）
-- 依赖：migrate_multi_tenant_page.sql（tenants.subject_type）
-- 幂等：可重复执行；无微信凭证也能建表，联调不阻塞。
-- ============================================================

-- R1：商品类型（services 既承载中医理疗/健身课程，也承载会员卡内容）
-- goods_type: virtual（虚拟商品：会员/线上课程/内容/次数）| real_service（到店服务：预约/团课）
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'services' and column_name = 'goods_type'
  ) then
    alter table services
      add column goods_type varchar(20) not null default 'real_service';
    comment on column services.goods_type is
      '商品类型：virtual 虚拟商品（会员/课程/内容），real_service 到店服务（预约/团课）。个人主体仅允许 virtual 收款。';
  end if;
end $$;

-- 统一支付订单表（渠道无关，R4/R5 共用状态机）
create table if not exists payment_orders (
  id bigserial primary key,
  tenant_id bigint references tenants(id) on delete cascade,
  store_id bigint references stores(id) on delete set null,
  user_id bigint not null references users(id),

  out_trade_no varchar(40) not null unique,          -- 我方订单号（8-32 位，全局唯一）
  channel varchar(20) not null,                       -- virtual_pay | wechat_pay
  subject_type varchar(40) not null,                  -- 下单时租户主体类型（快照）
  goods_type varchar(20) not null,                    -- 下单时商品类型（快照）

  goods_ref jsonb not null default '{}',             -- {kind:'service'|'course'|'membership'|'content', id, name}
  amount numeric(10,2) not null,                      -- 实付金额（元）
  currency varchar(10) not null default 'CNY',

  status varchar(20) not null default 'pending_payment', -- 见 payment-order-state.js 状态机
  channel_order_id varchar(80),                       -- 微信 transaction_id / 虚拟支付 wx_order_id
  pay_params jsonb,                                   -- 下发给小程序的拉起参数（payData）；mock 模式为占位
  mock boolean not null default false,                -- 无凭证开发联调用

  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_orders_tenant on payment_orders(tenant_id);
create index if not exists idx_payment_orders_user on payment_orders(user_id, created_at desc);
create index if not exists idx_payment_orders_out on payment_orders(out_trade_no);
create index if not exists idx_payment_orders_status on payment_orders(status);

comment on table payment_orders is '统一支付订单（渠道无关），支持个人虚拟支付与个体户/企业微信支付共用状态机';
comment on column payment_orders.channel is 'virtual_pay 微信虚拟支付；wechat_pay 微信支付 JSAPI';
comment on column payment_orders.status is 'pending_payment/paid/delivering/delivered/refunding/refunded/closed/failed';
