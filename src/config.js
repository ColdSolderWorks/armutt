const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const UPLOAD_MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DATA_DIR = path.join(__dirname, '..', 'data');
const MEDIA_ROOT = path.join(PUBLIC_DIR, 'uploads');
const PROVIDER_MEDIA_ROOT = path.join(MEDIA_ROOT, 'providers');
const CUSTOMER_MEDIA_ROOT = path.join(MEDIA_ROOT, 'customers');

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

module.exports = {
  PORT,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  UPLOAD_MAX_BYTES,
  PUBLIC_DIR,
  DATA_DIR,
  MEDIA_ROOT,
  PROVIDER_MEDIA_ROOT,
  CUSTOMER_MEDIA_ROOT,
  ALLOWED_ORIGINS,
};
