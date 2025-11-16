const crypto = require('crypto');
const bcrypt = require('bcrypt');
const sanitizeHtml = require('sanitize-html');
const he = require('he');

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const ALLOWED_MIMES = ['image/jpeg', 'image/png'];

function sanitizeText(input) {
  if (!input) return '';
  const cleaned = sanitizeHtml(String(input), {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
    transformTags: {
      '*': (tagName, attribs) => {
        const safeAttribs = Object.keys(attribs || {}).reduce((acc, key) => {
          if (!key.toLowerCase().startsWith('on')) {
            acc[key] = attribs[key];
          }
          return acc;
        }, {});
        return { tagName, attribs: safeAttribs };
      },
    },
  });
  return he.escape(cleaned.trim());
}

function validatePasswordComplexity(password) {
  return PASSWORD_REGEX.test(password || '');
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

function timingSafeCompare(a, b) {
  const aBuf = Buffer.from(String(a || ''));
  const bBuf = Buffer.from(String(b || ''));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
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
  timingSafeCompare,
};
