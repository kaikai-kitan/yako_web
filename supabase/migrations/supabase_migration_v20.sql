-- migration v20: 法人広告のアクセス解析（表示回数・クリック回数）
--
-- 方針:
--   * user_profiles に表示回数(ad_view_count)・クリック回数(ad_click_count)を保持
--   * 競合なく加算するため、SECURITY DEFINER の RPC で原子的にインクリメントする
--     （サーバー(service role)から /api/corporate/track 経由で呼ぶ）
--   * 未適用でもアプリはフォールバックで動作する（計測は無効・ダッシュボードは0表示）

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS ad_view_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ad_click_count integer NOT NULL DEFAULT 0;

-- 表示/クリックを原子的に加算（metric: 'view' | 'click'）
CREATE OR REPLACE FUNCTION public.increment_ad_metric(uid uuid, metric text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF metric = 'view' THEN
    UPDATE public.user_profiles SET ad_view_count = ad_view_count + 1 WHERE user_id = uid;
  ELSIF metric = 'click' THEN
    UPDATE public.user_profiles SET ad_click_count = ad_click_count + 1 WHERE user_id = uid;
  END IF;
END;
$$;
