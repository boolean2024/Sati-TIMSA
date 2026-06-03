const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function main() {
  const relativePath = process.argv[2];
  if (!relativePath) {
    throw new Error('Uso: node backend/src/scripts/runSql.js db/schema.sql');
  }

  const sqlPath = path.resolve(process.cwd(), relativePath);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await db.query(sql);
  console.log(`SQL aplicado: ${relativePath}`);
  await db.pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.pool.end();
  process.exit(1);
});
