-- migration v19: 法人広告の内容 & アイコン形状（買い切り）
--
-- 方針:
--   * 法人ユーザーが夜行人図鑑に掲載する広告の内容を user_profiles に保持
--       ad_headline    : キャッチコピー（一言PR）
--       ad_store_url   : オンラインストアURL
--       ad_recruit_url : 求人・採用URL
--       ad_image_path  : 広告画像（Storageパス。1枚）
--   * アイコン形状の買い切り（オンラインストアで購入）
--       owned_shapes : 購入済みの形状スラッグ配列（'star'|'heart'|'diamond'|'hexagon'）
--       icon_shape   : 現在選択中の形状（既定 'circle'）
--   * 未適用でもアプリはフォールバックで動作するよう、参照側は存在チェック/既定値を使用

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS ad_headline text,
  ADD COLUMN IF NOT EXISTS ad_store_url text,
  ADD COLUMN IF NOT EXISTS ad_recruit_url text,
  ADD COLUMN IF NOT EXISTS ad_image_path text,
  ADD COLUMN IF NOT EXISTS owned_shapes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS icon_shape text NOT NULL DEFAULT 'circle';
