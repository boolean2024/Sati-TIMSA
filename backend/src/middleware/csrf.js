const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function csrfProtection(req, res, next) {
  if (!mutatingMethods.has(req.method)) {
    return next();
  }

  const isMultipart = (req.headers['content-type'] || '').startsWith('multipart/form-data');
  if (isMultipart) {
    return next();
  }

  if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    return res.status(403).json({ message: 'CSRF validation failed.' });
  }

  next();
}

module.exports = { csrfProtection };
