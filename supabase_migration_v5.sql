-- v5: vendor_stores テーブル（公式ストア開設情報）
-- Supabase SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS vendor_stores (
    id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    store_name   text NOT NULL,
    description  text DEFAULT '',
    category     text DEFAULT '',
    instagram_url text DEFAULT '',
    website_url  text DEFAULT '',
    contact_email text DEFAULT '',
    is_public    boolean DEFAULT false,
    created_at   timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE vendor_stores ENABLE ROW LEVEL SECURITY;

-- 公開ストアは誰でも閲覧可
CREATE POLICY "public_stores_select" ON vendor_stores
    FOR SELECT USING (is_public = true);

-- 自分のストアは自分だけ操作可
CREATE POLICY "own_store_all" ON vendor_stores
    FOR ALL USING (auth.uid() = user_id);
