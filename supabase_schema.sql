-- =====================================================
-- 微小夜行電灯 - Supabase データベーススキーマ
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- =====================================================

-- --------- メインテーブル ---------

-- ユーザープロフィール (Supabase Auth の auth.users を拡張)
create table public.user_profiles (
  user_id     uuid references auth.users(id) on delete cascade primary key,
  user_type   text not null check (user_type in ('利用者', '場所提供者', '屋台提供者')),
  name        text not null,
  trust_score integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- オーナーテーブル (場所提供者)
create table public.owners (
  user_id      uuid references public.user_profiles(user_id) on delete cascade primary key,
  owner_name   text not null,
  account_info text,
  career       text,
  bio          text,
  icon_path    text
);

-- 営業者テーブル (屋台提供者)
create table public.operators (
  user_id       uuid references public.user_profiles(user_id) on delete cascade primary key,
  business_name text not null,
  icon_path     text,
  phone_number  text
);

-- レンタルスペーステーブル
create table public.rental_spaces (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.owners(user_id) not null,
  name              text not null,
  address           text,
  lat               double precision not null,
  lng               double precision not null,
  area_category     text,
  space_fee         integer default 0,
  fire_use_allowed  boolean default false,
  ground_type       text,
  status            text default 'available' check (status in ('available', 'unavailable', 'active')),
  photos_path       text[],
  unlock_code       text,
  created_at        timestamptz default now()
);

-- 屋台スペックテーブル
create table public.stall_specs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.operators(user_id) not null,
  stall_name  text not null,
  specs       text,
  rental_fee  integer default 0,
  created_at  timestamptz default now()
);

-- 予約テーブル
create table public.reservations (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.user_profiles(user_id) not null,
  rental_space_id     uuid references public.rental_spaces(id),
  stall_id            uuid references public.stall_specs(id),
  start_datetime      timestamptz not null,
  end_datetime        timestamptz not null,
  total_payment       integer,
  cleanup_photo_path  text,
  created_at          timestamptz default now()
);

-- 売り上げテーブル
create table public.sales (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.reservations(id) on delete cascade not null,
  item_sales     jsonb default '{}',
  reported_at    timestamptz default now()
);

-- 支払い履歴テーブル
create table public.payment_history (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.reservations(id) not null,
  payer_name     text,
  payer_id       uuid,
  recipient_name text,
  recipient_id   uuid,
  total_amount   integer,
  created_at     timestamptz default now()
);

-- --------- アーカイブテーブル ---------

create table public.archive_user_profiles (
  user_id     uuid primary key,
  user_type   text,
  name        text,
  trust_score integer default 0,
  archived_at timestamptz default now()
);

create table public.archive_owners (
  user_id      uuid references public.archive_user_profiles(user_id) on delete cascade primary key,
  owner_name   text,
  account_info text,
  bio          text,
  icon_path    text
);

create table public.archive_operators (
  user_id       uuid references public.archive_user_profiles(user_id) on delete cascade primary key,
  business_name text,
  icon_path     text,
  phone_number  text
);

-- --------- updated_at 自動更新トリガー ---------

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.handle_updated_at();

-- --------- Row Level Security (RLS) ---------

alter table public.user_profiles   enable row level security;
alter table public.owners           enable row level security;
alter table public.operators        enable row level security;
alter table public.rental_spaces    enable row level security;
alter table public.stall_specs      enable row level security;
alter table public.reservations     enable row level security;
alter table public.sales            enable row level security;
alter table public.payment_history  enable row level security;

-- ログイン不要で読み取り可（マップ表示のため）
create policy "public_read_rental_spaces"   on public.rental_spaces   for select using (true);
create policy "public_read_stall_specs"     on public.stall_specs     for select using (true);
create policy "public_read_reservations"    on public.reservations    for select using (true);
create policy "public_read_operators"       on public.operators       for select using (true);
create policy "public_read_owners"          on public.owners          for select using (true);
create policy "public_read_user_profiles"   on public.user_profiles   for select using (true);
create policy "public_read_sales"           on public.sales           for select using (true);

-- 自分のデータのみ書き込み可
create policy "own_insert_user_profiles" on public.user_profiles
  for insert with check (auth.uid() = user_id);
create policy "own_update_user_profiles" on public.user_profiles
  for update using (auth.uid() = user_id);

create policy "own_insert_owners" on public.owners
  for insert with check (auth.uid() = user_id);
create policy "own_update_owners" on public.owners
  for update using (auth.uid() = user_id);

create policy "own_insert_operators" on public.operators
  for insert with check (auth.uid() = user_id);
create policy "own_update_operators" on public.operators
  for update using (auth.uid() = user_id);

create policy "own_insert_rental_spaces" on public.rental_spaces
  for insert with check (auth.uid() = user_id);
create policy "own_update_rental_spaces" on public.rental_spaces
  for update using (auth.uid() = user_id);

create policy "own_insert_stall_specs" on public.stall_specs
  for insert with check (auth.uid() = user_id);
create policy "own_update_stall_specs" on public.stall_specs
  for update using (auth.uid() = user_id);

create policy "own_insert_reservations" on public.reservations
  for insert with check (auth.uid() = user_id);
create policy "own_update_reservations" on public.reservations
  for update using (auth.uid() = user_id);

create policy "own_insert_sales" on public.sales
  for insert with check (
    auth.uid() = (select user_id from public.reservations where id = reservation_id)
  );

create policy "own_insert_payment_history" on public.payment_history
  for insert with check (auth.uid() = payer_id);
create policy "public_read_payment_history" on public.payment_history
  for select using (true);
