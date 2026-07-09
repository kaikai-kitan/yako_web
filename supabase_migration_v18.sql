-- migration v18: 基本プロフィールに電話番号を追加（オンボーディングで登録）
--
-- 方針:
--   * user_profiles に phone_number を追加（任意・NULL 可）
--   * 認証後オンボーディングで「お名前 + 電話番号」を基本情報として登録する
--   * 未適用でもアプリはフォールバックで動作する

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS phone_number text;
