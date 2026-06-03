const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, requireRole('ADMIN', 'TI'), async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
    const page = Math.max(Number(req.query.page || 1), 1);
    const offset = (page - 1) * limit;
    const action = req.query.action ? String(req.query.action).trim() : null;
    const entity = req.query.entity ? String(req.query.entity).trim() : null;
    const username = req.query.username ? `%${String(req.query.username).trim()}%` : null;
    const search = req.query.search ? `%${String(req.query.search).trim()}%` : null;
    const dateFrom = req.query.date_from ? String(req.query.date_from).trim() : null;
    const dateTo = req.query.date_to ? String(req.query.date_to).trim() : null;

    const params = [action || null, entity || null, username, search, dateFrom || null, dateTo || null];
    const where = `
      WHERE ($1::text IS NULL OR al.action = $1)
        AND ($2::text IS NULL OR al.entity = $2)
        AND ($3::text IS NULL OR u.username ILIKE $3 OR u.name ILIKE $3)
        AND ($4::text IS NULL OR al.action ILIKE $4 OR al.entity ILIKE $4 OR al.entity_id::text ILIKE $4 OR al.metadata::text ILIKE $4 OR u.username ILIKE $4 OR u.name ILIKE $4)
        AND ($5::date IS NULL OR al.created_at >= $5::date)
        AND ($6::date IS NULL OR al.created_at < ($6::date + INTERVAL '1 day'))
    `;

    const [items, total] = await Promise.all([
      db.query(
        `SELECT al.id, al.action, al.entity, al.entity_id, al.metadata, al.ip_address, al.user_agent, al.created_at,
                u.name AS user_name, u.username
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ${where}
         ORDER BY al.created_at DESC
         LIMIT $7 OFFSET $8`,
        [...params, limit, offset]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ${where}`,
        params
      )
    ]);

    res.json({
      items: items.rows,
      meta: {
        page,
        limit,
        total: total.rows[0].total,
        total_pages: Math.max(Math.ceil(total.rows[0].total / limit), 1)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/export.csv', authenticate, requireRole('ADMIN', 'TI'), async (req, res, next) => {
  try {
    const action = req.query.action ? String(req.query.action).trim() : null;
    const entity = req.query.entity ? String(req.query.entity).trim() : null;
    const username = req.query.username ? `%${String(req.query.username).trim()}%` : null;
    const search = req.query.search ? `%${String(req.query.search).trim()}%` : null;
    const dateFrom = req.query.date_from ? String(req.query.date_from).trim() : null;
    const dateTo = req.query.date_to ? String(req.query.date_to).trim() : null;
    const params = [action || null, entity || null, username, search, dateFrom || null, dateTo || null];
    const { rows } = await db.query(
      `SELECT al.action, al.entity, al.entity_id, COALESCE(u.username, 'sistema') AS username,
              al.created_at, al.ip_address, al.metadata
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE ($1::text IS NULL OR al.action = $1)
         AND ($2::text IS NULL OR al.entity = $2)
         AND ($3::text IS NULL OR u.username ILIKE $3 OR u.name ILIKE $3)
         AND ($4::text IS NULL OR al.action ILIKE $4 OR al.entity ILIKE $4 OR al.entity_id::text ILIKE $4 OR al.metadata::text ILIKE $4 OR u.username ILIKE $4 OR u.name ILIKE $4)
         AND ($5::date IS NULL OR al.created_at >= $5::date)
         AND ($6::date IS NULL OR al.created_at < ($6::date + INTERVAL '1 day'))
       ORDER BY al.created_at DESC
       LIMIT 5000`,
      params
    );

    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [
      ['action', 'entity', 'entity_id', 'username', 'created_at', 'ip_address', 'metadata'].map(escapeCsv).join(','),
      ...rows.map((row) => [
        row.action,
        row.entity,
        row.entity_id,
        row.username,
        row.created_at?.toISOString?.() || row.created_at,
        row.ip_address,
        JSON.stringify(row.metadata || {})
      ].map(escapeCsv).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sati-timsa-auditoria-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
