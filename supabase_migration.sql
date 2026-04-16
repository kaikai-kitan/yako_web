-- =====================================================
-- マイグレーション: 新機能追加
-- Supabase ダッシュボード > SQL Editor で実行してください
-- =====================================================

-- stall_specs に位置情報を追加（屋台提供者がピン設定できるように）
ALTER TABLE public.stall_specs
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- reservations に提供品目を追加
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS planned_items text;
