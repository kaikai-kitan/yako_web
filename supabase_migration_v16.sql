-- migration v16: 信用スコアの獲得（返却ボーナス + 営業レビュー）
--
-- 方針:
--   * 新規ユーザーの初期スコアを 100 に（既存ユーザーの値は変更しない）
--   * 屋台の営業を1回完了（返却）すると +5
--   * 1営業（予約）につき最大5人の顧客レビュー（5段階）。合計で最大 +5
--     - 加点 = floor( Σ min(5, rating/5) )  … 5★×5件で +5、低評価は比例して少なめ
--   * 二重付与は予約側のフラグ/カウンタで防止

-- 1) 初期スコアを 100 に
ALTER TABLE public.user_profiles ALTER COLUMN credit_score SET DEFAULT 100;

-- 2) 予約に加点管理カラム
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS return_credit_awarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_score_accum numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_credit_given integer NOT NULL DEFAULT 0;

-- 3) 営業レビュー（予約単位・顧客からの匿名評価）
CREATE TABLE IF NOT EXISTS public.operation_reviews (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  rating         integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        text,
  reviewer_token text,               -- 匿名の簡易重複防止（ブラウザ由来）
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operation_reviews_res
  ON public.operation_reviews (reservation_id, created_at DESC);
-- 同一ブラウザからの二重投稿を防ぐ（token がある場合）
CREATE UNIQUE INDEX IF NOT EXISTS idx_operation_reviews_uniq
  ON public.operation_reviews (reservation_id, reviewer_token)
  WHERE reviewer_token IS NOT NULL;

ALTER TABLE public.operation_reviews ENABLE ROW LEVEL SECURITY;
-- 閲覧は全員可（評判表示のため）。書き込みは API（service role）経由のみ。
DROP POLICY IF EXISTS "operation_reviews_select_all" ON public.operation_reviews;
CREATE POLICY "operation_reviews_select_all" ON public.operation_reviews
  FOR SELECT USING (true);
