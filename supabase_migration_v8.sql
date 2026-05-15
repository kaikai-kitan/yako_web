-- ============================================================
-- Migration v8: favorites table
-- ============================================================

CREATE TABLE IF NOT EXISTS favorites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, product_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- ログイン済みユーザーは自分のお気に入りのみ操作可
CREATE POLICY "Users manage own favorites"
  ON favorites
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- インデックス（商品IDでの検索を高速化）
CREATE INDEX IF NOT EXISTS idx_favorites_product ON favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user    ON favorites(user_id);
