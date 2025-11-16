const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');
const { v4: uuid } = require('uuid');
const bcrypt = require('bcrypt');
const {
  sanitizeText,
  validatePasswordComplexity,
  validateEmail,
  randomFileName,
  hashPassword,
  comparePassword,
  ALLOWED_MIMES,
} = require('./src/utils/security');
const { openDatabase, run, get, all } = require('./src/db');
const { createToken, authMiddleware } = require('./src/middleware/auth');
const { errorHandler } = require('./src/middleware/error');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MEDIA_ROOT = path.join(PUBLIC_DIR, 'uploads');
const PROVIDER_MEDIA_ROOT = path.join(MEDIA_ROOT, 'providers');
const CUSTOMER_MEDIA_ROOT = path.join(MEDIA_ROOT, 'customers');
const PROFANITY_FILE = path.join(DATA_DIR, 'profanity.json');

const ADMIN_EMAIL_HASH = process.env.ADMIN_EMAIL_HASH ? String(process.env.ADMIN_EMAIL_HASH) : null;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ? String(process.env.ADMIN_PASSWORD_HASH) : null;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase() : null;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD) : null;

const REGIONS = [
  {
    city: 'Trabzon',
    districts: [
      'Ortahisar',
      'Akçaabat',
      'Araklı',
      'Arsin',
      'Beşikdüzü',
      'Çarşıbaşı',
      'Çaykara',
      'Dernekpazarı',
      'Düzköy',
      'Hayrat',
      'Köprübaşı',
      'Maçka',
      'Of',
      'Sürmene',
      'Şalpazarı',
      'Tonya',
      'Vakfıkebir',
      'Yomra',
    ],
  },
  { city: 'Gümüşhane', districts: ['Merkez', 'Kelkit', 'Köse', 'Kürtün', 'Şiran', 'Torul'] },
  {
    city: 'Rize',
    districts: ['Merkez', 'Ardeşen', 'Çamlıhemşin', 'Çayeli', 'Derepazarı', 'Fındıklı', 'Güneysu', 'Hemşin', 'İkizdere', 'İyidere', 'Kalkandere', 'Pazar'],
  },
];

const REGION_LOOKUP = REGIONS.reduce((acc, region) => {
  const key = normalizeRegionKey(region.city);
  acc[key] = region;
  return acc;
}, {});

app.use(express.json({ limit: '10mb' }));
app.use(express.static(PUBLIC_DIR));

const db = openDatabase();
let profanityCache = null;

