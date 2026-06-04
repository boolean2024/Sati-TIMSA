const crypto = require('crypto');
const db = require('../config/db');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function add(token) {
  try {
    const tokenHash = hashToken(token);
    await db.query(
      'INSERT INTO token_blacklist (token_hash) VALUES ($1) ON CONFLICT (token_hash) DO NOTHING',
      [tokenHash]
    );
  } catch (error) {
    console.error('Token blacklist add error:', error.message);
  }
}

async function has(token) {
  try {
    const tokenHash = hashToken(token);
    const { rows } = await db.query(
      'SELECT 1 FROM token_blacklist WHERE token_hash = $1 AND blacklisted_at > NOW() - INTERVAL \'24 hours\'',
      [tokenHash]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('Token blacklist check error:', error.message);
    return false;
  }
}

async function clear() {
  try {
    await db.query('DELETE FROM token_blacklist');
  } catch (error) {
    console.error('Token blacklist clear error:', error.message);
  }
}

module.exports = { add, has, clear };
