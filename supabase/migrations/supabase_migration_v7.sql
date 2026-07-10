-- ============================================================
-- Migration v7: shop-images storage bucket + stock column
-- ============================================================

-- 1. shop_products に stock カラムがなければ追加
ALTER TABLE shop_products
  ADD COLUMN IF NOT EXISTS stock integer DEFAULT NULL;

-- 2. shop-images バケットを作成（既に存在する場合はスキップ）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-images',
  'shop-images',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 3. RLSポリシー: 誰でも読み取り可（公開バケット）
CREATE POLICY "Public read shop-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shop-images');

-- 4. RLSポリシー: ログイン済みユーザーは自分のフォルダにアップロード可
--    ファイルパスは {user_id}/{filename} の形式
CREATE POLICY "Authenticated upload shop-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'shop-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. RLSポリシー: 自分のファイルは更新・削除可
CREATE POLICY "Owner update shop-images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'shop-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Owner delete shop-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'shop-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
