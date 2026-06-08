const express = require('express');
const { z } = require('zod');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireWriteAccess } = require('../middleware/auth');
const { writeAudit } = require('../services/auditService');

const router = express.Router();

const simpleCatalogSchema = z.object({
  name: z.string().trim().min(2).max(80)
});

const modelSchema = z.object({
  brand_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(120)
});

const locationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(500).optional().nullable(),
  area_name: z.string().trim().min(2).max(120).default('General')
});

const areaSchema = z.object({
  location_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(120)
});

const catalogTables = {
  types: { table: 'equipment_types', entity: 'equipment_type', responseKey: 'type', maxLength: 80 },
  brands: { table: 'brands', entity: 'brand', responseKey: 'brand', maxLength: 80 },
  models: { table: 'equipment_models', entity: 'equipment_model', responseKey: 'model', maxLength: 120 },
  locations: { table: 'locations', entity: 'location', responseKey: 'location', maxLength: 120 },
  areas: { table: 'areas', entity: 'area', responseKey: 'area', maxLength: 120 }
};

function getCatalog(kind) {
  return catalogTables[kind] || null;
}

function parseCatalogUpdate(body, catalog) {
  return z.object({
    name: z.string().trim().min(2).max(catalog.maxLength)
  }).parse(body);
}

function catalogErrorResponse(error, action) {
  if (error.code === '23505') {
    return { status: 409, message: 'Ya existe un registro con ese nombre.' };
  }
  if (error.code === '23503') {
    return {
      status: 409,
      message: action === 'delete'
        ? 'No se puede eliminar porque tiene registros asociados.'
        : 'No se puede modificar porque tiene registros asociados.'
    };
  }
  return null;
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const [types, brands, models, locations, areas, suppliers, typeBrandModels] = await Promise.all([
      db.query('SELECT id, name FROM equipment_types ORDER BY name'),
      db.query('SELECT id, name FROM brands ORDER BY name'),
      db.query('SELECT id, brand_id, name FROM equipment_models ORDER BY name'),
      db.query('SELECT id, name, address FROM locations ORDER BY name'),
      db.query('SELECT id, location_id, name FROM areas ORDER BY name'),
      db.query(`
        SELECT DISTINCT supplier AS name
        FROM equipment
        WHERE deleted_at IS NULL
          AND NULLIF(TRIM(supplier), '') IS NOT NULL
        ORDER BY supplier
      `),
      db.query(`
        SELECT DISTINCT equipment_type_id, brand_id, model_id
        FROM equipment
        WHERE deleted_at IS NULL
        ORDER BY equipment_type_id, brand_id, model_id
      `)
    ]);

    res.json({
      types: types.rows,
      brands: brands.rows,
      models: models.rows,
      locations: locations.rows,
      areas: areas.rows,
      suppliers: suppliers.rows,
      type_brand_models: typeBrandModels.rows
    });
  } catch (error) {
    next(error);
  }
});

router.post('/types', authenticate, requireWriteAccess, async (req, res, next) => {
  try {
    const data = simpleCatalogSchema.parse(req.body);
    const type = await db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO equipment_types (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, name`,
        [data.name]
      );
      await writeAudit(client, req, 'CREATE', 'equipment_type', rows[0].id, rows[0]);
      return rows[0];
    });

    res.status(201).json({ type });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de tipo invalidos.' });
    }
    next(error);
  }
});

router.post('/brands', authenticate, requireWriteAccess, async (req, res, next) => {
  try {
    const data = simpleCatalogSchema.parse(req.body);
    const brand = await db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO brands (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, name`,
        [data.name]
      );
      await writeAudit(client, req, 'CREATE', 'brand', rows[0].id, rows[0]);
      return rows[0];
    });

    res.status(201).json({ brand });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de marca invalidos.' });
    }
    next(error);
  }
});

