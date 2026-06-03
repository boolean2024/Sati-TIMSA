ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE stock_items ALTER COLUMN serial_number DROP NOT NULL;

ALTER TABLE stock_items DROP CONSTRAINT IF EXISTS stock_quantity_check;
ALTER TABLE stock_items
  ADD CONSTRAINT stock_quantity_check CHECK (quantity >= 0);

CREATE INDEX IF NOT EXISTS idx_stock_items_quantity ON stock_items(quantity);
