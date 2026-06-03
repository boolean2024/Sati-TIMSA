const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const uploadsRoot = path.join(process.cwd(), 'uploads');
const allowedImageMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const extensionByMime = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

function assertValidImage(file) {
  if (!file) {
    const error = new Error('Imagen requerida.');
    error.status = 400;
    throw error;
  }
  if (!allowedImageMimes.has(file.mimetype)) {
    const error = new Error('Formato de imagen no permitido. Use JPG, PNG o WEBP.');
    error.status = 400;
    throw error;
  }
}

function safeFileName(itemId, file) {
  const extension = extensionByMime[file.mimetype] || '.jpg';
  return `${itemId}-${Date.now()}${extension}`;
}

function requireSupabaseConfig() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey || !env.supabaseBucket) {
    const error = new Error('Faltan variables de Supabase Storage para subir imagenes.');
    error.status = 503;
    throw error;
  }
}

function getPublicObjectUrl(objectPath) {
  const baseUrl = env.supabaseUrl.replace(/\/$/, '');
  return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(env.supabaseBucket)}/${objectPath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

function supabaseHeaders(extraHeaders = {}) {
  return {
    Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
    apikey: env.supabaseServiceRoleKey,
    ...extraHeaders
  };
}

function bucketNotFound(status, message) {
  return status === 404 && /bucket not found/i.test(message || '');
}

async function ensureSupabaseBucket() {
  requireSupabaseConfig();
  const bucketUrl = `${env.supabaseUrl.replace(/\/$/, '')}/storage/v1/bucket`;
  const response = await fetch(bucketUrl, {
    method: 'POST',
    headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      id: env.supabaseBucket,
      name: env.supabaseBucket,
      public: true,
      file_size_limit: 5242880,
      allowed_mime_types: Array.from(allowedImageMimes)
    })
  });

  if (response.ok || response.status === 409) {
    return;
  }

  const message = await response.text().catch(() => '');
  const error = new Error('No se pudo crear el bucket de Supabase Storage. Verifique las credenciales de Supabase.');
  error.status = response.status === 401 || response.status === 403 ? 503 : 502;
  throw error;
}

function getSupabaseObjectPath(imagePath) {
  if (!imagePath || !env.supabaseUrl) return '';
  const marker = `/storage/v1/object/public/${env.supabaseBucket}/`;
  const index = imagePath.indexOf(marker);
  if (index === -1) return '';
  return decodeURIComponent(imagePath.slice(index + marker.length));
}

async function uploadLocalImage(kind, itemId, file) {
  if (env.nodeEnv === 'production' || process.env.VERCEL) {
    const error = new Error('Las imagenes en produccion deben subirse a Supabase Storage. Configure STORAGE_DRIVER=supabase, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y SUPABASE_BUCKET en Vercel.');
    error.status = 503;
    throw error;
  }

  const uploadRoot = path.join(uploadsRoot, kind);
  fs.mkdirSync(uploadRoot, { recursive: true });
  const fileName = safeFileName(itemId, file);
  const targetPath = path.join(uploadRoot, fileName);

  if (file.buffer) {
    await fs.promises.writeFile(targetPath, file.buffer);
  } else if (file.path) {
    await fs.promises.rename(file.path, targetPath);
  } else {
    const error = new Error('No se pudo procesar la imagen.');
    error.status = 400;
    throw error;
  }

  return `/uploads/${kind}/${fileName}`;
}

async function uploadSupabaseImage(kind, itemId, file) {
  requireSupabaseConfig();
  const objectPath = `${kind}/${safeFileName(itemId, file)}`;
  const uploadUrl = `${env.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(env.supabaseBucket)}/${objectPath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

  const upload = () => fetch(uploadUrl, {
    method: 'POST',
    headers: supabaseHeaders({
      'Content-Type': file.mimetype,
      'Cache-Control': '31536000',
      'x-upsert': 'false'
    }),
    body: file.buffer
  });

  let response = await upload();
  if (!response.ok) {
    let message = await response.text().catch(() => '');
    if (bucketNotFound(response.status, message)) {
      await ensureSupabaseBucket();
      response = await upload();
      if (response.ok) {
        return getPublicObjectUrl(objectPath);
      }
      message = await response.text().catch(() => '');
    }
    const error = new Error('No se pudo subir la imagen a Supabase Storage. Verifique la configuracion de almacenamiento.');
    error.status = response.status === 404 ? 503 : 502;
    throw error;
  }

  return getPublicObjectUrl(objectPath);
}

async function uploadAssetImage(kind, itemId, file) {
  assertValidImage(file);
  if (env.storageDriver === 'supabase') {
    return uploadSupabaseImage(kind, itemId, file);
  }
  return uploadLocalImage(kind, itemId, file);
}

async function uploadEquipmentImage(equipmentId, file) {
  return uploadAssetImage('equipment', equipmentId, file);
}

async function uploadStockImage(stockId, file) {
  return uploadAssetImage('stock', stockId, file);
}

async function deleteEquipmentImage(imagePath) {
  if (!imagePath) return;

  if (imagePath.startsWith('/uploads/')) {
    const oldPath = path.join(process.cwd(), imagePath.replace(/^\//, ''));
    await fs.promises.unlink(oldPath).catch(() => {});
    return;
  }

  if (env.storageDriver !== 'supabase') return;
  const objectPath = getSupabaseObjectPath(imagePath);
  if (!objectPath) return;
  requireSupabaseConfig();

  const deleteUrl = `${env.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(env.supabaseBucket)}`;
  await fetch(deleteUrl, {
    method: 'DELETE',
    headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: [objectPath] })
  }).catch(() => {});
}

async function readStoredImage(imagePath) {
  if (!imagePath) {
    const error = new Error('Imagen no encontrada.');
    error.status = 404;
    throw error;
  }

  if (imagePath.startsWith('/uploads/')) {
    const filePath = path.join(process.cwd(), imagePath.replace(/^\//, ''));
    return fs.promises.readFile(filePath);
  }

  if (env.storageDriver === 'supabase') {
    requireSupabaseConfig();
    const objectPath = getSupabaseObjectPath(imagePath);
    if (objectPath) {
      const objectUrl = `${env.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(env.supabaseBucket)}/${objectPath
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`;
      const response = await fetch(objectUrl, {
        headers: supabaseHeaders()
      });
      if (!response.ok) {
        const error = new Error('No se pudo leer la imagen desde Supabase Storage.');
        error.status = response.status === 404 ? 404 : 502;
        throw error;
      }
      return Buffer.from(await response.arrayBuffer());
    }
  }

  const response = await fetch(imagePath);
  if (!response.ok) {
    const error = new Error('No se pudo leer la imagen guardada.');
    error.status = response.status === 404 ? 404 : 502;
    throw error;
  }
  return Buffer.from(await response.arrayBuffer());
}

module.exports = {
  allowedImageMimes,
  deleteEquipmentImage,
  deleteStockImage: deleteEquipmentImage,
  readStoredImage,
  uploadEquipmentImage,
  uploadStockImage
};
