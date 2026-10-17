-- =====================================================
-- v28: プロフィール・出店者情報のサーバー管理項目をブラウザから書き換えられないようにする
-- =====================================================
-- 背景:
--   user_profiles / operators は本人なら全項目を UPDATE できたため、ブラウザから
--     ・信用スコアを上げる / アカウント停止を自分で解除する
--     ・購入していないアイコン形状を所有済みにする / サブスク・法人審査を「有効」にする
--     ・出店申請（shop_application_status）を自分で「承認済み」にする
--   といった改ざんができた。
--
-- 対応: トリガーで「本人が変えてよい項目」だけを許可する（許可リスト方式）。
--   user_profiles で本人が変更できる項目:
--     name, bio, icon_path, icon_shape（circle か購入済みの形のみ）,
--     is_yataijin, is_shop_operator, yataijin_registered_at
--   operators で本人が変更できる項目:
--     shop_application_status / rejection_reason / applied_at / user_id 以外
--   新規作成（INSERT）時は、サーバー管理の項目を既定値に戻す。
--   service_role（サーバーAPI・Webhook）と SQL Editor からの操作は従来どおり可能。
--
-- 適用: Supabase ダッシュボード → SQL Editor に貼り付けて実行（再実行しても安全）
--       アプリ側の変更は不要（今のアプリは許可項目しか書き換えていない）。

-- ---------- user_profiles ----------
CREATE OR REPLACE FUNCTION public.guard_user_profile_client_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  editable text[] := ARRAY[
    'name', 'bio', 'icon_path', 'icon_shape',
    'is_yataijin', 'is_shop_operator', 'yataijin_registered_at', 'updated_at'
  ];
  defaults jsonb := jsonb_build_object(
    'credit_score', 100, 'trust_score', 0, 'is_suspended', false,
    'owned_shapes', '[]'::jsonb, 'icon_shape', 'circle',
    'stripe_customer_id', NULL, 'stripe_subscription_id', NULL,
    'subscription_status', 'none', 'account_type', 'individual',
    'corp_status', 'none', 'corp_name', NULL,
    'ad_active', false, 'ad_headline', NULL, 'ad_image_path', NULL,
    'ad_store_url', NULL, 'ad_recruit_url', NULL,
    'ad_view_count', 0, 'ad_click_count', 0, 'ad_reach_count', 0,
    'review_count', 0, 'review_score_accum', 0, 'review_credit_given', 0,
    'is_land_owner', false, 'is_yatai_owner', false, 'is_yatai_user', false
  );
  cur jsonb;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  cur := to_jsonb(NEW);

  IF TG_OP = 'INSERT' THEN
    -- 一般ユーザーとしての登録のみ（提供者などの役割は審査・サーバー経由）
    IF NEW.user_type IS DISTINCT FROM '購入者' AND NEW.user_type IS DISTINCT FROM '利用者' THEN
      RAISE EXCEPTION 'user_type can only be set by the server' USING ERRCODE = '42501';
    END IF;
    -- サーバー管理の項目は既定値に戻す（このDBに存在する列だけ）
    NEW := jsonb_populate_record(
      NEW,
      (SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
         FROM jsonb_each(defaults) WHERE cur ? key)
    );
    RETURN NEW;
  END IF;

  -- UPDATE: 許可された項目以外は変更不可
  IF (cur - editable) IS DISTINCT FROM (to_jsonb(OLD) - editable) THEN
    RAISE EXCEPTION 'this profile field can only be changed by the server' USING ERRCODE = '42501';
  END IF;

  -- アイコン形状は circle か購入済みのものだけ
  IF (cur ? 'icon_shape') AND NEW.icon_shape IS DISTINCT FROM OLD.icon_shape
     AND coalesce(cur->>'icon_shape', 'circle') <> 'circle'
     AND NOT coalesce(to_jsonb(OLD)->'owned_shapes', '[]'::jsonb) ? (cur->>'icon_shape') THEN
    RAISE EXCEPTION 'icon shape has not been purchased' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_profile_client_write ON public.user_profiles;
CREATE TRIGGER trg_guard_user_profile_client_write
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_profile_client_write();

-- ---------- operators ----------
CREATE OR REPLACE FUNCTION public.guard_operator_client_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  protected text[] := ARRAY['user_id', 'shop_application_status', 'rejection_reason', 'applied_at'];
  cur jsonb;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  cur := to_jsonb(NEW);

  IF TG_OP = 'INSERT' THEN
    NEW := jsonb_populate_record(
      NEW,
      (SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
         FROM jsonb_each(jsonb_build_object(
           'shop_application_status', 'none', 'rejection_reason', NULL, 'applied_at', NULL))
        WHERE cur ? key)
    );
    RETURN NEW;
  END IF;

  IF (SELECT jsonb_object_agg(k, cur->k) FROM unnest(protected) k WHERE cur ? k)
     IS DISTINCT FROM
     (SELECT jsonb_object_agg(k, to_jsonb(OLD)->k) FROM unnest(protected) k WHERE cur ? k) THEN
    RAISE EXCEPTION 'shop application status can only be changed by the server' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_operator_client_write ON public.operators;
CREATE TRIGGER trg_guard_operator_client_write
  BEFORE INSERT OR UPDATE ON public.operators
  FOR EACH ROW EXECUTE FUNCTION public.guard_operator_client_write();
