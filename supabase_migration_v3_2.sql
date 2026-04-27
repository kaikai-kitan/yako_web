-- ============================================================
-- Migration v3_2: menu_ingredients (メニュー別食材・消耗品管理)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.menu_ingredients (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item_id    uuid        NOT NULL REFERENCES public.my_menu_items(id) ON DELETE CASCADE,
  inventory_item_id uuid      REFERENCES public.inventory(id) ON DELETE SET NULL,
  item_type       text        NOT NULL DEFAULT 'ingredient'
                              CHECK (item_type IN ('ingredient', 'consumable')),
  qty_per_serving numeric     NOT NULL DEFAULT 1 CHECK (qty_per_serving > 0),
  unit            text        NOT NULL DEFAULT '個',
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.menu_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_menu_ingredients_all" ON public.menu_ingredients;
CREATE POLICY "own_menu_ingredients_all" ON public.menu_ingredients
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
