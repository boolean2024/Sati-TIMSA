const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const db = require('../config/db');
const env = require('../config/env');
const { authenticate } = require('../middleware/auth');
const { sendPasswordResetCode } = require('../services/mailService');
const { add: blacklistToken } = require('../services/tokenBlacklist');

const router = express.Router();

const loginSchema = z.object({
  username: z.string().trim().min(1).max(40),
  password: z.string().min(8).max(128),
  remember: z.boolean().optional().default(false)
});

const resetRequestSchema = z.object({
  username: z.string().trim().min(1).max(40),
  email: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().email().max(160).optional()
  )
});

const resetConfirmSchema = z.object({
  username: z.string().trim().min(1).max(40),
  code: z.string().trim().regex(/^\d{4}$/),
  password: z.string().min(8).max(128)
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(128),
  new_password: z.string().min(8).max(128)
});

function isRegisteredEmail(email) {
  return Boolean(email && !String(email).toLowerCase().endsWith('@sati-timsa.local'));
}

function resetUrl(username, code) {
  const url = new URL('/pages/index.html', env.appUrl);
  url.searchParams.set('reset_user', username);
  url.searchParams.set('reset_code', code);
  return url.toString();
}

function sessionCookieOptions(remember = false) {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/',
    ...(remember ? { maxAge: 7 * 24 * 60 * 60 * 1000 } : {})
  };
}

router.post('/login', async (req, res, next) => {
  try {
    const credentials = loginSchema.parse(req.body);
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.username, u.email, u.password_hash, u.is_active, u.failed_login_attempts, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE lower(u.username) = lower($1)`,
      [credentials.username]
    );

    const user = rows[0];

    if (user && Number(user.failed_login_attempts || 0) >= 3) {
      return res.status(401).json({
        message: 'Cuenta temporalmente bloqueada por multiples intentos fallidos. Use la opcion de recuperacion de contrasena.',
        failedAttempts: Number(user.failed_login_attempts),
        resetAvailable: true
      });
    }

    const validPassword = user ? await bcrypt.compare(credentials.password, user.password_hash) : false;

    if (!user || !validPassword || !user.is_active) {
      if (user) {
        const attempts = Math.min(Number(user.failed_login_attempts || 0) + 1, 99);
        await db.query('UPDATE users SET failed_login_attempts = $1 WHERE id = $2', [attempts, user.id]);
        return res.status(401).json({
          message: attempts >= 3
            ? 'Cuenta bloqueada por 3 intentos fallidos. Use recuperacion de contrasena.'
            : 'Credenciales invalidas.',
          failedAttempts: attempts,
          resetAvailable: attempts >= 3
        });
      }
      return res.status(401).json({ message: 'Credenciales invalidas.', failedAttempts: 0 });
    }

    await db.query(
      `UPDATE users
       SET failed_login_attempts = 0,
           password_reset_code_hash = NULL,
           password_reset_expires_at = NULL,
           last_login_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    const token = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
      expiresIn: credentials.remember ? '30d' : env.jwtExpiresIn
    });

    res.cookie('sati_session', token, sessionCookieOptions(credentials.remember));
    res.json({
      user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de acceso invalidos.' });
    }
    next(error);
  }
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos de recuperacion. Intente mas tarde.' }
});

