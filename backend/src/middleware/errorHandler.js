function notFound(req, res) {
  res.status(404).json({ message: 'Recurso no encontrado.' });
}

function errorHandler(error, req, res, next) {
  const status = error.status || 500;
  const message = status === 500 ? 'Error interno del servidor.' : error.message;

  if (status === 500) {
    console.error(error);
  }

  res.status(status).json({ message });
}

module.exports = { notFound, errorHandler };
