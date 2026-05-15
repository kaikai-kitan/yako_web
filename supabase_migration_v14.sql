-- migration v14: GPS 位置検証対応
--
-- rental_spaces と stall_specs には既に lat / lng カラムが存在します。
-- このマイグレーションでは GPS 検証クエリ用のインデックスと
-- NOT NULL 制約のチェックビューを追加します。

-- GPS 検証でよく使う「lat/lng が NULL でないスペース」用インデックス
CREATE INDEX IF NOT EXISTS idx_rental_spaces_geo
  ON public.rental_spaces (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stall_specs_geo
  ON public.stall_specs (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- ※ lat/lng が NULL の屋台・スペースは GPS 検証をスキップする
--   （既存の管理画面から座標を登録してください）

-- カラム存在の確認（冪等性あり）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rental_spaces' AND column_name = 'lat'
  ) THEN
    ALTER TABLE public.rental_spaces ADD COLUMN lat double precision;
    ALTER TABLE public.rental_spaces ADD COLUMN lng double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stall_specs' AND column_name = 'lat'
  ) THEN
    ALTER TABLE public.stall_specs ADD COLUMN lat double precision;
    ALTER TABLE public.stall_specs ADD COLUMN lng double precision;
  END IF;
END $$;
