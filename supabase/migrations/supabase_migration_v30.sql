-- =====================================================
-- v30: 決済の流れの変更（予約時はカード登録のみ → チェックイン時に与信 → 返却時に一括請求）
-- =====================================================
-- reservations に追加:
--   stripe_customer_id        … 予約者の Stripe 顧客ID
--   stripe_payment_method_id  … 予約時に登録したカード（これがあれば予約は確定）
--   stripe_hold_intent_id     … チェックイン時に確保した与信（予約時間分）
--   stripe_charge_intent_id   … 返却時・無断キャンセル時の実際の請求
--   charge_status             … paid（請求済み）/ partial（与信分のみ確定・残額未回収）/ failed（請求できず）
--   charged_amount（v29で追加済み）… 実際に請求できた金額
-- 旧方式（予約時に与信: stripe_payment_intent_id）の予約もそのまま動きます。
--
-- 適用: Supabase ダッシュボード → SQL Editor で実行（再実行しても安全）
--       列の追加のみ。アプリの更新より先に実行してください。

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS stripe_hold_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_charge_intent_id text,
  ADD COLUMN IF NOT EXISTS charge_status text
    CHECK (charge_status IS NULL OR charge_status IN ('paid', 'partial', 'failed'));

CREATE INDEX IF NOT EXISTS idx_reservations_charge_status
  ON public.reservations (charge_status)
  WHERE charge_status IN ('partial', 'failed');
