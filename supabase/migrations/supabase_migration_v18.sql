-- migration v18: 法人アカウント & 課金（広告/プレミアム表示）基盤
--
-- 方針:
--   * user_profiles にアカウント種別と課金状態のカラムを追加
--   * account_type: 'individual'（個人・無料）| 'corporate'（法人・月額サブスク）
--   * corp_status : 法人申請の審査状態（出店申請と同じ運用）
--   * ad_active   : 広告/プレミアム表示が有効か（Stripeサブスクで自動制御。
--                   当面は管理画面から切替＝テスト用にも使用）
--   * stripe_* / subscription_status: 継続課金（サブスク）連携用に予約
--   * 未適用でもアプリはフォールバックで動作するよう、参照側は存在チェックを行う

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS corp_name text,
  ADD COLUMN IF NOT EXISTS corp_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS ad_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'none';

-- 法人・広告有効ユーザーの抽出を速くするための部分インデックス
CREATE INDEX IF NOT EXISTS idx_user_profiles_ad_active
  ON public.user_profiles (ad_active) WHERE ad_active = true;
