ALTER TABLE equipment ADD COLUMN IF NOT EXISTS supplier VARCHAR(140);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS warranty_until DATE;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_deleted_at ON equipment(deleted_at);
CREATE INDEX IF NOT EXISTS idx_equipment_warranty_until ON equipment(warranty_until);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(40) NOT NULL,
  entity VARCHAR(80) NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
