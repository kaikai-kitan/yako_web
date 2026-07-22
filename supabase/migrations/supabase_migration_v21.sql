-- migration v21: イベントグループ（夜行人ネットワークのグループ版）
--
-- 方針:
--   * 有料プラン契約者がイベントごとに「グループ」を作成できる
--   * 無課金の人も招待コード/QRで参加できる
--   * グループのネットワーク図は「メンバー同士の縁（yakonin_edges）のみ」を表示
--   * 期間は作成者が設定。ends_at を過ぎたら参加締切（閲覧のみ）
--   * 参照/更新はすべてサーバー(service role)のAPI経由。直アクセス防止のため RLS を有効化し
--     ポリシーは付けない（service role はRLSをバイパスする）

create table if not exists public.yakonin_groups (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  join_code   text not null unique,
  starts_at   timestamptz,
  ends_at     timestamptz,
  is_closed   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_yakonin_groups_owner on public.yakonin_groups(owner_id);
create index if not exists idx_yakonin_groups_code  on public.yakonin_groups(join_code);

create table if not exists public.yakonin_group_members (
  group_id  uuid not null references public.yakonin_groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists idx_group_members_user on public.yakonin_group_members(user_id);

alter table public.yakonin_groups        enable row level security;
alter table public.yakonin_group_members enable row level security;
-- ポリシーは意図的に付けない（アプリは service role のAPI経由でのみアクセス）
