-- migration v23: 屋台の「できること」フラグ ＆ 屋台人フラグ
--
-- 方針:
--   * stall_specs に能力フラグを追加（管理者が屋台ごとに設定）
--       can_cook_onsite : 現場調理可能
--       can_retail      : 小売可能
--       can_workshop    : ワークショップ可能
--   * user_profiles に「屋台人」フラグ（貸出可能屋台の閲覧・できること表示の解除条件）
--       is_yataijin             : 屋台人登録済みか
--       yataijin_registered_at  : 登録日時
--   * 未適用でもアプリはフォールバックで動作（参照側は存在チェック/既定値）

alter table public.stall_specs
  add column if not exists can_cook_onsite boolean not null default false,
  add column if not exists can_retail      boolean not null default false,
  add column if not exists can_workshop    boolean not null default false;

alter table public.user_profiles
  add column if not exists is_yataijin            boolean not null default false,
  add column if not exists yataijin_registered_at timestamptz;
