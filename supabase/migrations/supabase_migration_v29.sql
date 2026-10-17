-- =====================================================
-- v29: 時間枠予約（3時間の基本料金＋30分ごとの延長）と、屋台・場所の一体化
-- =====================================================
-- 料金:
--   stall_specs.rental_fee / rental_spaces.space_fee … 3時間あたりの基本料金（円）
--   stall_specs.extension_fee / rental_spaces.extension_fee … 30分ごとの延長料金（円）
--   reservations.locked_*_fee / locked_*_ext_fee … 予約時点の料金（サーバーが確定）
-- 屋台と場所の一体化:
--   stall_specs.space_id … 屋台の設置場所。運営が現地ヒアリング・契約後に設定する
-- 貸し出し不可の時間帯:
--   rental_blackouts … 屋台または場所ごとに、曜日・日付・時間帯で指定（運営が設定）
--
-- 適用: Supabase ダッシュボード → SQL Editor で実行（再実行しても安全）
--       列と表の追加のみ。アプリの更新より先に実行してください。

ALTER TABLE public.stall_specs
  ADD COLUMN IF NOT EXISTS extension_fee integer NOT NULL DEFAULT 0 CHECK (extension_fee >= 0),
  ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES public.rental_spaces(id) ON DELETE SET NULL;

ALTER TABLE public.rental_spaces
  ADD COLUMN IF NOT EXISTS extension_fee integer NOT NULL DEFAULT 0 CHECK (extension_fee >= 0);

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS locked_stall_ext_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_space_ext_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS charged_amount integer;

COMMENT ON COLUMN public.stall_specs.rental_fee      IS '3時間あたりの基本料金（円）';
COMMENT ON COLUMN public.stall_specs.extension_fee   IS '30分ごとの延長料金（円）';
COMMENT ON COLUMN public.stall_specs.space_id        IS '屋台の設置場所（運営が設定）';
COMMENT ON COLUMN public.rental_spaces.space_fee     IS '3時間あたりの基本料金（円）';
COMMENT ON COLUMN public.rental_spaces.extension_fee IS '30分ごとの延長料金（円）';

CREATE INDEX IF NOT EXISTS idx_reservations_stall_time
  ON public.reservations (stall_id, start_datetime)
  WHERE status IN ('pending', 'active');

-- 貸し出し不可の時間帯
--   weekday（0=日〜6=土）または on_date のどちらか（両方空なら毎日）
--   start_time〜end_time（日本時間。終日は 00:00〜24:00）
CREATE TABLE IF NOT EXISTS public.rental_blackouts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_space_id uuid REFERENCES public.rental_spaces(id) ON DELETE CASCADE,
  stall_id        uuid REFERENCES public.stall_specs(id) ON DELETE CASCADE,
  weekday         smallint CHECK (weekday BETWEEN 0 AND 6),
  on_date         date,
  start_time      time NOT NULL DEFAULT '00:00',
  end_time        time NOT NULL DEFAULT '24:00',
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (rental_space_id IS NOT NULL OR stall_id IS NOT NULL),
  CHECK (weekday IS NULL OR on_date IS NULL),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_rental_blackouts_space ON public.rental_blackouts (rental_space_id);
CREATE INDEX IF NOT EXISTS idx_rental_blackouts_stall ON public.rental_blackouts (stall_id);

ALTER TABLE public.rental_blackouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_rental_blackouts" ON public.rental_blackouts;
CREATE POLICY "public_read_rental_blackouts" ON public.rental_blackouts FOR SELECT USING (true);
-- 書き込みポリシーは付けない（運営がサーバー経由・SQL Editor で設定）

-- 屋台の設置場所（space_id）は運営だけが設定できる
CREATE OR REPLACE FUNCTION public.guard_stall_space_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.space_id := NULL;
  ELSIF NEW.space_id IS DISTINCT FROM OLD.space_id THEN
    RAISE EXCEPTION 'stall location can only be set by the operator' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_stall_space_link ON public.stall_specs;
CREATE TRIGGER trg_guard_stall_space_link
  BEFORE INSERT OR UPDATE ON public.stall_specs
  FOR EACH ROW EXECUTE FUNCTION public.guard_stall_space_link();
