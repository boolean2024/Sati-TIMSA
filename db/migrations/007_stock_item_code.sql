ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS item_code VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_items_item_code_unique
ON stock_items(item_code)
WHERE item_code IS NOT NULL;
