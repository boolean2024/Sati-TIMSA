-- ============================================================================
-- SATI-TIMSA Database Schema
-- Security Classification: CONFIDENTIAL
-- ISO 27001 / OWASP compliant design
--
-- Data Classification:
--   PUBLIC:    equipment_types, brands, equipment_models, locations, areas
--   INTERNAL:  equipment, equipment_history, maintenance_orders, stock_items
--   SENSITIVE: audit_logs
--   RESTRICTED: users (password_hash, password_reset_code_hash, email)
--
-- All queries use parameterized statements to prevent SQL injection.
-- Passwords are hashed with bcrypt (min 10 rounds).
-- Audit logs are append-only for non-repudiation.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS roles (
  id SMALLSERIAL PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id SMALLINT NOT NULL REFERENCES roles(id),
  name VARCHAR(120) NOT NULL,
  username VARCHAR(40) UNIQUE,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  failed_login_attempts SMALLINT NOT NULL DEFAULT 0,
  password_reset_code_hash TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_code_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(40);
UPDATE users
SET username = lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g'))
WHERE username IS NULL;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username);

CREATE TABLE IF NOT EXISTS equipment_types (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS brands (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS equipment_models (
  id BIGSERIAL PRIMARY KEY,
  brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  name VARCHAR(120) NOT NULL,
  UNIQUE (brand_id, name)
);

CREATE TABLE IF NOT EXISTS locations (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  address TEXT
);

CREATE TABLE IF NOT EXISTS areas (
  id BIGSERIAL PRIMARY KEY,
  location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  name VARCHAR(120) NOT NULL,
  UNIQUE (location_id, name)
);

CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_type_id BIGINT NOT NULL REFERENCES equipment_types(id) ON DELETE RESTRICT,
  brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  model_id BIGINT NOT NULL REFERENCES equipment_models(id) ON DELETE RESTRICT,
  location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  area_id BIGINT NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  serial_number VARCHAR(140) NOT NULL UNIQUE,
  asset_tag VARCHAR(80) UNIQUE,
  assigned_user VARCHAR(140),
  quantity INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'activo',
  notes TEXT,
  supplier VARCHAR(140),
  purchase_date DATE,
  warranty_until DATE,
  image_path TEXT,
  image_original_name VARCHAR(180),
  image_mime VARCHAR(80),
  image_size INTEGER,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT equipment_status_check CHECK (status IN ('activo', 'mantenimiento', 'baja', 'resguardo'))
);

ALTER TABLE equipment ADD COLUMN IF NOT EXISTS supplier VARCHAR(140);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS warranty_until DATE;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS image_original_name VARCHAR(180);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS image_mime VARCHAR(80);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS image_size INTEGER;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE equipment DROP CONSTRAINT IF EXISTS equipment_quantity_check;
ALTER TABLE equipment ADD CONSTRAINT equipment_quantity_check CHECK (quantity >= 0);

CREATE TABLE IF NOT EXISTS equipment_history (
  id BIGSERIAL PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(30) NOT NULL,
  previous_data JSONB,
  new_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  phase VARCHAR(30) NOT NULL DEFAULT 'revisado',
  notes TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT maintenance_phase_check CHECK (phase IN ('revisado', 'en_proceso', 'terminado'))
);

CREATE TABLE IF NOT EXISTS stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  area_id BIGINT NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  item_code VARCHAR(80),
  name VARCHAR(140) NOT NULL,
  model VARCHAR(140) NOT NULL,
  serial_number VARCHAR(140) UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'disponible',
  notes TEXT,
  image_path TEXT,
  image_original_name VARCHAR(180),
  image_mime VARCHAR(80),
  image_size INTEGER,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_status_check CHECK (status IN ('disponible', 'reservado', 'entregado', 'baja'))
);

ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS item_code VARCHAR(80);
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS image_original_name VARCHAR(180);
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS image_mime VARCHAR(80);
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS image_size INTEGER;
ALTER TABLE stock_items ALTER COLUMN serial_number DROP NOT NULL;
ALTER TABLE stock_items DROP CONSTRAINT IF EXISTS stock_quantity_check;
ALTER TABLE stock_items ADD CONSTRAINT stock_quantity_check CHECK (quantity >= 0);

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

CREATE INDEX IF NOT EXISTS idx_equipment_serial ON equipment(serial_number);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_deleted_at ON equipment(deleted_at);
CREATE INDEX IF NOT EXISTS idx_equipment_warranty_until ON equipment(warranty_until);
CREATE INDEX IF NOT EXISTS idx_equipment_active_updated ON equipment(deleted_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_type_active ON equipment(equipment_type_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_equipment_location_active ON equipment(location_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_equipment_brand_model ON equipment(brand_id, model_id);
CREATE INDEX IF NOT EXISTS idx_equipment_area ON equipment(area_id);
CREATE INDEX IF NOT EXISTS idx_equipment_quantity ON equipment(quantity);
CREATE INDEX IF NOT EXISTS idx_equipment_history_equipment ON equipment_history(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_history_created_at ON equipment_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_equipment ON maintenance_orders(equipment_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_phase ON maintenance_orders(phase);
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_updated_at ON maintenance_orders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_items_location_area ON stock_items(location_id, area_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_items_status_updated ON stock_items(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_items_serial ON stock_items(serial_number);
CREATE INDEX IF NOT EXISTS idx_stock_items_quantity ON stock_items(quantity);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_items_item_code_unique ON stock_items(item_code) WHERE item_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_entity ON audit_logs(action, entity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_touch_updated_at ON users;
CREATE TRIGGER trg_users_touch_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_equipment_touch_updated_at ON equipment;
CREATE TRIGGER trg_equipment_touch_updated_at
BEFORE UPDATE ON equipment
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_maintenance_orders_touch_updated_at ON maintenance_orders;
CREATE TRIGGER trg_maintenance_orders_touch_updated_at
BEFORE UPDATE ON maintenance_orders
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_stock_items_touch_updated_at ON stock_items;
CREATE TRIGGER trg_stock_items_touch_updated_at
BEFORE UPDATE ON stock_items
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

INSERT INTO roles (name, description)
VALUES
  ('ADMIN', 'Acceso completo: crear usuarios, crear, leer, actualizar y eliminar.'),
  ('PERSONAL', 'Acceso de solo lectura y busqueda para personal operativo.'),
  ('TI', 'Acceso completo: crear, leer, actualizar y eliminar.'),
  ('LECTURA', 'Acceso de solo lectura para areas operativas.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO equipment_types (name)
VALUES ('Laptop'), ('Desktop'), ('Monitor'), ('Impresora'), ('Handheld'), ('Router'), ('Switch'), ('Telefono'), ('Radio'), ('Teclado'), ('Camara'), ('Mouse'), ('Webcam')
ON CONFLICT (name) DO NOTHING;
