-- =====================================================
-- v32: 割増率に「土日・祝日」「祝日だけ」を追加
-- =====================================================
-- rental_price_rules.day_set … 'weekend_holiday'（土日と祝日）/ 'holiday'（祝日だけ）
--   祝日は振替休日・国民の休日を含め、アプリ側で自動判定する。
--
-- 適用: Supabase ダッシュボード → SQL Editor で実行（再実行しても安全）
--       アプリの更新より先に実行してください。

ALTER TABLE public.rental_price_rules
  ADD COLUMN IF NOT EXISTS day_set text CHECK (day_set IS NULL OR day_set IN ('holiday', 'weekend_holiday'));

-- 「曜日か期間のどちらかが必要」の制約を、土日祝も認める形に置き換える
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.rental_price_rules'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%weekday IS NOT NULL%start_date IS NOT NULL%'
  LOOP
    EXECUTE format('ALTER TABLE public.rental_price_rules DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.rental_price_rules DROP CONSTRAINT IF EXISTS rental_price_rules_when_check;
ALTER TABLE public.rental_price_rules
  ADD CONSTRAINT rental_price_rules_when_check CHECK (weekday IS NOT NULL OR start_date IS NOT NULL OR day_set IS NOT NULL);