function normalizeText(value) {
  return (value || '')
    .toString()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ğüşöçıİ\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRegionKey(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

function resolveRegion(city) {
  const region = REGION_LOOKUP[normalizeRegionKey(city)];
  return region || REGIONS[0];
}

function normalizeLocation(city, district) {
  const region = resolveRegion(city);
  const normalizedDistrict = normalizeRegionKey(district);
  const matchedDistrict = region.districts.find((entry) => normalizeRegionKey(entry) === normalizedDistrict);
  return {
    city: region.city,
    district: matchedDistrict || region.districts[0],
  };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureMediaRoots() {
  await Promise.all([ensureDir(DATA_DIR), ensureDir(MEDIA_ROOT), ensureDir(PROVIDER_MEDIA_ROOT), ensureDir(CUSTOMER_MEDIA_ROOT)]);
}

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) {
    throw new Error('Geçersiz veri URLsi.');
  }
  const mime = match[1];
  const base64 = match[2];
  if (!ALLOWED_MIMES.includes(mime)) {
    const error = new Error('Sadece JPEG ve PNG dosyalarına izin veriliyor.');
    error.status = 400;
    throw error;
  }
  const buffer = Buffer.from(base64, 'base64');
  const extension = mime === 'image/png' ? 'png' : 'jpg';
  return { buffer, extension, mime };
}

function toPublicPath(filePath) {
  const relative = path.relative(PUBLIC_DIR, filePath);
  return `/${relative.split(path.sep).join('/')}`;
}

function fromPublicPath(publicPath) {
  if (!publicPath) return null;
  const cleaned = publicPath.replace(/^\/+/, '');
  return path.join(PUBLIC_DIR, cleaned);
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

function buildUserResponse(user, token) {
  if (!user) return null;
  const gallery = user.gallery ? JSON.parse(user.gallery) : [];
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    profession: user.profession,
    category: user.category,
    about: user.about,
    city: user.city,
    district: user.district,
    contact: {
      phone: user.phone,
      email: user.contact_email || user.email,
      website: user.website,
    },
    avatar: user.avatar,
    banner: user.banner,
    gallery,
    rating: user.rating,
    reviewCount: user.review_count,
    completedJobs: user.completed_jobs,
    verified: Boolean(user.verified),
    token,
  };
}

function requireOwnership(req, res, next) {
  if (req.user.role === 'admin') return next();
  const targetId = req.params.id || req.body.userId;
  if (targetId && req.user.id !== targetId) {
    return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
  }
  return next();
}

app.get('/api/locations', (_req, res) => {
  res.json(REGIONS);
});

app.get('/api/categories', (_req, res) => {
  res.json(['Boya', 'Nakliyat', 'Temizlik', 'Tadilat', 'Elektrik', 'Marangoz', 'Beyaz Eşya', 'Özel Ders']);
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      profession,
      category,
      city,
      district,
    } = req.body || {};

    if (!email || !validateEmail(email)) {
      return res.status(400).json({ message: 'Geçerli bir e-posta girin.' });
    }
    if (!validatePasswordComplexity(password)) {
      return res.status(400).json({ message: 'Şifre en az 8 karakter, büyük/küçük harf, rakam ve özel karakter içermelidir.' });
    }
    if (!['usta', 'musteri'].includes(role)) {
      return res.status(400).json({ message: 'Geçersiz rol.' });
    }

    const existing = await get(db, 'SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return res.status(409).json({ message: 'Bu e-posta ile bir hesap zaten var.' });
    }

    const verificationCode = uuid();
    const hashed = await hashPassword(password);
    const location = normalizeLocation(city, district);

    const userId = uuid();
    await run(
      db,
      `INSERT INTO users (id, role, email, password_hash, first_name, last_name, profession, category, about, city, district, verification_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        userId,
        role,
        email.toLowerCase(),
        hashed,
        sanitizeText(firstName),
        sanitizeText(lastName),
        sanitizeText(profession),
        sanitizeText(category),
        '',
        location.city,
        location.district,
        verificationCode,
      ],
    );

    res.json({ message: 'Kayıt oluşturuldu. E-posta doğrulaması gerekiyor.', verificationCode, userId });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/verify', async (req, res, next) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ message: 'Doğrulama bilgileri eksik.' });
    }
    const user = await get(db, 'SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user || user.verification_code !== code) {
      return res.status(400).json({ message: 'Doğrulama kodu hatalı.' });
    }
    await run(db, 'UPDATE users SET verified = 1, verification_code = NULL WHERE id = ?', [user.id]);
    const token = createToken({ sub: user.id, role: user.role, email: user.email });
    const payload = buildUserResponse({ ...user, verified: 1 }, token);
    res.json({ message: 'E-posta doğrulandı.', user: payload });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'E-posta ve şifre gereklidir.' });
    }

    if (ADMIN_EMAIL && ADMIN_PASSWORD && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      const ok = ADMIN_PASSWORD_HASH
        ? await bcrypt.compare(password, ADMIN_PASSWORD_HASH)
        : password === ADMIN_PASSWORD;
      if (!ok) {
        return res.status(401).json({ message: 'Geçersiz bilgiler.' });
      }
      const token = createToken({ sub: 'admin', role: 'admin', email: ADMIN_EMAIL });
      return res.json({
        message: 'Giriş başarılı.',
        user: { id: 'admin', role: 'admin', email: ADMIN_EMAIL, token },
      });
    }

    const user = await get(db, 'SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) {
      return res.status(401).json({ message: 'Geçersiz bilgiler.' });
    }
    if (!user.verified) {
      return res.status(403).json({ message: 'E-posta doğrulaması yapılmadı.' });
    }
    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: 'Geçersiz bilgiler.' });
    }
    const token = createToken({ sub: user.id, role: user.role, email: user.email });
    const payload = buildUserResponse(user, token);
    res.json({ message: 'Giriş başarılı.', user: payload });
  } catch (error) {
    next(error);
  }
});

app.get('/api/providers', async (req, res, next) => {
  try {
    const query = normalizeText(req.query.q || '');
    const rows = await all(db, 'SELECT * FROM users WHERE role = "usta"');
    const providers = rows
      .map((row) => buildUserResponse(row))
      .filter((provider) => {
        if (!query) return true;
        const haystack = normalizeText(`${provider.firstName} ${provider.lastName} ${provider.profession} ${provider.category} ${provider.city} ${provider.district}`);
        return haystack.includes(query);
      });
    res.json(providers);
  } catch (error) {
    next(error);
  }
});

app.get('/api/providers/:id', async (req, res, next) => {
  try {
    const provider = await get(db, 'SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!provider || provider.role !== 'usta') {
      return res.status(404).json({ message: 'Usta bulunamadı.' });
    }
    res.json(buildUserResponse(provider));
  } catch (error) {
    next(error);
  }
});

app.put('/api/providers/:id', authMiddleware(db), requireOwnership, async (req, res, next) => {
  try {
    const provider = await get(db, 'SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!provider || provider.role !== 'usta') {
      return res.status(404).json({ message: 'Usta bulunamadı.' });
    }

    const updates = { ...provider };
    if (req.body.firstName !== undefined) updates.first_name = sanitizeText(req.body.firstName);
    if (req.body.lastName !== undefined) updates.last_name = sanitizeText(req.body.lastName);
    if (req.body.profession !== undefined) updates.profession = sanitizeText(req.body.profession);
    if (req.body.category !== undefined) updates.category = sanitizeText(req.body.category);
    if (req.body.about !== undefined) updates.about = sanitizeText(req.body.about);

    if (req.body.city || req.body.district) {
      const location = normalizeLocation(req.body.city || provider.city, req.body.district || provider.district);
      updates.city = location.city;
      updates.district = location.district;
    }

    if (req.body.contact) {
      updates.phone = sanitizeText(req.body.contact.phone);
      updates.contact_email = sanitizeText(req.body.contact.email || provider.email);
      updates.website = sanitizeText(req.body.contact.website);
    }

    const providerDir = path.join(PROVIDER_MEDIA_ROOT, provider.id);
    if (req.body.avatar !== undefined) {
      if (!req.body.avatar) {
        await removeFile(provider.avatar);
        updates.avatar = '';
      } else {
        const avatar = await saveMedia(req.body.avatar, path.join(providerDir, 'avatar'));
        await removeFile(provider.avatar);
        updates.avatar = avatar;
      }
    }

    if (req.body.banner !== undefined) {
      if (!req.body.banner) {
        await removeFile(provider.banner);
        updates.banner = '';
      } else {
        const banner = await saveMedia(req.body.banner, path.join(providerDir, 'banner'));
        await removeFile(provider.banner);
        updates.banner = banner;
      }
    }

    if (req.body.gallery) {
      const items = Array.isArray(req.body.gallery) ? req.body.gallery : [];
      const nextGallery = [];
      for (const item of items) {
        // eslint-disable-next-line no-await-in-loop
        const stored = await saveMedia(item, path.join(providerDir, 'gallery'));
        nextGallery.push(stored);
      }
      const oldGallery = provider.gallery ? JSON.parse(provider.gallery) : [];
      for (const file of oldGallery) {
        if (!nextGallery.includes(file)) {
          // eslint-disable-next-line no-await-in-loop
          await removeFile(file);
        }
      }
      updates.gallery = JSON.stringify(nextGallery);
    }

    await run(
      db,
      `UPDATE users SET first_name=?, last_name=?, profession=?, category=?, about=?, city=?, district=?, phone=?, contact_email=?, website=?, avatar=?, banner=?, gallery=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [
        updates.first_name,
        updates.last_name,
        updates.profession,
        updates.category,
        updates.about,
        updates.city,
        updates.district,
        updates.phone,
        updates.contact_email,
        updates.website,
        updates.avatar,
        updates.banner,
        updates.gallery,
        provider.id,
      ],
    );

    const refreshed = await get(db, 'SELECT * FROM users WHERE id = ?', [provider.id]);
    res.json(buildUserResponse(refreshed));
  } catch (error) {
    next(error);
  }
});

