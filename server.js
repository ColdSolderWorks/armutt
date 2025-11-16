const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { v4: uuid } = require('uuid');
const bcrypt = require('bcrypt');
const { authMiddleware, createToken } = require('./src/middleware/auth');
const { errorHandler } = require('./src/middleware/error');
const { csrfProtection } = require('./src/middleware/csrf');
const { standardLimiter, authLimiter } = require('./src/middleware/rateLimit');
const { requireOwnership } = require('./src/middleware/ownership');
const { openDatabase, run, get, all } = require('./src/db');
const {
  buildUserResponse,
  createUser,
  updateProvider,
  updateCustomer,
  sanitizeText,
  validateEmail,
  validatePasswordComplexity,
  comparePassword,
} = require('./src/services/users');
const { normalizeText, normalizeLocation, REGIONS } = require('./src/utils/regions');
const { hasProfanity } = require('./src/utils/profanity');
const { ensureMediaRoots } = require('./src/utils/media');
const {
  PORT,
  PUBLIC_DIR,
  DATA_DIR,
  PROVIDER_MEDIA_ROOT,
  CUSTOMER_MEDIA_ROOT,
  ALLOWED_ORIGINS,
} = require('./src/config');

const ADMIN_EMAIL_HASH = process.env.ADMIN_EMAIL_HASH ? String(process.env.ADMIN_EMAIL_HASH) : null;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ? String(process.env.ADMIN_PASSWORD_HASH) : null;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase() : null;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD) : null;

const FAILED_ATTEMPTS = new Map();
const MAX_ATTEMPTS = 5;
const BLOCK_WINDOW_MS = 15 * 60 * 1000;

const app = express();
const db = openDatabase();

const allowedOrigins = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : ['http://localhost:3000'];
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Erişim izni yok.'));
  },
  credentials: true,
};

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(cors(corsOptions));
app.use(standardLimiter);
app.use(express.static(PUBLIC_DIR));

app.use('/api', csrfProtection);

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.get('/api/locations', (_req, res) => {
  res.json(REGIONS);
});

app.get('/api/categories', (_req, res) => {
  res.json(['Boya', 'Nakliyat', 'Temizlik', 'Tadilat', 'Elektrik', 'Marangoz', 'Beyaz Eşya', 'Özel Ders']);
});

function isBlocked(email) {
  const entry = FAILED_ATTEMPTS.get(email);
  if (!entry) return false;
  if (Date.now() - entry.time > BLOCK_WINDOW_MS) {
    FAILED_ATTEMPTS.delete(email);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(email) {
  const existing = FAILED_ATTEMPTS.get(email) || { count: 0, time: Date.now() };
  FAILED_ATTEMPTS.set(email, { count: existing.count + 1, time: existing.time });
}

function clearFailures(email) {
  FAILED_ATTEMPTS.delete(email);
}

app.post('/api/auth/register', authLimiter, async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role, profession, category, city, district } = req.body || {};

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

    const { userId, verificationCode } = await createUser(db, {
      firstName,
      lastName,
      email,
      password,
      role,
      profession,
      category,
      city,
      district,
    });

    res.json({ message: 'Kayıt oluşturuldu. E-posta doğrulaması gerekiyor.', verificationCode, userId });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/verify', authLimiter, async (req, res, next) => {
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

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'E-posta ve şifre gereklidir.' });
    }
    const loweredEmail = email.toLowerCase();
    if (isBlocked(loweredEmail)) {
      return res.status(429).json({ message: 'Çok sayıda hatalı giriş. Lütfen birkaç dakika sonra tekrar deneyin.' });
    }

    if (ADMIN_EMAIL && ADMIN_PASSWORD && loweredEmail === ADMIN_EMAIL.toLowerCase()) {
      const ok = ADMIN_PASSWORD_HASH ? await bcrypt.compare(password, ADMIN_PASSWORD_HASH) : password === ADMIN_PASSWORD;
      if (!ok) {
        recordFailure(loweredEmail);
        return res.status(401).json({ message: 'Geçersiz bilgiler.' });
      }
      clearFailures(loweredEmail);
      const token = createToken({ sub: 'admin', role: 'admin', email: ADMIN_EMAIL });
      return res.json({ message: 'Giriş başarılı.', user: { id: 'admin', role: 'admin', email: ADMIN_EMAIL, token } });
    }

    const user = await get(db, 'SELECT * FROM users WHERE email = ?', [loweredEmail]);
    if (!user || !user.verified) {
      recordFailure(loweredEmail);
      return res.status(401).json({ message: 'Geçersiz bilgiler.' });
    }
    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      recordFailure(loweredEmail);
      return res.status(401).json({ message: 'Geçersiz bilgiler.' });
    }

    clearFailures(loweredEmail);
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

    const refreshed = await updateProvider(db, provider, req.body || {});
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

    const refreshed = await updateCustomer(db, user, req.body || {});
    res.json(buildUserResponse(refreshed));
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

app.use(errorHandler);

ensureMediaRoots([DATA_DIR, PUBLIC_DIR, PROVIDER_MEDIA_ROOT, CUSTOMER_MEDIA_ROOT])
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
