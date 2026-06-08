const { Pool } = require('pg');
const env = require('./env');

function shouldUseSsl() {
  const mode = String(env.pgSslMode || '').toLowerCase();
  if (['disable', 'false', 'off'].includes(mode)) return false;
  if (['require', 'true', 'on'].includes(mode)) return { rejectUnauthorized: false };
  if (mode === 'verify-full') return { rejectUnauthorized: true };
  if (env.isProduction) return { rejectUnauthorized: false };
  if (/supabase\.co|render\.com|vercel/i.test(env.databaseUrl)) return { rejectUnauthorized: false };
  return false;
}

const ssl = shouldUseSsl();

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl,
  max: env.pgPoolMax,
  idleTimeoutMillis: env.pgIdleTimeoutMillis,
  connectionTimeoutMillis: env.pgConnectionTimeoutMillis,
  statement_timeout: env.pgStatementTimeoutMillis,
  query_timeout: env.pgQueryTimeoutMillis,
  keepAlive: true,
  application_name: 'sati-timsa-api'
});

pool.on('error', (error) => {
  console.error('PostgreSQL pool error:', error.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError) => {
      console.error('PostgreSQL rollback error:', rollbackError.message);
    });
    throw error;
  } finally {
    client.release();
  }
}

async function close() {
  await pool.end();
}

async function runMigrations() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        token_hash TEXT PRIMARY KEY,
        blacklisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_token_blacklist_blacklisted_at
      ON token_blacklist(blacklisted_at)
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        due_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notes_user_id
      ON notes(user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notes_due_at
      ON notes(due_at)
    `);
    const alterCmds = [
      'ALTER TABLE equipment ALTER COLUMN equipment_type_id DROP NOT NULL',
      'ALTER TABLE equipment ALTER COLUMN brand_id DROP NOT NULL',
      'ALTER TABLE equipment ALTER COLUMN model_id DROP NOT NULL',
      'ALTER TABLE equipment ALTER COLUMN location_id DROP NOT NULL',
      'ALTER TABLE equipment ALTER COLUMN area_id DROP NOT NULL',
      'ALTER TABLE stock_items ALTER COLUMN location_id DROP NOT NULL',
      'ALTER TABLE stock_items ALTER COLUMN area_id DROP NOT NULL'
    ];
    for (const cmd of alterCmds) {
      try { await pool.query(cmd); } catch (_) { /* table or column may not exist */ }
    }
    console.log('DB migrations applied successfully');
  } catch (error) {
    console.error('DB migration error:', error.message);
  }
}

module.exports = { pool, query, withTransaction, close, runMigrations };
