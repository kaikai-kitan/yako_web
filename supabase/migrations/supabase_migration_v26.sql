-- =====================================================
-- v26: 予約データをブラウザから直接書き換えられないようにする
-- =====================================================
-- 背景:
--   これまで reservations はログインユーザーが自分の行を自由に INSERT / UPDATE できた。
--   そのため、ブラウザの開発者ツールなどから
--     ・料金 0 円の予約を直接作る
--     ・status を 'active' にする / stripe_payment_intent_id を書き込む
--   といった操作で、支払いをせずに屋台を押さえることができた。
--
-- 対応:
--   1) 予約の作成はサーバー（/api/create-rental-checkout、service_role）だけが行う
--      → クライアント向けの INSERT ポリシーを削除
--   2) クライアントからの UPDATE は「利用中(active) → 返却済み(completed)」の切り替えだけ許可
--      （料金・決済ID・日時・屋台/スペース・所有者は変更不可）
--      → トリガーで検査。service_role（サーバーAPI）と SQL Editor からの操作は従来どおり可能
--
-- 適用: Supabase ダッシュボード → SQL Editor に貼り付けて実行（再実行しても安全）
-- 注意: アプリ側の対応（予約作成のサーバー化）をデプロイした後に実行してください。
--       先に実行すると、旧版のアプリからは予約が作成できなくなります。

-- 1) クライアントからの INSERT を禁止（reservations の INSERT ポリシーをすべて削除）
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reservations' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.reservations', pol.policyname);
  END LOOP;
END $$;

-- 2) クライアントからの UPDATE を「返却（active → completed）」に限定
CREATE OR REPLACE FUNCTION public.guard_reservation_client_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- サーバーAPI（service_role）と、ダッシュボード/SQL Editor（postgres 等）は制限しない
  IF coalesce(auth.role(), '') = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id                  IS DISTINCT FROM OLD.user_id
     OR NEW.rental_space_id          IS DISTINCT FROM OLD.rental_space_id
     OR NEW.stall_id                 IS DISTINCT FROM OLD.stall_id
     OR NEW.start_datetime           IS DISTINCT FROM OLD.start_datetime
     OR NEW.end_datetime             IS DISTINCT FROM OLD.end_datetime
     OR NEW.locked_space_fee         IS DISTINCT FROM OLD.locked_space_fee
     OR NEW.locked_stall_fee         IS DISTINCT FROM OLD.locked_stall_fee
     OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
  THEN
    RAISE EXCEPTION 'reservation fields can only be changed by the server'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'active' AND NEW.status = 'completed')
  THEN
    RAISE EXCEPTION 'reservation status can only be changed by the server'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_reservation_client_update ON public.reservations;
CREATE TRIGGER trg_guard_reservation_client_update
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.guard_reservation_client_update();
