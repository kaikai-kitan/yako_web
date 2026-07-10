-- migration v15: 夜行人ネットワーク（人脈グラフ）
--
-- 設計方針（Phase 2）:
--   * ノード対象 = オプトインの「夜行人プロフィール」を作った人だけ（アカウント/PII とは分離）
--   * 接続モデル = ハイブリッド（屋台自体もノード。タップで①屋台ハブに接続 ②同じ屋台の来場者と弱エッジ）
--   * 同意 = 初回のみ確認画面（サーバ側はべき等 upsert なので何度タップしても重複しない）
--   * NFC/QR は「URL 運搬役」。個人情報は URL に載せず、ログイン済みセッションで本人確認する。

-- ============================================================
-- 1. 夜行人プロフィール（公開ペルソナ。実名・メールは持たない）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.yakonin_profiles (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle       text NOT NULL,                          -- ニックネーム（表示名）
  status       text DEFAULT '',                        -- 社会的階級 / 肩書き（自由記述）
  one_liner    text DEFAULT '',                        -- 一言・迷言
  avatar_path  text DEFAULT '',                        -- アイコン画像（Storage パス or URL）
  connect_code text NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'), -- 人対人接続用の短いコード
  is_public    boolean NOT NULL DEFAULT true,          -- グラフに載せてよいか
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_yakonin_connect_code
  ON public.yakonin_profiles (connect_code);
CREATE INDEX IF NOT EXISTS idx_yakonin_public
  ON public.yakonin_profiles (is_public) WHERE is_public = true;

ALTER TABLE public.yakonin_profiles ENABLE ROW LEVEL SECURITY;

-- 公開プロフィールは誰でも閲覧可（グラフ描画のため）
DROP POLICY IF EXISTS "yakonin_profiles_select_public" ON public.yakonin_profiles;
CREATE POLICY "yakonin_profiles_select_public" ON public.yakonin_profiles
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);
-- 本人のみ作成・更新・削除
DROP POLICY IF EXISTS "yakonin_profiles_insert_own" ON public.yakonin_profiles;
CREATE POLICY "yakonin_profiles_insert_own" ON public.yakonin_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "yakonin_profiles_update_own" ON public.yakonin_profiles;
CREATE POLICY "yakonin_profiles_update_own" ON public.yakonin_profiles
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "yakonin_profiles_delete_own" ON public.yakonin_profiles;
CREATE POLICY "yakonin_profiles_delete_own" ON public.yakonin_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 2. 人 ↔ 人 の無向エッジ（user_a < user_b で正規化して重複排除）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.yakonin_edges (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_a     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight     integer NOT NULL DEFAULT 1,               -- 直接=強め, 相席(covisit)=弱め
  origin     text NOT NULL DEFAULT 'manual',           -- 'qr_person' | 'covisit' | 'event' | 'manual'
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT yakonin_edges_ordered CHECK (user_a < user_b),
  CONSTRAINT yakonin_edges_unique UNIQUE (user_a, user_b)
);

CREATE INDEX IF NOT EXISTS idx_yakonin_edges_a ON public.yakonin_edges (user_a);
CREATE INDEX IF NOT EXISTS idx_yakonin_edges_b ON public.yakonin_edges (user_b);

ALTER TABLE public.yakonin_edges ENABLE ROW LEVEL SECURITY;
-- 閲覧は全員可（中身は user_id 2つのみ、PII なし）。書き込みは API（service role）経由のみ。
DROP POLICY IF EXISTS "yakonin_edges_select_all" ON public.yakonin_edges;
CREATE POLICY "yakonin_edges_select_all" ON public.yakonin_edges
  FOR SELECT USING (true);

-- ============================================================
-- 3. 人 ↔ 屋台ハブ のエッジ（ハイブリッドの屋台ノード）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.yakonin_stall_links (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stall_id   uuid NOT NULL REFERENCES public.stall_specs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT yakonin_stall_links_unique UNIQUE (user_id, stall_id)
);

CREATE INDEX IF NOT EXISTS idx_yakonin_stall_links_stall
  ON public.yakonin_stall_links (stall_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_yakonin_stall_links_user
  ON public.yakonin_stall_links (user_id);

ALTER TABLE public.yakonin_stall_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "yakonin_stall_links_select_all" ON public.yakonin_stall_links;
CREATE POLICY "yakonin_stall_links_select_all" ON public.yakonin_stall_links
  FOR SELECT USING (true);

-- ============================================================
-- 4. 屋台をグラフに出してよいかのフラグ（任意・既定 true）
-- ============================================================
ALTER TABLE public.stall_specs
  ADD COLUMN IF NOT EXISTS show_in_network boolean NOT NULL DEFAULT true;
