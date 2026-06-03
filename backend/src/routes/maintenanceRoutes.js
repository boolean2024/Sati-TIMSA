const express = require('express');
const { z } = require('zod');
const db = require('../config/db');
const { authenticate, requireWriteAccess } = require('../middleware/auth');
const { writeAudit } = require('../services/auditService');

const router = express.Router();

const maintenanceSchema = z.object({
  equipment_id: z.string().uuid(),
  phase: z.enum(['revisado', 'en_proceso', 'terminado']).default('revisado'),
  notes: z.string().trim().max(2000).optional().nullable()
});

const maintenanceUpdateSchema = z.object({
  phase: z.enum(['revisado', 'en_proceso', 'terminado']),
  notes: z.string().trim().max(2000).optional().nullable()
});

function selectMaintenanceSql(extraCondition = '') {
  return `
    SELECT mo.id, mo.equipment_id, mo.phase, mo.notes, mo.sent_at, mo.created_at, mo.updated_at,
           e.serial_number, e.asset_tag, e.assigned_user,
           et.name AS equipment_type, b.name AS brand, em.name AS model,
           l.name AS location, a.name AS area,
           cu.name AS created_by_name, uu.name AS updated_by_name
    FROM maintenance_orders mo
    JOIN equipment e ON e.id = mo.equipment_id
    JOIN equipment_types et ON et.id = e.equipment_type_id
    JOIN brands b ON b.id = e.brand_id
    JOIN equipment_models em ON em.id = e.model_id
    JOIN locations l ON l.id = e.location_id
    JOIN areas a ON a.id = e.area_id
    LEFT JOIN users cu ON cu.id = mo.created_by
    LEFT JOIN users uu ON uu.id = mo.updated_by
    WHERE e.deleted_at IS NULL
    ${extraCondition}
  `;
}

async function writeMaintenanceCompletionHistory(client, maintenance, userId) {
  if (maintenance.phase !== 'terminado') return;
  await client.query(
    `INSERT INTO equipment_history (equipment_id, changed_by, event_type, new_data)
     VALUES ($1, $2, 'MAINTENANCE_COMPLETED', $3::jsonb)`,
    [
      maintenance.equipment_id,
      userId,
      JSON.stringify({
        notes: maintenance.notes || 'Equipo reparado.',
        phase: maintenance.phase,
        maintenance_id: maintenance.id,
        repaired_at: new Date().toISOString(),
        result: 'Equipo reparado y regresado a activo.'
      })
    ]
  );
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `${selectMaintenanceSql("AND mo.phase <> 'terminado'")}
       ORDER BY mo.updated_at DESC
       LIMIT 200`
    );
    res.json({ items: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, requireWriteAccess, async (req, res, next) => {
  try {
    const data = maintenanceSchema.parse(req.body);
    const created = await db.withTransaction(async (client) => {
      const equipment = await client.query('SELECT id FROM equipment WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [data.equipment_id]);
      if (!equipment.rows[0]) {
        const error = new Error('Equipo no encontrado.');
        error.status = 404;
        throw error;
      }

      const { rows } = await client.query(
        `INSERT INTO maintenance_orders (equipment_id, phase, notes, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4)
         RETURNING *`,
        [data.equipment_id, data.phase, data.notes || null, req.user.id]
      );

      await client.query(
        `UPDATE equipment
         SET status = CASE WHEN $2 = 'terminado' THEN 'activo' ELSE 'mantenimiento' END,
             updated_by = $3
         WHERE id = $1`,
        [data.equipment_id, data.phase, req.user.id]
      );

      await writeMaintenanceCompletionHistory(client, rows[0], req.user.id);
      await writeAudit(client, req, 'CREATE', 'maintenance_order', rows[0].id, rows[0]);
      return rows[0];
    });

    res.status(201).json({ item: created });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de mantenimiento invalidos.' });
    }
    next(error);
  }
});

router.put('/:id', authenticate, requireWriteAccess, async (req, res, next) => {
  try {
    const data = maintenanceUpdateSchema.parse(req.body);
    const updated = await db.withTransaction(async (client) => {
      const previous = await client.query('SELECT * FROM maintenance_orders WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!previous.rows[0]) {
        const error = new Error('Registro de mantenimiento no encontrado.');
        error.status = 404;
        throw error;
      }

      const { rows } = await client.query(
        `UPDATE maintenance_orders
         SET phase = $1, notes = $2, updated_by = $3
         WHERE id = $4
         RETURNING *`,
        [data.phase, data.notes || null, req.user.id, req.params.id]
      );

      await client.query(
        `UPDATE equipment
         SET status = CASE WHEN $2 = 'terminado' THEN 'activo' ELSE 'mantenimiento' END,
             updated_by = $3
         WHERE id = $1 AND deleted_at IS NULL`,
        [rows[0].equipment_id, data.phase, req.user.id]
      );

      if (previous.rows[0].phase !== 'terminado' && rows[0].phase === 'terminado') {
        await writeMaintenanceCompletionHistory(client, rows[0], req.user.id);
      }
      await writeAudit(client, req, 'UPDATE', 'maintenance_order', req.params.id, {
        previous: previous.rows[0],
        current: rows[0]
      });
      return rows[0];
    });

    res.json({ item: updated });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de mantenimiento invalidos.' });
    }
    next(error);
  }
});

module.exports = router;
