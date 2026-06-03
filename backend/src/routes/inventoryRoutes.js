const express = require('express');
const path = require('path');
const multer = require('multer');
const { z } = require('zod');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const QRCode = require('qrcode');
const { parse } = require('csv-parse/sync');
const db = require('../config/db');
const { authenticate, requireWriteAccess } = require('../middleware/auth');
const { writeAudit } = require('../services/auditService');
const { allowedImageMimes, deleteEquipmentImage, readStoredImage, uploadEquipmentImage: storeEquipmentImage } = require('../services/storageService');

const router = express.Router();

const uploadEquipmentImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedImageMimes.has(file.mimetype)) {
      return cb(new Error('Formato de imagen no permitido. Use JPG, PNG o WEBP.'));
    }
    cb(null, true);
  }
});
const uploadCsvImport = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.csv', '.txt'].includes(ext)) {
      return cb(new Error('Use un archivo CSV.'));
    }
    cb(null, true);
  }
});

function handleEquipmentImageUpload(req, res, next) {
  uploadEquipmentImage.single('image')(req, res, (error) => {
    if (error) {
      error.status = 400;
      return next(error);
    }
    next();
  });
}

function handleCsvImportUpload(req, res, next) {
  uploadCsvImport.single('file')(req, res, (error) => {
    if (error) {
      error.status = 400;
      return next(error);
    }
    next();
  });
}

let runtimeSchemaPromise;

function ensureEquipmentRuntimeSchema() {
  if (!runtimeSchemaPromise) {
    runtimeSchemaPromise = db.query(`
      ALTER TABLE equipment ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE equipment DROP CONSTRAINT IF EXISTS equipment_quantity_check;
      ALTER TABLE equipment ADD CONSTRAINT equipment_quantity_check CHECK (quantity >= 0);
      CREATE INDEX IF NOT EXISTS idx_equipment_quantity ON equipment(quantity);
    `);
  }
  return runtimeSchemaPromise;
}

const optionalDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional().nullable();
const assetTypeNames = [
  'laptop',
  'laptops',
  'monitor',
  'monitores',
  'desktop',
  'destoktop',
  'destoktops',
  'projector',
  'proyector',
  'proyectores',
  'pryector',
  'pryectores',
  'router',
  'routers',
  'server',
  'servers',
  'switch',
  'tablet',
  'tablets',
  'telefono',
  'phone',
  'ups',
  'upc',
  'workstation',
  'workstations',
  'workstacion'
];

const equipmentSchema = z.object({
  equipment_type_id: z.coerce.number().int().positive(),
  brand_id: z.coerce.number().int().positive(),
  model_id: z.coerce.number().int().positive(),
  location_id: z.coerce.number().int().positive(),
  area_id: z.coerce.number().int().positive(),
  serial_number: z.string().trim().min(2).max(140),
  asset_tag: z.string().trim().max(80).optional().nullable(),
  assigned_user: z.string().trim().max(140).optional().nullable(),
  quantity: z.coerce.number().int().min(0).default(1),
  status: z.enum(['activo', 'mantenimiento', 'baja', 'resguardo']).default('activo'),
  notes: z.string().trim().max(2000).optional().nullable(),
  supplier: z.string().trim().max(140).optional().nullable(),
  purchase_date: optionalDateSchema,
  warranty_until: optionalDateSchema
});

router.use(authenticate, async (req, res, next) => {
  try {
    await ensureEquipmentRuntimeSchema();
    next();
  } catch (error) {
    next(error);
  }
});

function nullableDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1990 || year > 2100) {
    const error = new Error('La fecha debe estar entre 1990 y 2100.');
    error.status = 400;
    throw error;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  const isValidDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValidDate) {
    const error = new Error('Fecha invalida.');
    error.status = 400;
    throw error;
  }
  return value;
}

