-- migration v22: イベントグループの権限モデル（ロール・承認制・監査ログ）
--
-- 方針:
--   * 参加方式をグループごとに選べる: join_policy = 'approval'（申請→承認）| 'open'（即参加）
--   * グループ内ロール: owner / sub_admin / member
--   * メンバー状態: status = 'active'（正式メンバー）| 'pending'（承認待ち）
--   * 管理操作は API 側でグループ単位・ロール単位に判定（fail-closed）し、監査ログを残す
--   * 参照/更新はすべて service role の API 経由（RLS有効・ポリシー無し）

-- 参加方式（既定は安全側の承認制）
alter table public.yakonin_groups
  add column if not exists join_policy text not null default 'approval';

-- メンバーのロールと状態
alter table public.yakonin_group_members
  add column if not exists role   text not null default 'member',
  add column if not exists status text not null default 'active';

-- 既存グループの作成者を owner ロールにバックフィル
update public.yakonin_group_members m
set role = 'owner'
from public.yakonin_groups g
where m.group_id = g.id and m.user_id = g.owner_id and m.role <> 'owner';

create index if not exists idx_group_members_status on public.yakonin_group_members(group_id, status);

-- 監査ログ（誰がいつ何をしたか）
create table if not exists public.yakonin_group_audit (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.yakonin_groups(id) on delete cascade,
  actor_id       uuid,
  action         text not null,   -- create/join_request/join/approve/reject/remove/grant_admin/revoke_admin/edit/close
  target_user_id uuid,
  detail         jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists idx_group_audit_group on public.yakonin_group_audit(group_id, created_at desc);

alter table public.yakonin_group_audit enable row level security;
-- ポリシーは意図的に付けない（アプリは service role のAPI経由でのみアクセス）
