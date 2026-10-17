-- =====================================================
-- v27: 返却時の売上・支払い履歴をブラウザから書き込めないようにする
-- =====================================================
-- 背景:
--   返却処理はブラウザが直接
--     ・予約を completed にする
--     ・sales（売上明細）を INSERT
--     ・payment_history（支払い履歴：受取人・金額）を INSERT
--   していた。payment_history は payer_id が自分なら受取人・金額を自由に書けたため、
--   架空の収益を作れた。また payment_history / sales は誰でも全件読めた。
--
-- 対応（アプリ側は /api/complete-rental に移行済み）:
--   1) sales / payment_history のクライアント向け INSERT/UPDATE/DELETE ポリシーを削除
--   2) 閲覧を当事者に限定
--        payment_history … 支払った本人 / 受け取った本人
--        sales           … 予約した本人 / その屋台・スペースの提供者
--   3) reservations のクライアント向け UPDATE/DELETE ポリシーも削除
--      （ブラウザからの予約の更新は不要になった。v26 のトリガーは多重防御として残す）
--
-- 適用: Supabase ダッシュボード → SQL Editor に貼り付けて実行（再実行しても安全）
-- 注意: アプリ側の対応（/api/complete-rental）をデプロイした後に実行してください。
--       先に実行すると、旧版のアプリでは返却処理が失敗します。

DO $$
DECLARE pol record;
BEGIN
  -- 1) sales / payment_history: 既存ポリシーをすべて削除（閲覧ポリシーは下で作り直す）
  FOR pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('sales', 'payment_history')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;

  -- 3) reservations: UPDATE / DELETE ポリシーを削除（SELECT は従来どおり）
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reservations' AND cmd IN ('UPDATE', 'DELETE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.reservations', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.sales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- 2) 閲覧は当事者のみ
CREATE POLICY "party_read_payment_history" ON public.payment_history
  FOR SELECT USING (auth.uid() = payer_id OR auth.uid() = recipient_id);

CREATE POLICY "party_read_sales" ON public.sales
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.reservations r
      LEFT JOIN public.stall_specs   st ON st.id = r.stall_id
      LEFT JOIN public.rental_spaces sp ON sp.id = r.rental_space_id
      WHERE r.id = sales.reservation_id
        AND auth.uid() IN (r.user_id, st.user_id, sp.user_id)
    )
  );
