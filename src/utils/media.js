const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');
const { randomFileName, ALLOWED_MIMES } = require('./security');
const { UPLOAD_MAX_BYTES, MEDIA_ROOT } = require('../config');

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) {
    const error = new Error('Geçersiz veri URLsi.');
    error.status = 400;
    throw error;
  }
  const mime = match[1];
  const base64 = match[2];
  if (!ALLOWED_MIMES.includes(mime)) {
    const error = new Error('Sadece JPEG ve PNG dosyalarına izin veriliyor.');
    error.status = 400;
    throw error;
  }
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.byteLength > UPLOAD_MAX_BYTES) {
    const error = new Error('Dosya boyutu sınırını aşıyor.');
    error.status = 400;
    throw error;
  }
  const extension = mime === 'image/png' ? 'png' : 'jpg';
  return { buffer, extension, mime };
}

function sanitizeRelativePath(value) {
  const cleaned = String(value || '').replace(/^\/+/, '');
  const normalized = path.normalize(cleaned);
  if (normalized.includes('..')) {
    return null;
  }
  return normalized;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true, mode: 0o750 });
}

async function saveMedia(dataUrl, baseDir) {
  if (!dataUrl) return '';
  if (!isDataUrl(dataUrl)) return dataUrl;
  const { buffer, extension } = parseDataUrl(dataUrl);
  await ensureDir(baseDir);
  const fileName = randomFileName(extension);
  const destination = path.join(baseDir, fileName);
  await fs.writeFile(destination, buffer);
  return toPublicPath(destination);
}

function toPublicPath(filePath) {
  const relative = path.relative(MEDIA_ROOT, filePath);
  const normalized = sanitizeRelativePath(relative);
  if (!normalized) return '';
  return `/media/${normalized.split(path.sep).join('/')}`;
}

function fromPublicPath(publicPath) {
  if (!publicPath) return null;
  const cleaned = sanitizeRelativePath(publicPath);
  if (!cleaned) return null;
  const absolute = path.join(MEDIA_ROOT, cleaned.replace(/^media\//, ''));
  const resolved = path.resolve(absolute);
  if (!resolved.startsWith(path.resolve(MEDIA_ROOT))) {
    return null;
  }
  return resolved;
}

async function removeFile(publicPath) {
  if (!publicPath) return;
  const absolute = fromPublicPath(publicPath);
  if (!absolute) return;
  try {
    await fs.unlink(absolute);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function ensureMediaRoots(paths) {
  const ensurePaths = paths.filter((dirPath) => dirPath && !existsSync(dirPath));
  await Promise.all(ensurePaths.map((dirPath) => ensureDir(dirPath)));
}

module.exports = {
  isDataUrl,
  parseDataUrl,
  ensureDir,
  saveMedia,
  removeFile,
  ensureMediaRoots,
  toPublicPath,
  fromPublicPath,
};