function zodMessage(error) {
  const first = error.errors?.[0];
  const field = first?.path?.join('.') || 'campo';
  if (['purchase_date', 'warranty_until'].includes(field)) {
    return 'Revise las fechas. Use un valor valido entre 1990 y 2100 o dejelas vacias.';
  }
  if (first?.message) {
    return `Dato invalido en ${field}: ${first.message}`;
  }
  return 'Datos de equipo invalidos.';
}

function uniqueEquipmentMessage(error) {
  if (error.code !== '23505') return '';
  if (error.constraint === 'equipment_serial_number_key') {
    return 'La serie ya existe en inventario. Busque el equipo existente o use otra serie.';
  }
  if (error.constraint === 'equipment_asset_tag_key') {
    return 'El ID de inventario ya existe. Use otro ID o actualice el equipo existente.';
  }
  return 'Ya existe un registro con datos unicos repetidos.';
}

function selectEquipmentSql(where = '') {
  return `
    SELECT e.id, e.serial_number, e.asset_tag, e.assigned_user, e.quantity, e.status, e.notes,
           e.supplier, e.purchase_date, e.warranty_until,
           e.image_path, e.image_original_name, e.image_mime, e.image_size,
           e.created_at, e.updated_at, e.deleted_at,
           et.name AS equipment_type, b.name AS brand, em.name AS model,
           l.name AS location, a.name AS area,
           cu.name AS created_by_name, uu.name AS updated_by_name
    FROM equipment e
    JOIN equipment_types et ON et.id = e.equipment_type_id
    JOIN brands b ON b.id = e.brand_id
    JOIN equipment_models em ON em.id = e.model_id
    JOIN locations l ON l.id = e.location_id
    JOIN areas a ON a.id = e.area_id
    LEFT JOIN users cu ON cu.id = e.created_by
    LEFT JOIN users uu ON uu.id = e.updated_by
    ${where}
  `;
}

function buildEquipmentFilters(req) {
  const search = `%${String(req.query.search || '').trim()}%`;
  const typeId = req.query.type_id ? Number(req.query.type_id) : null;
  const brandId = req.query.brand_id ? Number(req.query.brand_id) : null;
  const modelId = req.query.model_id ? Number(req.query.model_id) : null;
  const status = req.query.status ? String(req.query.status).trim().toLowerCase() : null;
  const scope = ['accessories', 'equipment'].includes(req.query.scope) ? req.query.scope : null;
  const supplierSearch = isPrivilegedRequest(req) ? "OR COALESCE(e.supplier, '') ILIKE $1" : '';
  return {
    where: `
      WHERE e.deleted_at IS NULL
        AND ($1 = '%%'
          OR e.serial_number ILIKE $1
          OR COALESCE(e.asset_tag, '') ILIKE $1
          OR COALESCE(e.assigned_user, '') ILIKE $1
          ${supplierSearch}
          OR et.name ILIKE $1
          OR b.name ILIKE $1
          OR em.name ILIKE $1
          OR l.name ILIKE $1
          OR a.name ILIKE $1)
        AND ($2::bigint IS NULL OR e.equipment_type_id = $2)
        AND ($3::text IS NULL OR e.status = $3)
        AND (
          $4::text IS NULL
          OR ($4 = 'accessories' AND NOT (LOWER(et.name) = ANY($5::text[])))
          OR ($4 = 'equipment' AND LOWER(et.name) = ANY($5::text[]))
        )
        AND ($6::bigint IS NULL OR e.brand_id = $6)
        AND ($7::bigint IS NULL OR e.model_id = $7)
    `,
    params: [
      search,
      Number.isFinite(typeId) ? typeId : null,
      status || null,
      scope,
      assetTypeNames,
      Number.isFinite(brandId) ? brandId : null,
      Number.isFinite(modelId) ? modelId : null
    ]
  };
}

