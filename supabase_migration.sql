-- =====================================================
-- マイグレーション: 新機能追加
-- Supabase ダッシュボード > SQL Editor で実行してください
-- =====================================================

-- stall_specs に位置情報を追加（屋台提供者がピン設定できるように）
ALTER TABLE public.stall_specs
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- reservations に提供品目を追加
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS planned_items text;

-- =====================================================
-- 追加機能マイグレーション（Supabase SQL Editor で実行）
-- =====================================================

-- Feature 1: ピン情報拡充（貸出可能数・利用可能人数）
ALTER TABLE public.rental_spaces
  ADD COLUMN IF NOT EXISTS max_stalls integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS capacity  integer DEFAULT 10;

-- Feature 2/4: 予約ステータス管理（ダブルブッキング防止・貸出フロー）
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed', 'cancelled'));

-- 既存行にデフォルト値を設定
UPDATE public.reservations SET status = 'pending' WHERE status IS NULL;

-- =====================================================
-- プロフィール・マイメニュー機能追加
-- =====================================================

-- user_profiles にアイコン・自己紹介を追加
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS icon_path text,
  ADD COLUMN IF NOT EXISTS bio      text;

-- マイメニューテーブル（ユーザーが普段出す商品を登録）
CREATE TABLE IF NOT EXISTS public.my_menu_items (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          text        NOT NULL,
  description   text,
  price         integer     DEFAULT 0,
  photo_path    text,
  display_order integer     DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.my_menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own menu items" ON public.my_menu_items;
CREATE POLICY "Users can manage own menu items"
  ON public.my_menu_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- Storage バケット作成（画像アップロード用）
-- =====================================================

-- バケットを作成（すでに存在する場合はスキップ）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('profile-images',   'profile-images',   true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('menu-item-images', 'menu-item-images', true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- 公開読み取りポリシー
DROP POLICY IF EXISTS "Public images read" ON storage.objects;
CREATE POLICY "Public images read"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('profile-images', 'menu-item-images'));

-- 認証ユーザーのアップロードポリシー
DROP POLICY IF EXISTS "Auth users upload images" ON storage.objects;
CREATE POLICY "Auth users upload images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id IN ('profile-images', 'menu-item-images')
  );

-- 自分のフォルダのファイルのみ更新可能
DROP POLICY IF EXISTS "Users update own images" ON storage.objects;
CREATE POLICY "Users update own images"
  ON storage.objects FOR UPDATE
  USING (
    auth.uid()::text = (storage.foldername(name))[1] AND
    bucket_id IN ('profile-images', 'menu-item-images')
  );

-- 自分のフォルダのファイルのみ削除可能
DROP POLICY IF EXISTS "Users delete own images" ON storage.objects;
CREATE POLICY "Users delete own images"
  ON storage.objects FOR DELETE
  USING (
    auth.uid()::text = (storage.foldername(name))[1] AND
    bucket_id IN ('profile-images', 'menu-item-images')
  );

-- =====================================================
-- オンラインショップ機能
-- =====================================================

-- 商品テーブル
CREATE TABLE IF NOT EXISTS public.shop_products (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text        NOT NULL,
  description   text,
  price         integer     NOT NULL CHECK (price >= 0),
  photo_url     text,
  stock         integer     DEFAULT -1,  -- -1 = 在庫無制限
  is_active     boolean     DEFAULT true,
  display_order integer     DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- 注文テーブル
CREATE TABLE IF NOT EXISTS public.shop_orders (
  id                       uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_session_id        text        UNIQUE,
  stripe_payment_intent_id text,
  items                    jsonb       NOT NULL, -- [{name, price, quantity}]
  total_amount             integer     NOT NULL,
  status                   text        DEFAULT 'pending'
                                       CHECK (status IN ('pending','paid','shipped','cancelled')),
  customer_email           text,
  created_at               timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders   ENABLE ROW LEVEL SECURITY;

-- 商品は誰でも閲覧可能
DROP POLICY IF EXISTS "Anyone can view active products" ON public.shop_products;
CREATE POLICY "Anyone can view active products"
  ON public.shop_products FOR SELECT
  USING (is_active = true);

-- 注文は本人のみ閲覧可能（webhookはservice_roleで書き込み）
DROP POLICY IF EXISTS "Users can view own orders" ON public.shop_orders;
CREATE POLICY "Users can view own orders"
  ON public.shop_orders FOR SELECT
  USING (auth.uid() = user_id);

-- 商品画像バケット
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shop-images', 'shop-images', true, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public shop images read" ON storage.objects;
CREATE POLICY "Public shop images read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shop-images');
