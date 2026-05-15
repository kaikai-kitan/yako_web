-- migration v13: Auth & Capture フロー対応
-- 予約時に取得した Stripe PaymentIntent ID を保存するカラムを追加

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- インデックス: auto-cancel Cron が PI を持つ pending 予約を高速検索
CREATE INDEX IF NOT EXISTS idx_reservations_pending_pi
  ON public.reservations (status, stripe_payment_intent_id)
  WHERE status = 'pending' AND stripe_payment_intent_id IS NOT NULL;
