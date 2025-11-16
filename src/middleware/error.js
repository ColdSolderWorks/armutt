const { logError } = require('../logger');

function errorHandler(err, req, res, _next) {
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const message = status >= 500 ? 'Beklenmeyen bir hata oluştu.' : err.message || 'İşlem başarısız oldu.';
  logError(message, { requestId: req?.requestId, status });
  res.status(status).json({ message });
}

module.exports = { errorHandler };