async function validateCatalogRelations(client, data) {
  const { rows } = await client.query(
    `SELECT
       EXISTS (
         SELECT 1
         FROM equipment_models
         WHERE id = $1 AND brand_id = $2
       ) AS model_matches_brand,
       EXISTS (
         SELECT 1
         FROM areas
         WHERE id = $3 AND location_id = $4
       ) AS area_matches_location`,
    [data.model_id, data.brand_id, data.area_id, data.location_id]
  );

  if (!rows[0].model_matches_brand || !rows[0].area_matches_location) {
    const error = new Error('Modelo/marca o area/ubicacion no coinciden.');
    error.status = 400;
    throw error;
  }
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/Ã¡/g, 'a')
    .replace(/Ã©/g, 'e')
    .replace(/Ã­/g, 'i')
    .replace(/Ã³/g, 'o')
    .replace(/Ãº/g, 'u')
    .replace(/Ã±/g, 'n')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeImportRow(row) {
  const read = (...names) => {
    const normalizedNames = names.map(normalizeHeader);
    for (const keyName of Object.keys(row)) {
      const key = normalizedNames.includes(normalizeHeader(keyName)) ? keyName : '';
      if (key && String(row[key] || '').trim()) return String(row[key]).trim();
    }
    return '';
  };

  return {
    serial_number: read('serial_number', 'serie', 'numero de serie', 'número de serie'),
    asset_tag: read('asset_tag', 'id equipo', 'id del equipo', 'id de inventario', 'etiqueta', 'activo'),
    assigned_user: read('assigned_user', 'usuario', 'usuario asignado', 'nombre de usuario'),
    equipment_type: read('equipment_type', 'tipo', 'categoria', 'categoría') || 'Equipo',
    brand: read('brand', 'marca') || 'Generic',
    model: read('model', 'modelo') || 'Generico',
    location: read('location', 'ubicacion', 'ubicación') || 'Sin ubicacion',
    area: read('area') || 'General',
    status: (read('status', 'estado') || 'activo').toLowerCase(),
    notes: read('notes', 'notas'),
    supplier: read('supplier', 'proveedor'),
    purchase_date: read('purchase_date', 'fecha compra', 'fecha de compra'),
    warranty_until: read('warranty_until', 'garantia', 'garantía', 'garantia hasta')
  };
}

function detectCsvDelimiter(content) {
  const firstLine = content.split(/\r?\n/).find((line) => line.trim()) || '';
  const ranked = [',', ';', '\t']
    .map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length - 1 }))
    .sort((a, b) => b.count - a.count);
  return ranked[0].count > 0 ? ranked[0].delimiter : ',';
}

