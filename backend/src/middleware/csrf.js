const crypto = require('crypto');

const CSRF_COOKIE = 'sati_xsrf';
const CSRF_HEADER = 'x-xsrf-token';
const CSRF_LENGTH = 32;
const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf('=');
        if (index === -1) return [cookie, ''];
        return [cookie.slice(0, index), cookie.slice(index + 1)];
      })
  );
}

function ensureCsrfCookie(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  if (!cookies[CSRF_COOKIE]) {
    const token = crypto.randomBytes(CSRF_LENGTH).toString('hex');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: req.protocol === 'https',
      sameSite: 'strict',
      path: '/'
    });
    return token;
  }
  return cookies[CSRF_COOKIE];
}

function csrfProtection(req, res, next) {
  if (!mutatingMethods.has(req.method)) {
    ensureCsrfCookie(req, res);
    return next();
  }

  const isMultipart = (req.headers['content-type'] || '').startsWith('multipart/form-data');
  if (isMultipart) {
    return next();
  }

  const cookies = parseCookies(req.headers.cookie);
  const csrfCookie = cookies[CSRF_COOKIE];
  const csrfHeader = req.headers[CSRF_HEADER];

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ message: 'CSRF validation failed.' });
  }

  next();
}

function csrfTokenEndpoint(req, res) {
  const token = ensureCsrfCookie(req, res);
  res.json({ token });
}

module.exports = { csrfProtection, csrfTokenEndpoint };