app.get('/api/customers/:id', authMiddleware(db), requireOwnership, async (req, res, next) => {
  try {
    const user = await get(db, 'SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user || user.role !== 'musteri') {
      return res.status(404).json({ message: 'Müşteri bulunamadı.' });
    }
    res.json(buildUserResponse(user));
  } catch (error) {
    next(error);
  }
});

app.put('/api/customers/:id', authMiddleware(db), requireOwnership, async (req, res, next) => {
  try {
    const user = await get(db, 'SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user || user.role !== 'musteri') {
      return res.status(404).json({ message: 'Müşteri bulunamadı.' });
    }

    const updates = { ...user };
    if (req.body.profile) {
      updates.first_name = sanitizeText(req.body.profile.firstName);
      updates.last_name = sanitizeText(req.body.profile.lastName);
      updates.about = sanitizeText(req.body.profile.about);
    }
    if (req.body.city || req.body.district) {
      const location = normalizeLocation(req.body.city || user.city, req.body.district || user.district);
      updates.city = location.city;
      updates.district = location.district;
    }
    if (req.body.email && validateEmail(req.body.email)) {
      updates.email = sanitizeText(req.body.email.toLowerCase());
    }
    if (req.body.phone) {
      updates.phone = sanitizeText(req.body.phone);
    }

    const customerDir = path.join(CUSTOMER_MEDIA_ROOT, user.id, 'avatar');
    if (req.body.avatar !== undefined) {
      if (!req.body.avatar) {
        await removeFile(user.avatar);
        updates.avatar = '';
      } else {
        const avatar = await saveMedia(req.body.avatar, customerDir);
        await removeFile(user.avatar);
        updates.avatar = avatar;
      }
    }

    await run(
      db,
      'UPDATE users SET first_name=?, last_name=?, about=?, city=?, district=?, email=?, phone=?, avatar=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [updates.first_name, updates.last_name, updates.about, updates.city, updates.district, updates.email, updates.phone, updates.avatar, user.id],
    );

    const refreshed = await get(db, 'SELECT * FROM users WHERE id = ?', [user.id]);
    res.json(buildUserResponse(refreshed));
  } catch (error) {
    next(error);
  }
});