async function upsertImportCatalogs(client, row) {
  const type = await client.query(
    `INSERT INTO equipment_types (name)
     VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [row.equipment_type]
  );
  const brand = await client.query(
    `INSERT INTO brands (name)
     VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [row.brand]
  );
  const model = await client.query(
    `INSERT INTO equipment_models (brand_id, name)
     VALUES ($1, $2)
     ON CONFLICT (brand_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [brand.rows[0].id, row.model]
  );
  const location = await client.query(
    `INSERT INTO locations (name)
     VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [row.location]
  );
  const area = await client.query(
    `INSERT INTO areas (location_id, name)
     VALUES ($1, $2)
     ON CONFLICT (location_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [location.rows[0].id, row.area]
  );

  return {
    equipment_type_id: type.rows[0].id,
    brand_id: brand.rows[0].id,
    model_id: model.rows[0].id,
    location_id: location.rows[0].id,
    area_id: area.rows[0].id
  };
}

function equipmentQrUrl(req, id) {
  return `${req.protocol}://${req.get('host')}/?equipment=${encodeURIComponent(id)}`;
}

function isPrivilegedRequest(req) {
  return ['ADMIN', 'TI'].includes(req.user?.role);
}

function readonlyEquipmentItem(item) {
  if (!item) return item;
  const {
    supplier,
    purchase_date,
    notes,
    created_by_name,
    updated_by_name,
    deleted_at,
    ...readonlyItem
  } = item;
  return readonlyItem;
}

function readonlyMaintenanceItem(item) {
  if (!item) return item;
  const { notes, created_by_name, updated_by_name, ...readonlyItem } = item;
  return readonlyItem;
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
    const page = Math.max(Number(req.query.page || 1), 1);
    const offset = (page - 1) * limit;
    const filters = buildEquipmentFilters(req);
    const [items, total] = await Promise.all([
      db.query(
        `${selectEquipmentSql(filters.where)}
         ORDER BY e.updated_at DESC
         LIMIT $8 OFFSET $9`,
        [...filters.params, limit, offset]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total
         FROM equipment e
         JOIN equipment_types et ON et.id = e.equipment_type_id
         JOIN brands b ON b.id = e.brand_id
         JOIN equipment_models em ON em.id = e.model_id
         JOIN locations l ON l.id = e.location_id
         JOIN areas a ON a.id = e.area_id
         ${filters.where}`,
        filters.params
      )
    ]);

    const privileged = isPrivilegedRequest(req);

    res.json({
      items: privileged ? items.rows : items.rows.map(readonlyEquipmentItem),
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

router.get('/export/pdf', authenticate, async (req, res, next) => {
  try {
    const filters = buildEquipmentFilters(req);
    const { rows } = await db.query(
      `${selectEquipmentSql(filters.where)}
       ORDER BY e.updated_at DESC
       LIMIT 1000`,
      filters.params
    );

    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    const fileName = `sati-timsa-inventario-${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    doc.pipe(res);

    const reportTitle = req.query.scope === 'accessories'
      ? 'SATI-TIMSA - Inventario de accesorios'
      : 'SATI-TIMSA - Inventario de activos';

    doc.fontSize(18).text(reportTitle, { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#4b5563').text(`Generado: ${new Date().toLocaleString('es-MX')} | Registros: ${rows.length}`);
    doc.moveDown();

    const columns = [
      ['ID', 36, 44],
      ['Tipo', 80, 66],
      ['Marca', 146, 62],
      ['Modelo', 208, 100],
      ['Serie', 308, 84],
      ['ID Inv.', 392, 62],
      ['Ubicacion', 454, 68],
      ['Area', 522, 102],
      ['Usuario', 624, 134]
    ];

    function drawHeader(y) {
      doc.rect(36, y - 4, 742, 18).fill('#0f2f4f');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      columns.forEach(([title, x, width]) => doc.text(title, x, y, { width }));
      doc.font('Helvetica').fillColor('#111827');
    }

    let y = 104;
    drawHeader(y);
    y += 22;

    rows.forEach((item, index) => {
      if (y > 535) {
        doc.addPage();
        y = 48;
        drawHeader(y);
        y += 22;
      }

      if (index % 2 === 0) {
        doc.rect(36, y - 4, 742, 18).fill('#f3f4f6');
      }

      doc.fillColor('#111827').fontSize(7.5);
      const values = [
        String(item.id).slice(0, 8),
        item.equipment_type,
        item.brand,
        item.model,
        item.serial_number,
        item.asset_tag || '',
        item.location,
        item.area,
        item.assigned_user || 'Sin asignar'
      ];

      columns.forEach(([, x, width], columnIndex) => {
        doc.text(String(values[columnIndex] || ''), x, y, { width, height: 16, ellipsis: true });
      });

      y += 18;
    });

    doc.end();
  } catch (error) {
    next(error);
  }
});

router.get('/export/xlsx', authenticate, async (req, res, next) => {
  try {
    const filters = buildEquipmentFilters(req);
    const { rows } = await db.query(
      `${selectEquipmentSql(filters.where)}
       ORDER BY e.updated_at DESC
       LIMIT 5000`,
      filters.params
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SATI-TIMSA';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet(req.query.scope === 'accessories' ? 'Accesorios' : 'Activos', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 14 },
      { header: 'Tipo', key: 'equipment_type', width: 18 },
      { header: 'Marca', key: 'brand', width: 18 },
      { header: 'Modelo', key: 'model', width: 24 },
      { header: 'Numero de serie', key: 'serial_number', width: 24 },
      { header: 'ID de inventario', key: 'asset_tag', width: 20 },
      { header: 'Ubicacion', key: 'location', width: 18 },
      { header: 'Area', key: 'area', width: 24 },
      { header: 'Usuario', key: 'assigned_user', width: 24 },
      { header: 'Cantidad', key: 'quantity', width: 12 },
      { header: 'Estado', key: 'status', width: 16 },
      { header: 'Proveedor', key: 'supplier', width: 22 },
      { header: 'Fecha de compra', key: 'purchase_date', width: 18 },
      { header: 'Garantia hasta', key: 'warranty_until', width: 18 },
      { header: 'Tiene imagen', key: 'has_image', width: 14 },
      { header: 'Ultima actualizacion', key: 'updated_at', width: 24 }
    ];

    rows.forEach((item) => {
      worksheet.addRow({
        id: item.id,
        equipment_type: item.equipment_type,
        brand: item.brand,
        model: item.model,
        serial_number: item.serial_number,
        asset_tag: item.asset_tag || '',
        location: item.location,
        area: item.area,
        assigned_user: item.assigned_user || '',
        quantity: Number(item.quantity || 0),
        status: item.status,
        supplier: item.supplier || '',
        purchase_date: item.purchase_date ? String(item.purchase_date).slice(0, 10) : '',
        warranty_until: item.warranty_until ? String(item.warranty_until).slice(0, 10) : '',
        has_image: item.image_path ? 'Si' : 'No',
        updated_at: item.updated_at ? new Date(item.updated_at).toLocaleString('es-MX') : ''
      });
    });

    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2D57' } };
      cell.alignment = { vertical: 'middle' };
    });
    worksheet.autoFilter = {
      from: 'A1',
      to: `P${Math.max(rows.length + 1, 1)}`
    };

    const fileName = `sati-timsa-inventario-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

router.post('/import/csv', authenticate, requireWriteAccess, handleCsvImportUpload, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Archivo CSV requerido.' });
    }

    const dryRun = String(req.query.dry_run || req.body?.dry_run || 'true') !== 'false';
    const csvContent = req.file.buffer.toString('utf8');
    const records = parse(csvContent, {
      columns: true,
      bom: true,
      delimiter: detectCsvDelimiter(csvContent),
      skip_empty_lines: true,
      trim: true
    }).map(normalizeImportRow);

    const seen = new Set();
    const serials = records.map((row) => row.serial_number).filter(Boolean);
    const existing = serials.length
      ? await db.query('SELECT serial_number FROM equipment WHERE serial_number = ANY($1::text[]) AND deleted_at IS NULL', [serials])
      : { rows: [] };
    const existingSerials = new Set(existing.rows.map((row) => row.serial_number));

    const preview = records.map((row, index) => {
      const errors = [];
      if (!row.serial_number) errors.push('Serie requerida.');
      if (row.serial_number && seen.has(row.serial_number)) errors.push('Serie duplicada en archivo.');
      if (existingSerials.has(row.serial_number)) errors.push('Serie ya existe en inventario.');
      if (!['activo', 'mantenimiento', 'baja', 'resguardo'].includes(row.status)) errors.push('Estado invalido.');
      try {
        nullableDate(row.purchase_date);
        nullableDate(row.warranty_until);
      } catch (error) {
        errors.push(error.message);
      }
      if (row.serial_number) seen.add(row.serial_number);
      return { row_number: index + 2, data: row, errors };
    });

    const validRows = preview.filter((item) => item.errors.length === 0);
    const invalidRows = preview.filter((item) => item.errors.length > 0);
    if (dryRun || invalidRows.length > 0) {
      return res.json({
        dry_run: true,
        ready: invalidRows.length === 0,
        total: preview.length,
        valid: validRows.length,
        invalid: invalidRows.length,
        rows: preview.slice(0, 200)
      });
    }

    const imported = await db.withTransaction(async (client) => {
      const inserted = [];
      for (const item of validRows) {
        const row = item.data;
        const catalog = await upsertImportCatalogs(client, row);
        const { rows } = await client.query(
          `INSERT INTO equipment
           (equipment_type_id, brand_id, model_id, location_id, area_id, serial_number, asset_tag, assigned_user, status, notes, supplier, purchase_date, warranty_until, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
           RETURNING *`,
          [
            catalog.equipment_type_id,
            catalog.brand_id,
            catalog.model_id,
            catalog.location_id,
            catalog.area_id,
            row.serial_number,
            row.asset_tag || null,
            row.assigned_user || null,
            row.status,
            row.notes || null,
            row.supplier || null,
            nullableDate(row.purchase_date),
            nullableDate(row.warranty_until),
            req.user.id
          ]
        );
        await client.query(
          `INSERT INTO equipment_history (equipment_id, changed_by, event_type, new_data)
           VALUES ($1, $2, 'IMPORTED', $3::jsonb)`,
          [rows[0].id, req.user.id, JSON.stringify(rows[0])]
        );
        inserted.push(rows[0]);
      }
      await writeAudit(client, req, 'IMPORT_CSV', 'equipment', null, {
        imported: inserted.length,
        file: req.file.originalname
      });
      return inserted;
    });

    res.status(201).json({ imported: imported.length, items: imported });
  } catch (error) {
    if (error.code === 'CSV_INVALID_CLOSING_QUOTE' || error.code === 'CSV_RECORD_INCONSISTENT_COLUMNS') {
      return res.status(400).json({ message: 'CSV invalido. Revise encabezados, comillas y separadores.' });
    }
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const item = await db.query(
      `${selectEquipmentSql('WHERE e.id = $1 AND e.deleted_at IS NULL')}`,
      [req.params.id]
    );
    if (!item.rows[0]) {
      return res.status(404).json({ message: 'Equipo no encontrado.' });
    }

    const privileged = isPrivilegedRequest(req);
    const [history, maintenance, audit] = await Promise.all([
      privileged
        ? db.query(
          `SELECT h.id, h.event_type, h.previous_data, h.new_data, h.created_at,
                  h.previous_data->>'assigned_user' AS previous_assigned_user,
                  h.new_data->>'assigned_user' AS assigned_user,
                  u.name AS changed_by
           FROM equipment_history h
           LEFT JOIN users u ON u.id = h.changed_by
           WHERE h.equipment_id = $1
           ORDER BY h.created_at DESC
           LIMIT 20`,
          [req.params.id]
        )
        : Promise.resolve({ rows: [] }),
      db.query(
        `SELECT mo.id, mo.phase, mo.notes, mo.sent_at, mo.updated_at, cu.name AS created_by_name, uu.name AS updated_by_name
         FROM maintenance_orders mo
         LEFT JOIN users cu ON cu.id = mo.created_by
         LEFT JOIN users uu ON uu.id = mo.updated_by
         WHERE mo.equipment_id = $1
           AND mo.phase <> 'terminado'
         ORDER BY mo.updated_at DESC
         LIMIT 10`,
        [req.params.id]
      ),
      privileged
        ? db.query(
          `SELECT al.id, al.action, al.entity, al.created_at, u.username
           FROM audit_logs al
           LEFT JOIN users u ON u.id = al.user_id
           WHERE al.entity = 'equipment' AND al.entity_id = $1
           ORDER BY al.created_at DESC
           LIMIT 10`,
          [req.params.id]
        )
        : Promise.resolve({ rows: [] })
    ]);

    const qr_data_url = await QRCode.toDataURL(equipmentQrUrl(req, req.params.id), {
      margin: 1,
      width: 180
    });

    res.json({
      item: privileged ? item.rows[0] : readonlyEquipmentItem(item.rows[0]),
      history: history.rows,
      maintenance: privileged ? maintenance.rows : maintenance.rows.map(readonlyMaintenanceItem),
      audit: audit.rows,
      qr_url: equipmentQrUrl(req, req.params.id),
      qr_data_url
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/qr', authenticate, async (req, res, next) => {
  try {
    const exists = await db.query('SELECT id FROM equipment WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (!exists.rows[0]) {
      return res.status(404).json({ message: 'Equipo no encontrado.' });
    }
    res.json({
      qr_url: equipmentQrUrl(req, req.params.id),
      qr_data_url: await QRCode.toDataURL(equipmentQrUrl(req, req.params.id), { margin: 1, width: 220 })
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/history', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT h.id, h.event_type, h.previous_data, h.new_data, h.created_at,
              h.previous_data->>'assigned_user' AS previous_assigned_user,
              h.new_data->>'assigned_user' AS assigned_user,
              u.name AS changed_by
       FROM equipment_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.equipment_id = $1
       ORDER BY h.created_at DESC`,
      [req.params.id]
    );
    res.json({ history: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/image/view', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT image_path, image_mime
       FROM equipment
       WHERE id = $1 AND deleted_at IS NULL`,
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

router.post('/:id/image', authenticate, requireWriteAccess, handleEquipmentImageUpload, async (req, res, next) => {
  let previousImagePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Imagen requerida.' });
    }

    const updated = await db.withTransaction(async (client) => {
      const previous = await client.query('SELECT * FROM equipment WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [req.params.id]);
      if (!previous.rows[0]) {
        const error = new Error('Equipo no encontrado.');
        error.status = 404;
        throw error;
      }
      previousImagePath = previous.rows[0].image_path;

      const imagePath = await storeEquipmentImage(req.params.id, req.file);
      const { rows } = await client.query(
        `UPDATE equipment
         SET image_path = $1,
             image_original_name = $2,
             image_mime = $3,
             image_size = $4,
             updated_by = $5
         WHERE id = $6 AND deleted_at IS NULL
         RETURNING *`,
        [imagePath, req.file.originalname, req.file.mimetype, req.file.size, req.user.id, req.params.id]
      );

      await client.query(
        `INSERT INTO equipment_history (equipment_id, changed_by, event_type, previous_data, new_data)
         VALUES ($1, $2, 'IMAGE_UPDATED', $3::jsonb, $4::jsonb)`,
        [req.params.id, req.user.id, JSON.stringify(previous.rows[0]), JSON.stringify(rows[0])]
      );
      await writeAudit(client, req, 'IMAGE_UPDATE', 'equipment', req.params.id, {
        serial_number: rows[0].serial_number,
        image_path: imagePath
      });

      return rows[0];
    });

    if (previousImagePath && previousImagePath !== updated.image_path) {
      await deleteEquipmentImage(previousImagePath);
    }

    res.json({ item: updated });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, requireWriteAccess, async (req, res, next) => {
  try {
    const data = equipmentSchema.parse(req.body);
    const created = await db.withTransaction(async (client) => {
      await validateCatalogRelations(client, data);

      const { rows } = await client.query(
        `INSERT INTO equipment
         (equipment_type_id, brand_id, model_id, location_id, area_id, serial_number, asset_tag, assigned_user, quantity, status, notes, supplier, purchase_date, warranty_until, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
         RETURNING *`,
        [
          data.equipment_type_id,
          data.brand_id,
          data.model_id,
          data.location_id,
          data.area_id,
          data.serial_number,
          data.asset_tag || null,
          data.assigned_user || null,
          data.quantity,
          data.status,
          data.notes || null,
          data.supplier || null,
          nullableDate(data.purchase_date),
          nullableDate(data.warranty_until),
          req.user.id
        ]
      );

      await client.query(
        `INSERT INTO equipment_history (equipment_id, changed_by, event_type, new_data)
         VALUES ($1, $2, 'CREATED', $3::jsonb)`,
        [rows[0].id, req.user.id, JSON.stringify(rows[0])]
      );
      await writeAudit(client, req, 'CREATE', 'equipment', rows[0].id, { serial_number: rows[0].serial_number });
      return rows[0];
    });

    res.status(201).json({ item: created });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: zodMessage(error) });
    }
    const uniqueMessage = uniqueEquipmentMessage(error);
    if (uniqueMessage) return res.status(409).json({ message: uniqueMessage });
    if (error.status === 400) return res.status(400).json({ message: error.message });
    next(error);
  }
});

router.put('/:id', authenticate, requireWriteAccess, async (req, res, next) => {
  try {
    const data = equipmentSchema.parse(req.body);
    const updated = await db.withTransaction(async (client) => {
      await validateCatalogRelations(client, data);

      const previous = await client.query('SELECT * FROM equipment WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [req.params.id]);
      if (!previous.rows[0]) {
        const error = new Error('Equipo no encontrado.');
        error.status = 404;
        throw error;
      }

      const { rows } = await client.query(
        `UPDATE equipment
         SET equipment_type_id=$1, brand_id=$2, model_id=$3, location_id=$4, area_id=$5,
             serial_number=$6, asset_tag=$7, assigned_user=$8, quantity=$9, status=$10, notes=$11,
             supplier=$12, purchase_date=$13, warranty_until=$14, updated_by=$15
         WHERE id=$16 AND deleted_at IS NULL
         RETURNING *`,
        [
          data.equipment_type_id,
          data.brand_id,
          data.model_id,
          data.location_id,
          data.area_id,
          data.serial_number,
          data.asset_tag || null,
          data.assigned_user || null,
          data.quantity,
          data.status,
          data.notes || null,
          data.supplier || null,
          nullableDate(data.purchase_date),
          nullableDate(data.warranty_until),
          req.user.id,
          req.params.id
        ]
      );

      if (!rows[0]) {
        const error = new Error('Equipo no encontrado.');
        error.status = 404;
        throw error;
      }

      await client.query(
        `INSERT INTO equipment_history (equipment_id, changed_by, event_type, previous_data, new_data)
         VALUES ($1, $2, 'UPDATED', $3::jsonb, $4::jsonb)`,
        [req.params.id, req.user.id, JSON.stringify(previous.rows[0]), JSON.stringify(rows[0])]
      );
      await writeAudit(client, req, 'UPDATE', 'equipment', req.params.id, { serial_number: rows[0].serial_number });
      return rows[0];
    });

    res.json({ item: updated });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: zodMessage(error) });
    }
    const uniqueMessage = uniqueEquipmentMessage(error);
    if (uniqueMessage) return res.status(409).json({ message: uniqueMessage });
    if (error.status === 400) return res.status(400).json({ message: error.message });
    next(error);
  }
});

router.delete('/:id', authenticate, requireWriteAccess, async (req, res, next) => {
  try {
    await db.withTransaction(async (client) => {
      const previous = await client.query('SELECT * FROM equipment WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [req.params.id]);
      if (!previous.rows[0]) {
        const error = new Error('Equipo no encontrado.');
        error.status = 404;
        throw error;
      }

      const deleted = await client.query(
        `UPDATE equipment
         SET deleted_at = NOW(), deleted_by = $2, updated_by = $2, status = 'baja'
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [req.params.id, req.user.id]
      );
      await client.query(
        `INSERT INTO equipment_history (equipment_id, changed_by, event_type, previous_data, new_data)
         VALUES ($1, $2, 'SOFT_DELETED', $3::jsonb, $4::jsonb)`,
        [req.params.id, req.user.id, JSON.stringify(previous.rows[0]), JSON.stringify(deleted.rows[0])]
      );
      await writeAudit(client, req, 'SOFT_DELETE', 'equipment', req.params.id, previous.rows[0]);
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