router.post('/password-reset/request', passwordResetLimiter, async (req, res, next) => {
  try {
    const data = resetRequestSchema.parse(req.body);
    const { rows } = await db.query(
      'SELECT id, username, email FROM users WHERE lower(username) = lower($1) AND is_active = TRUE',
      [data.username]
    );

    const user = rows[0];
    if (!user) {
      return res.json({ message: 'Si el usuario existe, se enviara un codigo de verificacion.' });
    }
    const suppliedEmail = String(data.email || '').trim().toLowerCase();
    const registeredEmail = isRegisteredEmail(user.email) ? String(user.email).trim().toLowerCase() : '';
    const targetEmail = registeredEmail || suppliedEmail;

    if (!targetEmail) {
      return res.status(400).json({ message: 'Ingrese un correo para enviar el codigo de recuperacion.' });
    }

    const code = String(crypto.randomInt(1000, 10000));
    const codeHash = await bcrypt.hash(code, env.bcryptRounds);
    const result = await sendPasswordResetCode(targetEmail, code, resetUrl(user.username, code));
    if (!result.sent) {
      return res.status(503).json({
        message: result.reason || 'No se pudo enviar el correo. Revise la configuracion SMTP.'
      });
    }

    await db.query(
      `UPDATE users
       SET email = COALESCE($3, email),
           password_reset_code_hash = $1,
           password_reset_expires_at = NOW() + INTERVAL '10 minutes'
       WHERE id = $2`,
      [codeHash, user.id, registeredEmail ? null : targetEmail]
    );

    res.json({
      message: registeredEmail
        ? 'Codigo enviado al correo registrado.'
        : 'Codigo enviado y correo registrado para recuperacion.'
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Usuario invalido.' });
    }
    next(error);
  }
});

const passwordResetConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos de verificacion. Intente mas tarde.' }
});

router.post('/password-reset/confirm', passwordResetConfirmLimiter, async (req, res, next) => {
  try {
    const data = resetConfirmSchema.parse(req.body);
    const { rows } = await db.query(
      `SELECT id, password_reset_code_hash, password_reset_expires_at
       FROM users
       WHERE lower(username) = lower($1) AND is_active = TRUE`,
      [data.username]
    );

    const user = rows[0];
    const validCode = user?.password_reset_code_hash
      ? await bcrypt.compare(data.code, user.password_reset_code_hash)
      : false;
    const notExpired = user?.password_reset_expires_at && new Date(user.password_reset_expires_at) > new Date();

    if (!user || !validCode || !notExpired) {
      return res.status(400).json({ message: 'Codigo invalido o expirado.' });
    }

    const passwordHash = await bcrypt.hash(data.password, env.bcryptRounds);
    await db.query(
      `UPDATE users
       SET password_hash = $1,
           failed_login_attempts = 0,
           password_reset_code_hash = NULL,
           password_reset_expires_at = NULL
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    res.json({ message: 'Contrasena actualizada. Inicie sesion nuevamente.' });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de recuperacion invalidos.' });
    }
    next(error);
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', async (req, res) => {
  const header = req.headers.authorization || '';
  const cookieHeader = req.headers.cookie || '';
  const satiCookie = cookieHeader.split(';').map((c) => c.trim()).find((c) => c.startsWith('sati_session='));
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : satiCookie
      ? satiCookie.slice('sati_session='.length)
      : null;
  if (token) {
    await blacklistToken(token);
  }
  res.clearCookie('sati_session', sessionCookieOptions(false));
  res.status(204).send();
});

router.post('/password', authenticate, async (req, res, next) => {
  try {
    const data = changePasswordSchema.parse(req.body);
    if (data.current_password === data.new_password) {
      return res.status(400).json({ message: 'La nueva contrasena debe ser diferente.' });
    }

    const { rows } = await db.query(
      'SELECT id, password_hash FROM users WHERE id = $1 AND is_active = TRUE',
      [req.user.id]
    );
    const user = rows[0];
    const validPassword = user ? await bcrypt.compare(data.current_password, user.password_hash) : false;
    if (!validPassword) {
      return res.status(400).json({ message: 'Contrasena actual incorrecta.' });
    }

    const passwordHash = await bcrypt.hash(data.new_password, env.bcryptRounds);
    await db.query(
      `UPDATE users
       SET password_hash = $1,
           failed_login_attempts = 0,
           password_reset_code_hash = NULL,
           password_reset_expires_at = NULL
       WHERE id = $2`,
      [passwordHash, req.user.id]
    );

    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      blacklistToken(header.slice(7));
    }

    res.json({ message: 'Contrasena actualizada correctamente.' });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Datos de contrasena invalidos.' });
    }
    next(error);
  }
});

module.exports = router;
