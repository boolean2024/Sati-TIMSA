CREATE TABLE IF NOT EXISTS stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  area_id BIGINT NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  name VARCHAR(140) NOT NULL,
  model VARCHAR(140) NOT NULL,
  serial_number VARCHAR(140) NOT NULL UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'disponible',
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_status_check CHECK (status IN ('disponible', 'reservado', 'entregado', 'baja'))
);

CREATE INDEX IF NOT EXISTS idx_stock_items_location_area ON stock_items(location_id, area_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_items_status_updated ON stock_items(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_items_serial ON stock_items(serial_number);

DROP TRIGGER IF EXISTS trg_stock_items_touch_updated_at ON stock_items;
CREATE TRIGGER trg_stock_items_touch_updated_at
BEFORE UPDATE ON stock_items
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