app.get('/api/requests', authMiddleware(db), async (_req, res, next) => {
  try {
    const requests = await all(db, 'SELECT * FROM requests WHERE status != "Kapalı"');
    const enriched = await Promise.all(
      requests.map(async (reqItem) => ({
        ...serializeRequest(reqItem),
        offers: await loadOffers(reqItem.id),
      })),
    );
    res.json(enriched);
  } catch (error) {
    next(error);
  }
});

app.get('/api/requests/customer/:id', authMiddleware(db), requireOwnership, async (req, res, next) => {
  try {
    const requests = await all(db, 'SELECT * FROM requests WHERE customer_id = ?', [req.params.id]);
    const enriched = await Promise.all(
      requests.map(async (reqItem) => ({
        ...serializeRequest(reqItem),
        offers: await loadOffers(reqItem.id),
      })),
    );
    res.json(enriched);
  } catch (error) {
    next(error);
  }
});

app.get('/api/requests/provider/:id', authMiddleware(db), requireOwnership, async (req, res, next) => {
  try {
    const offers = await all(db, 'SELECT DISTINCT request_id FROM offers WHERE provider_id = ?', [req.params.id]);
    const requestIds = offers.map((entry) => entry.request_id);
    if (!requestIds.length) return res.json([]);
    const placeholders = requestIds.map(() => '?').join(',');
    const requests = await all(db, `SELECT * FROM requests WHERE id IN (${placeholders})`, requestIds);
    const enriched = await Promise.all(
      requests.map(async (reqItem) => ({
        ...serializeRequest(reqItem),
        offers: await loadOffers(reqItem.id),
      })),
    );
    res.json(enriched);
  } catch (error) {
    next(error);
  }
});

app.post('/api/requests', authMiddleware(db), requireOwnership, async (req, res, next) => {
  try {
    if (req.user.role !== 'musteri') {
      return res.status(403).json({ message: 'Sadece müşteriler talep oluşturabilir.' });
    }
    const { category, description, city, district } = req.body || {};
    if (!category || !description) {
      return res.status(400).json({ message: 'Kategori ve açıklama zorunludur.' });
    }
    if (await hasProfanity(description)) {
      return res.status(400).json({ message: 'İçerik uygunsuz kelimeler içeriyor.' });
    }
    const location = normalizeLocation(city || req.user.city, district || req.user.district);
    const id = uuid();
    await run(db, 'INSERT INTO requests (id, customer_id, title, category, description, city, district) VALUES (?,?,?,?,?,?,?)', [
      id,
      req.user.id,
      sanitizeText(category),
      sanitizeText(category),
      sanitizeText(description),
      location.city,
      location.district,
    ]);
    const created = await get(db, 'SELECT * FROM requests WHERE id = ?', [id]);
    res.status(201).json(serializeRequest(created));
  } catch (error) {
    next(error);
  }
});

