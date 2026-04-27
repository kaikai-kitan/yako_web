-- v4: shop_products に tags カラムを追加
-- Supabase SQL Editor で実行してください

ALTER TABLE shop_products
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- インデックス（タグ検索を高速化）
CREATE INDEX IF NOT EXISTS idx_shop_products_tags ON shop_products USING GIN (tags);

-- 既存商品サンプル（必要に応じてコメントアウトを外して実行）
-- UPDATE shop_products SET tags = ARRAY['グッズ', 'オリジナル'] WHERE name = '...';
