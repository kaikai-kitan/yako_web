-- =====================================================
-- 微小夜行電灯 v2 マイグレーション
-- オンラインショップ出店者管理・精算機能
-- Supabase ダッシュボード > SQL Editor で実行
-- =====================================================

-- 1. operators にメールアドレス追加
ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS email text;

-- 2. 銀行口座情報テーブル（出店者本人のみアクセス可）
CREATE TABLE IF NOT EXISTS public.operator_bank_accounts (
  user_id        uuid PRIMARY KEY REFERENCES public.operators(user_id) ON DELETE CASCADE,
  bank_name      text NOT NULL,
  branch_name    text NOT NULL,
  account_type   text NOT NULL CHECK (account_type IN ('普通', '当座')),
  account_number text NOT NULL,
  account_holder text NOT NULL,
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE public.operator_bank_accounts ENABLE ROW LEVEL SECURITY;

-- 本人のみ読み書き可（service_role は RLS をバイパス → 管理者が参照可）
CREATE POLICY "own_select_bank_account" ON public.operator_bank_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert_bank_account" ON public.operator_bank_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update_bank_account" ON public.operator_bank_accounts
  FOR UPDATE USING (auth.uid() = user_id);

-- 3. shop_products に operator_id 追加
ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES public.operators(user_id);

-- 4. shop_orders に配送・精算カラム追加
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS operator_id       uuid REFERENCES public.operators(user_id),
  ADD COLUMN IF NOT EXISTS shipping_address  jsonb,
  ADD COLUMN IF NOT EXISTS shipping_status   text NOT NULL DEFAULT 'pending'
    CHECK (shipping_status IN ('pending', 'shipped', 'delivered')),
  ADD COLUMN IF NOT EXISTS tracking_number   text,
  ADD COLUMN IF NOT EXISTS settlement_status text NOT NULL DEFAULT 'unsettled'
    CHECK (settlement_status IN ('unsettled', 'settled')),
  ADD COLUMN IF NOT EXISTS settled_at        timestamptz;

-- 5. shop_orders の RLS 有効化・ポリシー設定
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

-- 出店者は自分の受注を参照可
CREATE POLICY "operator_select_own_orders" ON public.shop_orders
  FOR SELECT USING (auth.uid() = operator_id);

-- 購入者は自分の注文を参照可
CREATE POLICY "buyer_select_own_orders" ON public.shop_orders
  FOR SELECT USING (auth.uid() = user_id);

-- 6. operator_bank_accounts の updated_at 自動更新
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS operator_bank_accounts_updated_at ON public.operator_bank_accounts;
CREATE TRIGGER operator_bank_accounts_updated_at
  BEFORE UPDATE ON public.operator_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. user_profiles の user_type 制約に '購入者' を追加
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_user_type_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_user_type_check
  CHECK (user_type IN ('利用者', '場所提供者', '屋台提供者', '購入者'));

-- 8. 既存 shop_orders で shipping_address が別カラムになっている場合は不要
--    （ADD COLUMN IF NOT EXISTS で重複は自動スキップ）
