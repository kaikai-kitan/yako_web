-- =====================================================
-- v31: 管理画面（割増率・場所提供者の申請・振込集計）
-- =====================================================
-- rental_price_rules … 土日・イベントなどの割増率（運営が設定）
--   予約の開始日（日本時間）に当てはまるルールの倍率を、屋台・場所の料金に掛ける。
--   複数当てはまる場合は一番高い倍率を使う。
--   対象: stall_id / rental_space_id が空なら全体、指定すればその屋台・場所だけ
--   条件: weekday（0=日〜6=土）と、start_date〜end_date（期間）。両方指定すると両方を満たす日だけ
-- space_applications … 場所提供者の申請（Webフォーム → 運営が現地ヒアリング・契約）
-- payment_history.payee_role … 'stall'（屋台代）/ 'space'（場所代）。月末の振込計算用
--
-- 適用: Supabase ダッシュボード → SQL Editor で実行（再実行しても安全）
--       アプリの更新より先に実行してください。

CREATE TABLE IF NOT EXISTS public.rental_price_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label           text NOT NULL,
  multiplier      numeric(4,2) NOT NULL CHECK (multiplier > 0 AND multiplier <= 10),
  weekday         smallint CHECK (weekday BETWEEN 0 AND 6),
  start_date      date,
  end_date        date,
  stall_id        uuid REFERENCES public.stall_specs(id) ON DELETE CASCADE,
  rental_space_id uuid REFERENCES public.rental_spaces(id) ON DELETE CASCADE,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (weekday IS NOT NULL OR start_date IS NOT NULL),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
ALTER TABLE public.rental_price_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_rental_price_rules" ON public.rental_price_rules;
CREATE POLICY "public_read_rental_price_rules" ON public.rental_price_rules FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.space_applications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid,
  applicant_name text NOT NULL,
  organization   text,
  email          text NOT NULL,
  phone          text,
  address        text NOT NULL,
  description    text,
  unavailable_times text,
  status         text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'visited', 'contracted', 'declined')),
  admin_note     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.space_applications ENABLE ROW LEVEL SECURITY;
-- ポリシーは付けない（申請の受付と閲覧はサーバー経由のみ。個人情報を守るため）

ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS payee_role text CHECK (payee_role IS NULL OR payee_role IN ('stall', 'space'));
