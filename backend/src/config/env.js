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

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return '';

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }

    if (parsed.protocol.startsWith('postgres')) {
      const username = decodeURIComponent(parsed.username || '');
      const userProject = username.match(/^postgres\.([a-z0-9]+)$/i);
      if (userProject) {
        return `https://${userProject[1]}.supabase.co`;
      }

      const hostProject = parsed.hostname.match(/^(?:db|postgres)\.([a-z0-9]+)\.supabase\.co$/i);
      if (hostProject) {
        return `https://${hostProject[1]}.supabase.co`;
      }
    }
  } catch (error) {
    return rawUrl;
  }

  return rawUrl;
}

const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL || '');

if (!['local', 'supabase'].includes(storageDriver)) {
  throw new Error('STORAGE_DRIVER must be local or supabase.');
}

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

  if (!process.env.PGSSLMODE || ['disable', 'false', 'off'].includes(process.env.PGSSLMODE.toLowerCase())) {
    errors.push('PGSSLMODE must be set to "require" or "verify-full" in production.');
  }

  if (storageDriver === 'supabase') {
    for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_BUCKET']) {
      if (!process.env[key]) {
        errors.push(`Missing required Supabase Storage variable in production: ${key}`);
      }
    }

    if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(supabaseUrl)) {
      errors.push('SUPABASE_URL must be the project API URL, for example https://project-ref.supabase.co.');
    }
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
  pgSslMode: process.env.PGSSLMODE || 'disable',
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
  storageDriver,
  supabaseUrl,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseBucket: process.env.SUPABASE_BUCKET || 'equipment-images'
};
