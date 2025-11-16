const crypto = require('crypto');
const bcrypt = require('bcrypt');

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const ALLOWED_MIMES = ['image/jpeg', 'image/png'];

function sanitizeText(input) {
  if (!input) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim();
}

function validatePasswordComplexity(password) {
  return PASSWORD_REGEX.test(password || '');
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

function randomFileName(extension = 'bin') {
  const token = crypto.randomBytes(16).toString('hex');
  return `${token}.${extension}`;
}

function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  sanitizeText,
  validatePasswordComplexity,
  validateEmail,
  randomFileName,
  hashPassword,
  comparePassword,
  ALLOWED_MIMES,
};
