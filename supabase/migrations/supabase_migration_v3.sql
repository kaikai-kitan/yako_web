-- ============================================================
-- Migration v3: Multi-role dashboard (revenue_logs + inventory)
-- ============================================================

-- 1. Add multi-role flag columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_yatai_user   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_yatai_owner  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_land_owner   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_shop_operator boolean DEFAULT false;

-- 2. revenue_logs: 収益ログ（全ロール共通）
CREATE TABLE IF NOT EXISTS public.revenue_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revenue_type text        NOT NULL CHECK (revenue_type IN ('yatai_usage', 'yatai_rental', 'land_rental', 'shop_sale')),
  amount       integer     NOT NULL CHECK (amount >= 0),
  description  text,
  status       text        NOT NULL DEFAULT 'unsettled' CHECK (status IN ('unsettled', 'settled')),
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.revenue_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_revenue_logs_all" ON public.revenue_logs;
CREATE POLICY "own_revenue_logs_all" ON public.revenue_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. inventory: 在庫管理
CREATE TABLE IF NOT EXISTS public.inventory (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  unit_price   integer     NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  required_qty integer     NOT NULL DEFAULT 0 CHECK (required_qty >= 0),
  current_qty  integer     NOT NULL DEFAULT 0 CHECK (current_qty >= 0),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_inventory_all" ON public.inventory;
CREATE POLICY "own_inventory_all" ON public.inventory
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. updated_at trigger for inventory
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS inventory_updated_at ON public.inventory;
CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
