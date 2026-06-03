require('dotenv').config();

const required = ['DATABASE_URL', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const inferredCloudUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.WEBSITE_HOSTNAME
    ? `https://${process.env.WEBSITE_HOSTNAME}`
    : '';
const appUrls = (process.env.APP_URL || inferredCloudUrl || 'http://localhost:3000')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
const appUrl = appUrls[0];
const jwtSecret = process.env.JWT_SECRET;
const storageDriver = process.env.STORAGE_DRIVER || 'local';
const defaultPoolMax = process.env.VERCEL ? 1 : 12;

if (isProduction) {
  const errors = [];

  if (jwtSecret === 'change_this_to_a_very_long_random_secret' || jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be a strong random value with at least 32 characters in production.');
  }

  if (jwtSecret === process.env.DATABASE_URL) {
    errors.push('JWT_SECRET must not be the same as DATABASE_URL.');
  }

  if (appUrls.some((url) => url.includes('localhost'))) {
    errors.push('APP_URL must be the public production URL, not localhost.');
  }

  const pgSslEnv = (process.env.PGSSLMODE || '').toLowerCase();
  const isCloudDb = /supabase|render|vercel/i.test(process.env.DATABASE_URL || '');
  if ((!pgSslEnv && !isCloudDb) || ['disable', 'false', 'off'].includes(pgSslEnv)) {
    errors.push('PGSSLMODE must be set to "require" or "verify-full" in production.');
  }

  if (errors.length > 0) {
    throw new Error(`Production configuration errors:\n  - ${errors.join('\n  - ')}`);
  }
}

module.exports = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT || 3000),
  appUrl,
  appUrls,
  databaseUrl: process.env.DATABASE_URL,
  pgSslMode: process.env.PGSSLMODE || (isProduction ? 'require' : 'disable'),
  pgPoolMax: Number(process.env.PG_POOL_MAX || defaultPoolMax),
  pgIdleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
  pgConnectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 8000),
  pgStatementTimeoutMillis: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 15000),
  pgQueryTimeoutMillis: Number(process.env.PG_QUERY_TIMEOUT_MS || 20000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  bcryptRounds: Math.max(10, Number(process.env.BCRYPT_ROUNDS || 12)),
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpSecure: process.env.SMTP_SECURE !== 'false',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),
  smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  storageDriver
};
