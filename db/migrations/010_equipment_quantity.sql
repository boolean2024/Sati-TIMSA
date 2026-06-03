ALTER TABLE equipment ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE equipment DROP CONSTRAINT IF EXISTS equipment_quantity_check;
ALTER TABLE equipment ADD CONSTRAINT equipment_quantity_check CHECK (quantity >= 0);

CREATE INDEX IF NOT EXISTS idx_equipment_quantity ON equipment(quantity);