app.post('/api/requests/:id/offers', authMiddleware(db), async (req, res, next) => {
  try {
    if (req.user.role !== 'usta') {
      return res.status(403).json({ message: 'Sadece ustalar teklif verebilir.' });
    }
    const request = await get(db, 'SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!request) {
      return res.status(404).json({ message: 'Talep bulunamadı.' });
    }
    const { message, price } = req.body || {};
    if (!message || Number.isNaN(Number(price))) {
      return res.status(400).json({ message: 'Mesaj ve fiyat zorunludur.' });
    }
    if (await hasProfanity(message)) {
      return res.status(400).json({ message: 'Teklif metni uygunsuz içerik barındırıyor.' });
    }
    const id = uuid();
    await run(db, 'INSERT INTO offers (id, request_id, provider_id, message, price) VALUES (?,?,?,?,?)', [
      id,
      request.id,
      req.user.id,
      sanitizeText(message),
      Number(price),
    ]);
    res.status(201).json({ message: 'Teklif kaydedildi.' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/requests/:id/offers/:offerId/accept', authMiddleware(db), async (req, res, next) => {
  try {
    const request = await get(db, 'SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!request) return res.status(404).json({ message: 'Talep bulunamadı.' });
    if (request.customer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
    }
    const offer = await get(db, 'SELECT * FROM offers WHERE id = ?', [req.params.offerId]);
    if (!offer || offer.request_id !== request.id) {
      return res.status(404).json({ message: 'Teklif bulunamadı.' });
    }
    await run(db, 'UPDATE offers SET status = "accepted" WHERE id = ?', [offer.id]);
    await run(db, 'UPDATE requests SET status = "Teklif Kabul Edildi", accepted_offer_id = ? WHERE id = ?', [offer.id, request.id]);
    res.json({ message: 'Teklif kabul edildi.' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/summary', authMiddleware(db, { role: 'admin' }), async (_req, res, next) => {
  try {
    const [userCountRow] = await all(db, 'SELECT COUNT(*) as count FROM users');
    const [providerCountRow] = await all(db, "SELECT COUNT(*) as count FROM users WHERE role='usta'");
    const [customerCountRow] = await all(db, "SELECT COUNT(*) as count FROM users WHERE role='musteri'");
    const [requestCountRow] = await all(db, 'SELECT COUNT(*) as count FROM requests');
    res.json({
      users: userCountRow.count,
      providers: providerCountRow.count,
      customers: customerCountRow.count,
      requests: requestCountRow.count,
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/providers/:id', authMiddleware(db, { role: 'admin' }), async (req, res, next) => {
  try {
    await run(db, 'DELETE FROM users WHERE id = ? AND role = "usta"', [req.params.id]);
    res.json({ message: 'Usta silindi.' });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/customers/:id', authMiddleware(db, { role: 'admin' }), async (req, res, next) => {
  try {
    await run(db, 'DELETE FROM users WHERE id = ? AND role = "musteri"', [req.params.id]);
    res.json({ message: 'Müşteri silindi.' });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/requests/:id', authMiddleware(db, { role: 'admin' }), async (req, res, next) => {
  try {
    await run(db, 'DELETE FROM requests WHERE id = ?', [req.params.id]);
    res.json({ message: 'Talep silindi.' });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/requests/:requestId/offers/:offerId', authMiddleware(db, { role: 'admin' }), async (req, res, next) => {
  try {
    await run(db, 'DELETE FROM offers WHERE id = ? AND request_id = ?', [req.params.offerId, req.params.requestId]);
    res.json({ message: 'Teklif silindi.' });
  } catch (error) {
    next(error);
  }
});

function serializeRequest(request) {
  return {
    id: request.id,
    customerId: request.customer_id,
    category: request.category,
    description: request.description,
    city: request.city,
    district: request.district,
    status: request.status,
    createdAt: request.created_at,
    acceptedOfferId: request.accepted_offer_id,
  };
}

async function loadOffers(requestId) {
  const offers = await all(db, 'SELECT * FROM offers WHERE request_id = ?', [requestId]);
  const providerIds = offers.map((offer) => offer.provider_id);
  const providers = providerIds.length
    ? await all(db, `SELECT * FROM users WHERE id IN (${providerIds.map(() => '?').join(',')})`, providerIds)
    : [];
  const providerMap = providers.reduce((acc, provider) => ({ ...acc, [provider.id]: provider }), {});
  return offers.map((offer) => ({
    id: offer.id,
    requestId: offer.request_id,
    providerId: offer.provider_id,
    message: offer.message,
    price: offer.price,
    status: offer.status,
    createdAt: offer.created_at,
    provider: providerMap[offer.provider_id] ? buildUserResponse(providerMap[offer.provider_id]) : undefined,
  }));
}

app.use(errorHandler);

ensureMediaRoots()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Başlatma hatası', error);
    process.exit(1);
  });
