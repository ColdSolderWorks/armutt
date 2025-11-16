function errorHandler(err, req, res, _next) {
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const message = status >= 500 ? 'Beklenmeyen bir hata oluştu.' : err.message || 'İşlem başarısız oldu.';
  if (process.env.NODE_ENV !== 'test') {
    const safeLog = `[${new Date().toISOString()}][req:${req?.requestId || 'n/a'}] status=${status}`;
    // eslint-disable-next-line no-console
    console.error(safeLog);
  }
  res.status(status).json({ message });
}

module.exports = { errorHandler };
