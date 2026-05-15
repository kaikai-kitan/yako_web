-- Migration v9: Add photo_urls array column to shop_products
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS photo_urls text[];
