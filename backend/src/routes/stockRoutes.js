const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const db = require('../config/db');
const { authenticate, requireWriteAccess } = require('../middleware/auth');
const { writeAudit } = require('../services/auditService');
const { allowedImageMimes, deleteStockImage, readStoredImage, uploadStockImage: storeStockImage } = require('../services/storageService');

const router = express.Router();

let runtimeSchemaPromise;

function ensureStockRuntimeSchema() {
  if (!runtimeSchemaPromise) {
    runtimeSchemaPromise = db.query(`
      ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS item_code VARCHAR(80);
      ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS image_path TEXT;
      ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS image_original_name VARCHAR(180);
      ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS image_mime VARCHAR(80);
      ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS image_size INTEGER;
      ALTER TABLE stock_items ALTER COLUMN serial_number DROP NOT NULL;
      ALTER TABLE stock_items DROP CONSTRAINT IF EXISTS stock_quantity_check;
      ALTER TABLE stock_items ADD CONSTRAINT stock_quantity_check CHECK (quantity >= 0);
      CREATE INDEX IF NOT EXISTS idx_stock_items_quantity ON stock_items(quantity);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_items_item_code_unique
        ON stock_items(item_code)
        WHERE item_code IS NOT NULL;
    `);
  }
  return runtimeSchemaPromise;
}

router.use(authenticate, async (req, res, next) => {
  try {
    await ensureStockRuntimeSchema();
    next();
  } catch (error) {
    next(error);
  }
});

const uploadStockImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedImageMimes.has(file.mimetype)) {
      return cb(new Error('Formato de imagen no permitido. Use JPG, PNG o WEBP.'));
    }
    cb(null, true);
  }
});

function handleStockImageUpload(req, res, next) {
  uploadStockImage.single('image')(req, res, (error) => {
    if (error) {
      error.status = 400;
      return next(error);
    }
    next();
  });
}

const stockSchema = z.object({
  location_id: z.coerce.number().int().positive(),
  area_id: z.coerce.number().int().positive(),
  item_code: z.string().trim().max(80).optional().nullable(),
  name: z.string().trim().min(2).max(140),
  model: z.string().trim().min(2).max(140),
  serial_number: z.string().trim().max(140).optional().nullable(),
  quantity: z.coerce.number().int().min(0).default(1),
  notes: z.string().trim().max(2000).optional().nullable()
});

function selectStockSql(where = '') {
  return `
    SELECT si.id, si.item_code, si.name, si.model, si.serial_number, si.quantity, si.status, si.notes,
           si.image_path, si.image_original_name, si.image_mime, si.image_size,
           si.created_at, si.updated_at,
           l.id AS location_id, l.name AS location,
           a.id AS area_id, a.name AS area,
           cu.name AS created_by_name, uu.name AS updated_by_name
    FROM stock_items si
    JOIN locations l ON l.id = si.location_id
    JOIN areas a ON a.id = si.area_id
    LEFT JOIN users cu ON cu.id = si.created_by
    LEFT JOIN users uu ON uu.id = si.updated_by
    ${where}
  `;
}

