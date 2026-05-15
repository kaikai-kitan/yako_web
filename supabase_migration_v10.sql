-- Migration v10: Operator shop application flow + stall reviews

-- 1. stall_reviews テーブル
CREATE TABLE IF NOT EXISTS public.stall_reviews (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES public.user_profiles(user_id) ON DELETE CASCADE NOT NULL,
  stall_id   uuid REFERENCES public.stall_specs(id) ON DELETE CASCADE NOT NULL,
  rating     integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment    text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, stall_id)
);

ALTER TABLE public.stall_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stall_reviews_select_all" ON public.stall_reviews
  FOR SELECT USING (true);

CREATE POLICY "stall_reviews_insert_own" ON public.stall_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stall_reviews_update_own" ON public.stall_reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "stall_reviews_delete_own" ON public.stall_reviews
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS stall_reviews_stall_id_idx ON public.stall_reviews (stall_id);
CREATE INDEX IF NOT EXISTS stall_reviews_user_id_idx  ON public.stall_reviews (user_id);

-- 2. operators テーブルにショップ申請カラムを追加
ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS shop_application_status text DEFAULT 'none'
    CHECK (shop_application_status IN ('none', 'pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz;

-- 3. 既存オペレーターは全員「承認済み」にして従来アクセスを維持
UPDATE public.operators
  SET shop_application_status = 'approved'
  WHERE shop_application_status IS NULL OR shop_application_status = 'none';
