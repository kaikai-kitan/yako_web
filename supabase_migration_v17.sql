-- migration v17: 夜行人プロフィールのニックネーム変更を1回に制限
--
-- 方針:
--   * yakonin_profiles に handle_locked を追加（初期 false）
--   * 既存のニックネームを一度変更すると、アプリ側で handle_locked=true にして以降ロック
--   * 未適用でもアプリはフォールバックで動作するが、ロックを効かせるには本マイグレーションが必要

ALTER TABLE public.yakonin_profiles
  ADD COLUMN IF NOT EXISTS handle_locked boolean NOT NULL DEFAULT false;