router.post('/models', authenticate, requireWriteAccess, async (req, res, next) => {
  try {
    const data = modelSchema.parse(req.body);
    const model = await db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO equipment_models (brand_id, name)
         VALUES ($1, $2)
         ON CONFLICT (brand_id, name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, brand_id, name`,
        [data.brand_id, data.name]
      );
      await writeAudit(client, req, 'CREATE', 'equipment_model', rows[0].id, rows[0]);
      return rows[0];
    });

    res.status(201).json({ model });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de modelo invalidos.' });
    }
    next(error);
  }
});

router.post('/locations', authenticate, requireWriteAccess, async (req, res, next) => {
  try {
    const data = locationSchema.parse(req.body);
    const result = await db.withTransaction(async (client) => {
      const locationResult = await client.query(
        `INSERT INTO locations (name, address)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET address = COALESCE(EXCLUDED.address, locations.address)
         RETURNING id, name, address`,
        [data.name, data.address || null]
      );

      const areaResult = await client.query(
        `INSERT INTO areas (location_id, name)
         VALUES ($1, $2)
         ON CONFLICT (location_id, name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, location_id, name`,
        [locationResult.rows[0].id, data.area_name || 'General']
      );

      await writeAudit(client, req, 'CREATE', 'location', locationResult.rows[0].id, {
        location: locationResult.rows[0],
        area: areaResult.rows[0]
      });

      return { location: locationResult.rows[0], area: areaResult.rows[0] };
    });

    res.status(201).json(result);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de ubicacion invalidos.' });
    }
    next(error);
  }
});

router.post('/areas', authenticate, requireWriteAccess, async (req, res, next) => {
  try {
    const data = areaSchema.parse(req.body);
    const area = await db.withTransaction(async (client) => {
      const exists = await client.query('SELECT id FROM locations WHERE id = $1', [data.location_id]);
      if (!exists.rows[0]) {
        const error = new Error('Ubicacion no encontrada.');
        error.status = 404;
        throw error;
      }

      const { rows } = await client.query(
        `INSERT INTO areas (location_id, name)
         VALUES ($1, $2)
         ON CONFLICT (location_id, name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, location_id, name`,
        [data.location_id, data.name]
      );
      await writeAudit(client, req, 'CREATE', 'area', rows[0].id, rows[0]);
      return rows[0];
    });

    res.status(201).json({ area });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de area invalidos.' });
    }
    next(error);
  }
});

router.put('/:kind/:id', authenticate, requireWriteAccess, async (req, res, next) => {
  const catalog = getCatalog(req.params.kind);
  if (!catalog) {
    return res.status(404).json({ message: 'Catalogo no encontrado.' });
  }

  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const data = parseCatalogUpdate(req.body, catalog);
    const item = await db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE ${catalog.table}
         SET name = $1
         WHERE id = $2
         RETURNING *`,
        [data.name, id]
      );
      if (!rows[0]) {
        const error = new Error('Registro no encontrado.');
        error.status = 404;
        throw error;
      }
      await writeAudit(client, req, 'UPDATE', catalog.entity, rows[0].id, rows[0]);
      return rows[0];
    });

    res.json({ [catalog.responseKey]: item });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de catalogo invalidos.' });
    }
    const knownError = catalogErrorResponse(error, 'update');
    if (knownError) {
      return res.status(knownError.status).json({ message: knownError.message });
    }
    next(error);
  }
});

const catalogFkTables = {
  equipment_types: { cols: ['equipment_type_id'] },
  brands: { cols: ['brand_id'] },
  equipment_models: { cols: ['model_id'] },
  locations: { cols: ['location_id'] },
  areas: { cols: ['area_id'] }
};

router.delete('/:kind/:id', authenticate, requireWriteAccess, async (req, res, next) => {
  const catalog = getCatalog(req.params.kind);
  if (!catalog) {
    return res.status(404).json({ message: 'Catalogo no encontrado.' });
  }

  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const item = await db.withTransaction(async (client) => {
      const fkInfo = catalogFkTables[catalog.table];
      if (fkInfo) {
        for (const table of ['equipment', 'stock_items']) {
          for (const column of fkInfo.cols) {
            try {
              await client.query(
                `UPDATE ${table} SET ${column} = NULL WHERE ${column} = $1`,
                [id]
              );
            } catch (_) {
              /* stock_items table may not exist */
            }
          }
        }
      }
      const { rows } = await client.query(
        `DELETE FROM ${catalog.table}
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      if (!rows[0]) {
        const error = new Error('Registro no encontrado.');
        error.status = 404;
        throw error;
      }
      await writeAudit(client, req, 'DELETE', catalog.entity, rows[0].id, rows[0]);
      return rows[0];
    });

    res.json({ [catalog.responseKey]: item });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de catalogo invalidos.' });
    }
    const knownError = catalogErrorResponse(error, 'delete');
    if (knownError) {
      return res.status(knownError.status).json({ message: knownError.message });
    }
    next(error);
  }
});

module.exports = router;
