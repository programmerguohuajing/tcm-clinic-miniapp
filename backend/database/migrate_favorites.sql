-- user_favorites: 用户收藏（门店 / 技师）
create table if not exists user_favorites (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  target_type varchar(20) not null check (target_type in ('store', 'practitioner')),
  target_id bigint not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create index if not exists idx_user_favorites_user on user_favorites(user_id);

-- messages: 用户消息通知
create table if not exists messages (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  type varchar(40) not null,
  title varchar(120) not null,
  body text not null,
  related_id bigint,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_user on messages(user_id, created_at desc);
