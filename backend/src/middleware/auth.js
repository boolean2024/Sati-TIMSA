const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const { has: isBlacklisted } = require('../services/tokenBlacklist');

const ABSOLUTE_SESSION_MS = 12 * 60 * 60 * 1000;

function getRequestToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }

  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader
      .split(';')
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf('=');
        if (index === -1) return [cookie, ''];
        return [cookie.slice(0, index), decodeURIComponent(cookie.slice(index + 1))];
      })
  );
  return cookies.sati_session || null;
}

function verifyToken(token) {
  const payload = jwt.verify(token, env.jwtSecret);
  if (payload.iat && Date.now() - payload.iat * 1000 > ABSOLUTE_SESSION_MS) {
    return null;
  }
  return payload;
}

async function loadAuthenticatedUser(token) {
  const payload = verifyToken(token);
  if (!payload) return null;

  const { rows } = await db.query(
    `SELECT u.id, u.name, u.username, u.email, u.is_active, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [payload.sub]
  );

  const user = rows[0];
  if (!user || !user.is_active) {
    return null;
  }

  return user;
}

async function authenticate(req, res, next) {
  try {
    const token = getRequestToken(req);

    if (!token) {
      return res.status(401).json({ message: 'Token requerido.' });
    }

    if (isBlacklisted(token)) {
      return res.status(401).json({ message: 'Sesion invalida o expirada.' });
    }

    const user = await loadAuthenticatedUser(token);
    if (!user) {
      return res.status(401).json({ message: 'Usuario no autorizado.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Sesion invalida o expirada.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Permisos insuficientes.' });
    }
    next();
  };
}

function requireWriteAccess(req, res, next) {
  return requireRole('ADMIN', 'TI')(req, res, next);
}

module.exports = { authenticate, requireRole, requireWriteAccess };
