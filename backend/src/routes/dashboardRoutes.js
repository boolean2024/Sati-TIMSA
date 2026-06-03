const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const [
      kpis,
      equiposPorTipo,
      equiposPorArea,
      estadoMantenimiento
    ] = await Promise.all([
      db.query(
        `WITH latest_maintenance AS (
           SELECT DISTINCT ON (mo.equipment_id)
                  mo.equipment_id,
                  mo.phase
           FROM maintenance_orders mo
           JOIN equipment e ON e.id = mo.equipment_id
           WHERE e.deleted_at IS NULL
           ORDER BY mo.equipment_id, mo.updated_at DESC, mo.sent_at DESC
         )
         SELECT
           (SELECT COUNT(*)::int FROM equipment WHERE deleted_at IS NULL) AS "totalEquipos",
           COUNT(*) FILTER (WHERE phase IN ('revisado', 'en_proceso', 'en proceso'))::int AS "equiposEnMantenimiento",
           (SELECT COUNT(*)::int FROM stock_items WHERE quantity < 5) AS "alertasStock"
         FROM latest_maintenance`
      ),
      db.query(
        `SELECT et.name AS tipo,
                COUNT(*)::int AS total
         FROM equipment e
         JOIN equipment_types et ON et.id = e.equipment_type_id
         WHERE e.deleted_at IS NULL
         GROUP BY et.name
         ORDER BY total DESC, et.name ASC`
      ),
      db.query(
        `SELECT a.name AS area,
                COUNT(*)::int AS total
         FROM equipment e
         JOIN areas a ON a.id = e.area_id
         WHERE e.deleted_at IS NULL
         GROUP BY a.name
         ORDER BY total DESC, a.name ASC`
      ),
      db.query(
        `WITH latest_maintenance AS (
           SELECT DISTINCT ON (mo.equipment_id)
                  mo.equipment_id,
                  mo.phase
           FROM maintenance_orders mo
           JOIN equipment e ON e.id = mo.equipment_id
           WHERE e.deleted_at IS NULL
           ORDER BY mo.equipment_id, mo.updated_at DESC, mo.sent_at DESC
         )
         SELECT phase AS fase,
                COUNT(*)::int AS total
         FROM latest_maintenance
         WHERE phase IN ('revisado', 'en_proceso', 'en proceso')
         GROUP BY phase
         ORDER BY total DESC, phase ASC`
      )
    ]);

    res.json({
      kpis: kpis.rows[0] || {
        totalEquipos: 0,
        equiposEnMantenimiento: 0,
        alertasStock: 0
      },
      equiposPorTipo: equiposPorTipo.rows,
      equiposPorArea: equiposPorArea.rows,
      estadoMantenimiento: estadoMantenimiento.rows
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const [
      totals,
      byStatus,
      byLocation,
      byType,
      warranty,
      recentChanges,
      maintenance,
      stock,
      alerts
    ] = await Promise.all([
      db.query(
        `WITH latest_maintenance AS (
           SELECT DISTINCT ON (mo.equipment_id)
                  mo.equipment_id,
                  mo.phase
           FROM maintenance_orders mo
           JOIN equipment e ON e.id = mo.equipment_id
           WHERE e.deleted_at IS NULL
           ORDER BY mo.equipment_id, mo.updated_at DESC, mo.sent_at DESC
         ),
         maintenance_active AS (
           SELECT equipment_id
           FROM latest_maintenance
           WHERE phase IN ('revisado', 'en_proceso', 'en proceso')
         )
         SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE e.status = 'activo' AND ma.equipment_id IS NULL)::int AS active,
                COUNT(ma.equipment_id)::int AS maintenance,
                COUNT(*) FILTER (WHERE e.status IN ('baja', 'resguardo'))::int AS inactive,
                COUNT(*) FILTER (WHERE e.image_path IS NOT NULL)::int AS with_images
         FROM equipment e
         LEFT JOIN maintenance_active ma ON ma.equipment_id = e.id
         WHERE e.deleted_at IS NULL`
      ),
      db.query(
        `SELECT status, COUNT(*)::int AS total
         FROM equipment
         WHERE deleted_at IS NULL
         GROUP BY status
         ORDER BY total DESC`
      ),
      db.query(
        `SELECT l.name AS location, COUNT(*)::int AS total
         FROM equipment e
         JOIN locations l ON l.id = e.location_id
         WHERE e.deleted_at IS NULL
         GROUP BY l.name
         ORDER BY total DESC, l.name
         LIMIT 8`
      ),
      db.query(
        `SELECT et.name AS equipment_type, COUNT(*)::int AS total
         FROM equipment e
         JOIN equipment_types et ON et.id = e.equipment_type_id
         WHERE e.deleted_at IS NULL
         GROUP BY et.name
         ORDER BY total DESC, et.name
         LIMIT 8`
      ),
      db.query(
        `SELECT
           COUNT(*) FILTER (WHERE warranty_until < CURRENT_DATE)::int AS expired,
           COUNT(*) FILTER (WHERE warranty_until BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')::int AS next_30,
           COUNT(*) FILTER (WHERE warranty_until BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days')::int AS next_90
         FROM equipment
         WHERE deleted_at IS NULL`
      ),
      db.query(
        `SELECT h.id, h.event_type, h.created_at, e.serial_number,
                COALESCE(h.new_data->>'assigned_user', e.assigned_user) AS assigned_user,
                h.previous_data->>'assigned_user' AS previous_assigned_user,
                u.username
         FROM equipment_history h
         JOIN equipment e ON e.id = h.equipment_id
         LEFT JOIN users u ON u.id = h.changed_by
         WHERE e.deleted_at IS NULL
         ORDER BY h.created_at DESC
         LIMIT 8`
      ),
      db.query(
        `WITH latest_maintenance AS (
           SELECT DISTINCT ON (mo.equipment_id)
                  mo.equipment_id,
                  mo.phase
           FROM maintenance_orders mo
           JOIN equipment e ON e.id = mo.equipment_id
           WHERE e.deleted_at IS NULL
           ORDER BY mo.equipment_id, mo.updated_at DESC, mo.sent_at DESC
         )
         SELECT phase, COUNT(*)::int AS total
         FROM latest_maintenance
         WHERE phase IN ('revisado', 'en_proceso', 'en proceso')
         GROUP BY phase
         ORDER BY phase`
      ),
      db.query(
        `SELECT COUNT(*)::int AS total_items,
                COALESCE(SUM(quantity), 0)::int AS total_quantity,
                COUNT(*) FILTER (WHERE image_path IS NOT NULL)::int AS with_images
         FROM stock_items`
      ),
      db.query(
        `SELECT 'Garantia vencida' AS type,
                e.serial_number AS title,
                CONCAT(et.name, ' ', b.name, ' ', em.name, ' | ', COALESCE(e.assigned_user, 'Sin usuario')) AS detail,
                e.warranty_until AS due_date,
                1 AS priority
         FROM equipment e
         JOIN equipment_types et ON et.id = e.equipment_type_id
         JOIN brands b ON b.id = e.brand_id
         JOIN equipment_models em ON em.id = e.model_id
         WHERE e.deleted_at IS NULL AND e.warranty_until < CURRENT_DATE
         UNION ALL
         SELECT 'Garantia por vencer',
                e.serial_number,
                CONCAT(et.name, ' ', b.name, ' ', em.name, ' | ', COALESCE(e.assigned_user, 'Sin usuario')),
                e.warranty_until,
                2
         FROM equipment e
         JOIN equipment_types et ON et.id = e.equipment_type_id
         JOIN brands b ON b.id = e.brand_id
         JOIN equipment_models em ON em.id = e.model_id
         WHERE e.deleted_at IS NULL
           AND e.warranty_until BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
         UNION ALL
         SELECT 'Stock bajo',
                COALESCE(si.item_code, si.serial_number, si.name),
                CONCAT(si.name, ' | ', l.name, ' | ', a.name, ' | Cantidad: ', si.quantity),
                NULL::date,
                3
         FROM stock_items si
         JOIN locations l ON l.id = si.location_id
         JOIN areas a ON a.id = si.area_id
         WHERE si.quantity < 5
         UNION ALL
         SELECT 'Activo sin imagen',
                e.serial_number,
                CONCAT(et.name, ' ', b.name, ' ', em.name, ' | ', a.name),
                NULL::date,
                4
         FROM equipment e
         JOIN equipment_types et ON et.id = e.equipment_type_id
         JOIN brands b ON b.id = e.brand_id
         JOIN equipment_models em ON em.id = e.model_id
         JOIN areas a ON a.id = e.area_id
         WHERE e.deleted_at IS NULL AND e.image_path IS NULL
         ORDER BY priority ASC, due_date ASC NULLS LAST, title ASC
         LIMIT 12`
      )
    ]);

    res.json({
      totals: totals.rows[0],
      by_status: byStatus.rows,
      by_location: byLocation.rows,
      by_type: byType.rows,
      warranty: warranty.rows[0],
      recent_changes: recentChanges.rows,
      maintenance: maintenance.rows,
      stock: stock.rows[0],
      alerts: alerts.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
