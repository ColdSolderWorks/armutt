const { createLogger, format, transports } = require('winston');

function maskSensitive(value = '') {
  if (!value) return '';
  return String(value).replace(/([\w.-])(?=[^@]*@)/g, '*').replace(/[A-Za-z0-9]/g, '*');
}

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

function logError(message, meta = {}) {
  const sanitized = { ...meta };
  delete sanitized.password;
  delete sanitized.token;
  if (sanitized.email) sanitized.email = maskSensitive(sanitized.email);
  logger.error(message, sanitized);
}

function logInfo(message, meta = {}) {
  const sanitized = { ...meta };
  if (sanitized.email) sanitized.email = maskSensitive(sanitized.email);
  logger.info(message, sanitized);
}

module.exports = { logger, logError, logInfo };
