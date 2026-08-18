-- migration v24: 屋台の「使用可能用途」ラベル ＆ 予約時の選択用途
--
-- 方針:
--   * stall_specs.use_cases : 屋台貸し出し人が設定する使用可能用途の配列
--       例) {飲食, ワークショップ, 小売り, 展示, シェア, 空間}
--       予約可能な屋台をクリックした際にラベルとして表示する。
--   * reservations.selected_use_cases : 借り手が予約時に選んだ用途の配列
--       貸し出し中（営業中）の表示に、メニュー・営業時間と併せて出す。
--   * 未適用でもアプリはフォールバックで動作（参照側は存在チェック/既定値）。
--   * v23 の can_cook_onsite / can_retail / can_workshop は残置（後方互換）。

alter table public.stall_specs
  add column if not exists use_cases text[] not null default '{}';

alter table public.reservations
  add column if not exists selected_use_cases text[] not null default '{}';
