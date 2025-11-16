function errorHandler(err, req, res, _next) {
  // eslint-disable-next-line no-console
  console.error(err);
  const status = err.status || 500;
  const message = err.message || 'Beklenmeyen bir hata oluştu.';
  res.status(status).json({ message });
}

module.exports = { errorHandler };
