-- migration v25: 広告アクセス解析の時系列ログ ＆ サイト到達カウント
--
-- 方針:
--   * これまで user_profiles.ad_view_count / ad_click_count の「累計」だけだったため、
--     月次・年次などの長期軸の解析ができなかった。1イベント1行のログ表を追加する。
--   * kind:
--       view  : 夜行人図鑑（ネットワーク）にアクセスして広告ノードが表示された
--       click : 図鑑上で広告アイコンがクリックされた
--       reach : 広告内のリンク（ストア/採用URL）から実際に外部サイトへ到達した
--   * 集計は ad_events を GROUP BY 月/年 で行う。累計カウンタは後方互換で残す。
--   * user_profiles に ad_reach_count（サイト到達の累計）を追加。

create table if not exists public.ad_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('view', 'click', 'reach')),
  occurred_at timestamptz not null default now()
);

create index if not exists ad_events_user_time_idx
  on public.ad_events (user_id, occurred_at desc);
create index if not exists ad_events_user_kind_time_idx
  on public.ad_events (user_id, kind, occurred_at desc);

alter table public.ad_events enable row level security;

-- 本人だけが自分のイベントを閲覧できる（挿入は service_role キーの track API から）
drop policy if exists ad_events_select_own on public.ad_events;
create policy ad_events_select_own on public.ad_events
  for select using (auth.uid() = user_id);

alter table public.user_profiles
  add column if not exists ad_reach_count integer not null default 0;
