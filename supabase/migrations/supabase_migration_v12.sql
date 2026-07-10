-- migration v12: ノーショー対策 — remind_mail_sent カラム追加、auto_cancelled ステータス許容

-- 事前リマインドメール送信済みフラグ
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS remind_mail_sent boolean NOT NULL DEFAULT false;

-- status の CHECK 制約を更新して auto_cancelled を許容する
-- (制約が存在する場合は一度削除してから再作成)
DO $$
BEGIN
  -- 既存の status CHECK 制約を探して削除
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'reservations'
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%status%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.reservations DROP CONSTRAINT ' || quote_ident(constraint_name)
      FROM information_schema.table_constraints
      WHERE table_name = 'reservations'
        AND constraint_type = 'CHECK'
        AND constraint_name LIKE '%status%'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'auto_cancelled'));

-- インデックス: Cron クエリ高速化
-- pending + start_datetime の複合インデックス
CREATE INDEX IF NOT EXISTS idx_reservations_cron
  ON public.reservations (status, start_datetime)
  WHERE status = 'pending';
