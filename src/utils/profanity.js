const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');
const { normalizeText } = require('./regions');
const { DATA_DIR } = require('../config');

const PROFANITY_FILE = path.join(DATA_DIR, 'profanity.json');
let profanityCache = null;

async function loadProfanityList() {
  if (profanityCache) return profanityCache;
  if (!existsSync(PROFANITY_FILE)) return [];
  const raw = await fs.readFile(PROFANITY_FILE, 'utf-8');
  const data = JSON.parse(raw);
  profanityCache = Array.isArray(data) ? data.map((item) => normalizeText(item)) : [];
  return profanityCache;
}

async function hasProfanity(value) {
  const normalized = normalizeText(value);
  const entries = await loadProfanityList();
  return entries.some((entry) => normalized.includes(entry));
}

module.exports = { loadProfanityList, hasProfanity };
