const bcrypt = require('bcryptjs');
const db = require('../config/db');
const env = require('../config/env');

async function main() {
  const name = process.env.ADMIN_NAME || 'Administrador TI';
  const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const email = process.env.ADMIN_EMAIL || 'admin@sati-timsa.local';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('ADMIN_PASSWORD es requerido. Establezca una contrasena segura de al menos 8 caracteres.');
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 8 caracteres.');
  }
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);

  const { rows } = await db.query(
    `INSERT INTO users (role_id, name, username, email, password_hash)
     SELECT r.id, $1, $2, lower($3), $4
     FROM roles r
     WHERE r.name = 'ADMIN'
     ON CONFLICT (username)
     DO UPDATE SET
       role_id = EXCLUDED.role_id,
       name = EXCLUDED.name,
       email = EXCLUDED.email,
       password_hash = EXCLUDED.password_hash,
       failed_login_attempts = 0,
       password_reset_code_hash = NULL,
       password_reset_expires_at = NULL,
       is_active = TRUE
     RETURNING id, name, username, email`,
    [name, username, email, passwordHash]
  );

  console.log(`Admin listo: ${rows[0].username}`);
  await db.pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.pool.end();
  process.exit(1);
});
