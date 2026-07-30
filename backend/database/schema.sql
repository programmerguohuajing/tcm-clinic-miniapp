create or replace function mask_phone(phone varchar) returns varchar as $$
begin
  if phone is null or length(phone) < 7 then return phone; end if;
  return substring(phone, 1, 3) || '****' || substring(phone from length(phone) - 3);
end;
$$ language plpgsql immutable;

create table if not exists users (
  id bigserial primary key,
  openid varchar(80) unique,
  nickname varchar(80) not null,
  phone varchar(30),
  avatar_url text,
  member_level varchar(40) not null default '青竹会员',
  points integer not null default 0,
  admin_role varchar(40) not null default 'member',
  can_manage boolean not null default false,
  can_technician boolean not null default false,
  invited_by bigint references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stores (
  id bigserial primary key,
  name varchar(100) not null,
  city varchar(60),
  address varchar(200) not null,
  phone varchar(30),
  business_hours varchar(120),
  latitude numeric(10,6),
  longitude numeric(10,6),
  is_default boolean not null default false,
  status varchar(20) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists family_members (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  name varchar(40) not null,
  relation varchar(30) not null,
  gender varchar(20) not null default 'unknown',
  birthday date,
  phone varchar(30),
  created_at timestamptz not null default now()
);

create table if not exists services (
  id bigserial primary key,
  store_id bigint references stores(id),
  name varchar(80) not null,
  category varchar(60) not null,
  description text,
  duration_minutes integer not null,
  price numeric(10,2) not null,
  cover_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists practitioners (
  id bigserial primary key,
  store_id bigint references stores(id),
  name varchar(60) not null,
  title varchar(80) not null,
  avatar_url text,
  bio text,
  specialties text[] not null default '{}',
  certificates jsonb not null default '[]',
  rating numeric(2,1) not null default 5.0,
  user_id bigint unique references users(id) on delete set null,
  status varchar(20) not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists practitioner_stores (
  practitioner_id bigint not null references practitioners(id) on delete cascade,
  store_id bigint not null references stores(id) on delete cascade,
  is_primary boolean not null default false,
  primary key (practitioner_id, store_id)
);

create table if not exists practitioner_services (
  practitioner_id bigint not null references practitioners(id) on delete cascade,
  service_id bigint not null references services(id) on delete cascade,
  primary key (practitioner_id, service_id)
);

create table if not exists schedules (
  id bigserial primary key,
  store_id bigint references stores(id),
  practitioner_id bigint not null references practitioners(id) on delete cascade,
  work_date date not null,
  start_time time not null,
  end_time time not null,
  capacity integer not null default 1,
  status varchar(20) not null default 'open',
  created_at timestamptz not null default now(),
  unique (practitioner_id, work_date, start_time)
);

create table if not exists appointments (
  id bigserial primary key,
  order_no varchar(40) not null unique,
  store_id bigint references stores(id),
  user_id bigint not null references users(id),
  family_member_id bigint references family_members(id),
  service_id bigint not null references services(id),
  practitioner_id bigint not null references practitioners(id),
  schedule_id bigint not null references schedules(id),
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  amount numeric(10,2) not null,
  status varchar(20) not null default 'pending',
  payment_status varchar(20) not null default 'unpaid',
  note text,
  verification_code varchar(20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists commission_rules (
  id bigserial primary key,
  name varchar(80) not null,
  service_id bigint references services(id),
  practitioner_id bigint references practitioners(id),
  threshold_amount numeric(10,2) not null default 0,
  rate numeric(5,4) not null,
  status varchar(20) not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists commission_settlements (
  id bigserial primary key,
  practitioner_id bigint not null references practitioners(id),
  period_start date not null,
  period_end date not null,
  gross_amount numeric(10,2) not null,
  commission_amount numeric(10,2) not null,
  status varchar(20) not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists activities (
  id bigserial primary key,
  store_id bigint references stores(id),
  title varchar(120) not null,
  subtitle varchar(200),
  cover_url text,
  price numeric(10,2),
  original_price numeric(10,2),
  tag varchar(40),
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists articles (
  id bigserial primary key,
  store_id bigint references stores(id),
  title varchar(160) not null,
  summary varchar(260),
  content text,
  cover_url text,
  category varchar(60),
  read_minutes integer not null default 3,
  status varchar(20) not null default 'draft',
  published_at timestamptz
);

create table if not exists coupons (
  id bigserial primary key,
  user_id bigint references users(id) on delete cascade,
  title varchar(80) not null,
  amount numeric(10,2) not null,
  min_spend numeric(10,2) not null default 0,
  status varchar(20) not null default 'unused',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists health_records (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  constitution varchar(80) not null,
  symptoms text[] not null default '{}',
  tongue_image_url text,
  pulse_note text,
  diagnosis_note text,
  created_at timestamptz not null default now()
);

create table if not exists homepage_configs (
  id bigserial primary key,
  store_id bigint references stores(id) on delete cascade,
  section_key varchar(60) not null,
  title varchar(120) not null,
  payload jsonb not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reviews (
  id bigserial primary key,
  appointment_id bigint references appointments(id) on delete set null,
  user_id bigint references users(id) on delete cascade,
  practitioner_id bigint references practitioners(id) on delete set null,
  store_id bigint references stores(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  content text,
  reply text,
  status varchar(20) not null default 'visible',
  created_at timestamptz not null default now()
);

create table if not exists admin_audit_logs (
  id bigserial primary key,
  user_id bigint references users(id),
  action varchar(80) not null,
  target_type varchar(80),
  target_id bigint,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table users add column if not exists can_technician boolean not null default false;
alter table practitioners add column if not exists user_id bigint unique references users(id) on delete set null;
alter table health_records add column if not exists deleted_at timestamptz;

create index if not exists idx_schedules_practitioner_date on schedules(practitioner_id, work_date);
create index if not exists idx_schedules_store_date on schedules(store_id, work_date);
create index if not exists idx_appointments_user on appointments(user_id, appointment_date desc);
create index if not exists idx_appointments_practitioner on appointments(practitioner_id, appointment_date desc);
create index if not exists idx_appointments_store_date on appointments(store_id, appointment_date desc);
create index if not exists idx_appointments_schedule on appointments(schedule_id);
create index if not exists idx_appointments_status on appointments(status);
create index if not exists idx_health_records_user on health_records(user_id, created_at desc);
create index if not exists idx_homepage_configs_store on homepage_configs(store_id, sort_order desc);

-- Capacity enforcement trigger for appointments.
-- Prevents over-booking by checking schedule capacity at the database level.
-- This is critical for Workers/serve rless where we can't use interactive transactions (SELECT ... FOR UPDATE).
create or replace function enforce_schedule_capacity()
returns trigger as $$
declare
  v_capacity int;
  v_booked int;
  v_status text;
begin
  select s.capacity, s.status into v_capacity, v_status
    from schedules s where s.id = new.schedule_id;

  if not found then
    raise exception '排班不存在 (schedule_id=%)', new.schedule_id;
  end if;

  if v_status != 'open' then
    raise exception '该时段已关闭预约';
  end if;

  select count(*)::int into v_booked
    from appointments
   where schedule_id = new.schedule_id
     and status in ('pending','confirmed')
     and id != new.id;

  if v_booked >= v_capacity then
    raise exception '该时段已约满';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_capacity on appointments;
create trigger trg_enforce_capacity
  before insert on appointments
  for each row execute function enforce_schedule_capacity();
