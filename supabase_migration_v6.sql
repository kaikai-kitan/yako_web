-- v6: contact_inquiries テーブル（お問合せ管理）
-- Supabase SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS contact_inquiries (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name        text NOT NULL,
    email       text NOT NULL,
    category    text NOT NULL,
    message     text NOT NULL,
    is_read     boolean DEFAULT false,
    created_at  timestamptz DEFAULT now()
);

-- RLS: 管理者のみ閲覧・更新可（匿名でもINSERT可）
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;

-- 誰でも送信可（INSERT）
CREATE POLICY "anyone_insert_contact" ON contact_inquiries
    FOR INSERT WITH CHECK (true);

-- サービスロールのみ閲覧・更新可（フロントからは読めない）
-- 管理者ページでの閲覧はSupabase Dashboardまたはservice_roleキーで行う
