CREATE INDEX IF NOT EXISTS idx_equipment_active_updated ON equipment(deleted_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_type_active ON equipment(equipment_type_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_equipment_location_active ON equipment(location_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_equipment_brand_model ON equipment(brand_id, model_id);
CREATE INDEX IF NOT EXISTS idx_equipment_area ON equipment(area_id);
CREATE INDEX IF NOT EXISTS idx_equipment_history_created_at ON equipment_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_updated_at ON maintenance_orders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_entity ON audit_logs(action, entity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);