async function validateAreaLocation(client, data) {
  const { rows } = await client.query(
    'SELECT EXISTS (SELECT 1 FROM areas WHERE id = $1 AND location_id = $2) AS valid',
    [data.area_id, data.location_id]
  );
  if (!rows[0].valid) {
    const error = new Error('Area y ubicacion no coinciden.');
    error.status = 400;
    throw error;
  }
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const locationId = req.query.location_id ? Number(req.query.location_id) : null;
    const areaId = req.query.area_id ? Number(req.query.area_id) : null;
    const search = `%${String(req.query.search || '').trim()}%`;
    const params = [
      Number.isFinite(locationId) ? locationId : null,
      Number.isFinite(areaId) ? areaId : null,
      search
    ];
    const { rows } = await db.query(
      `${selectStockSql(`
        WHERE ($1::bigint IS NULL OR si.location_id = $1)
          AND ($2::bigint IS NULL OR si.area_id = $2)
          AND ($3 = '%%'
            OR COALESCE(si.item_code, '') ILIKE $3
            OR si.name ILIKE $3
            OR si.model ILIKE $3
            OR COALESCE(si.serial_number, '') ILIKE $3
            OR l.name ILIKE $3
            OR a.name ILIKE $3)
      `)}
       ORDER BY si.quantity ASC, si.updated_at DESC
       LIMIT 300`,
      params
    );
    const availability = await db.query(
      `SELECT l.id AS location_id,
              l.name AS location,
              a.id AS area_id,
              a.name AS area,
              COALESCE(SUM(si.quantity), 0)::int AS total,
              COALESCE(SUM(si.quantity), 0)::int AS available
       FROM stock_items si
       JOIN locations l ON l.id = si.location_id
       JOIN areas a ON a.id = si.area_id
       WHERE ($1::bigint IS NULL OR si.location_id = $1)
         AND ($2::bigint IS NULL OR si.area_id = $2)
         AND ($3 = '%%'
           OR COALESCE(si.item_code, '') ILIKE $3
           OR si.name ILIKE $3
           OR si.model ILIKE $3
           OR COALESCE(si.serial_number, '') ILIKE $3
           OR l.name ILIKE $3
           OR a.name ILIKE $3)
       GROUP BY l.id, l.name, a.id, a.name
       ORDER BY available ASC, total ASC, l.name ASC, a.name ASC
       LIMIT 100`,
      params
    );
    const available = rows.reduce((total, item) => total + Number(item.quantity || 0), 0);
    res.json({ items: rows, summary: { total: rows.length, available }, availability: availability.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, requireWriteAccess, async (req, res, next) => {
  try {
    const data = stockSchema.parse(req.body);
    const created = await db.withTransaction(async (client) => {
      await validateAreaLocation(client, data);
      const { rows } = await client.query(
        `INSERT INTO stock_items
         (location_id, area_id, item_code, name, model, serial_number, quantity, status, notes, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'disponible',$8,$9,$9)
         RETURNING *`,
        [
          data.location_id,
          data.area_id,
          data.item_code || null,
          data.name,
          data.model,
          data.serial_number || null,
          data.quantity,
          data.notes || null,
          req.user.id
        ]
      );
      await writeAudit(client, req, 'CREATE', 'stock_item', rows[0].id, rows[0]);
      return rows[0];
    });
    const { rows } = await db.query(`${selectStockSql('WHERE si.id = $1')}`, [created.id]);
    res.status(201).json({ item: rows[0] });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de stock invalidos.' });
    }
    if (error.code === '23505') {
      return res.status(409).json({ message: 'El ID o la serie ya existe en stock.' });
    }
    next(error);
  }
});

router.put('/:id', authenticate, requireWriteAccess, async (req, res, next) => {
  try {
    const data = stockSchema.parse(req.body);
    const updated = await db.withTransaction(async (client) => {
      await validateAreaLocation(client, data);
      const previous = await client.query('SELECT * FROM stock_items WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!previous.rows[0]) {
        const error = new Error('Dispositivo de stock no encontrado.');
        error.status = 404;
        throw error;
      }

      const { rows } = await client.query(
        `UPDATE stock_items
         SET location_id = $1,
             area_id = $2,
             item_code = $3,
             name = $4,
             model = $5,
             serial_number = $6,
             quantity = $7,
             status = 'disponible',
             notes = $8,
             updated_by = $9
         WHERE id = $10
         RETURNING *`,
        [
          data.location_id,
          data.area_id,
          data.item_code || null,
          data.name,
          data.model,
          data.serial_number || null,
          data.quantity,
          data.notes || null,
          req.user.id,
          req.params.id
        ]
      );
      await writeAudit(client, req, 'UPDATE', 'stock_item', req.params.id, {
        previous: previous.rows[0],
        current: rows[0]
      });
      return rows[0];
    });
    const { rows } = await db.query(`${selectStockSql('WHERE si.id = $1')}`, [updated.id]);
    res.json({ item: rows[0] });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de stock invalidos.' });
    }
    if (error.code === '23505') {
      return res.status(409).json({ message: 'El ID o la serie ya existe en stock.' });
    }
    next(error);
  }
});

router.get('/:id/image/view', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT image_path, image_mime
       FROM stock_items
       WHERE id = $1`,
      [req.params.id]
    );
    if (!rows[0]?.image_path) {
      return res.status(404).json({ message: 'Imagen no encontrada.' });
    }

    const buffer = await readStoredImage(rows[0].image_path);
    res.setHeader('Content-Type', rows[0].image_mime || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/image', authenticate, requireWriteAccess, handleStockImageUpload, async (req, res, next) => {
  let previousImagePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Imagen requerida.' });
    }

    const updated = await db.withTransaction(async (client) => {
      const previous = await client.query('SELECT * FROM stock_items WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!previous.rows[0]) {
        const error = new Error('Dispositivo de stock no encontrado.');
        error.status = 404;
        throw error;
      }
      previousImagePath = previous.rows[0].image_path;

      const imagePath = await storeStockImage(req.params.id, req.file);
      const { rows } = await client.query(
        `UPDATE stock_items
         SET image_path = $1,
             image_original_name = $2,
             image_mime = $3,
             image_size = $4,
             updated_by = $5
         WHERE id = $6
         RETURNING *`,
        [imagePath, req.file.originalname, req.file.mimetype, req.file.size, req.user.id, req.params.id]
      );

      await writeAudit(client, req, 'IMAGE_UPDATE', 'stock_item', req.params.id, {
        item_code: rows[0].item_code,
        image_path: imagePath
      });

      return rows[0];
    });

    if (previousImagePath && previousImagePath !== updated.image_path) {
      await deleteStockImage(previousImagePath);
    }

    const { rows } = await db.query(`${selectStockSql('WHERE si.id = $1')}`, [updated.id]);
    res.json({ item: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, requireWriteAccess, async (req, res, next) => {
  try {
    await db.withTransaction(async (client) => {
      const previous = await client.query('SELECT * FROM stock_items WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!previous.rows[0]) {
        const error = new Error('Dispositivo de stock no encontrado.');
        error.status = 404;
        throw error;
      }
      await client.query('DELETE FROM stock_items WHERE id = $1', [req.params.id]);
      await writeAudit(client, req, 'DELETE', 'stock_item', req.params.id, previous.rows[0]);
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
