const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
const PROFANITY_FILE = path.join(DATA_DIR, 'profanity.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MEDIA_ROOT = path.join(PUBLIC_DIR, 'uploads');
const PROVIDER_MEDIA_ROOT = path.join(MEDIA_ROOT, 'providers');
const CUSTOMER_MEDIA_ROOT = path.join(MEDIA_ROOT, 'customers');

const ADMIN_EMAIL_HASH = process.env.ADMIN_EMAIL_HASH ? String(process.env.ADMIN_EMAIL_HASH) : null;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ? String(process.env.ADMIN_PASSWORD_HASH) : null;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase() : null;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD) : null;
const ADMIN_SESSION_TTL = Number(process.env.ADMIN_SESSION_TTL || 1000 * 60 * 60 * 12);

const adminSessions = new Map();
let profanityCache = null;

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
  {
    city: 'Gümüşhane',
    districts: ['Merkez', 'Kelkit', 'Köse', 'Kürtün', 'Şiran', 'Torul'],
  },
  {
    city: 'Rize',
    districts: [
      'Merkez',
      'Ardeşen',
      'Çamlıhemşin',
      'Çayeli',
      'Derepazarı',
      'Fındıklı',
      'Güneysu',
      'Hemşin',
      'İkizdere',
      'İyidere',
      'Kalkandere',
      'Pazar',
    ],
  },
];

const REGION_LOOKUP = REGIONS.reduce((acc, region) => {
  const key = normalizeText(region.city).replace(/\s+/g, '');
  acc[key] = region;
  return acc;
}, {});

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureMediaRoots() {
  await Promise.all([
    ensureDir(DATA_DIR),
    ensureDir(MEDIA_ROOT),
    ensureDir(PROVIDER_MEDIA_ROOT),
    ensureDir(CUSTOMER_MEDIA_ROOT),
  ]);
}

async function removeDirectory(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
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
  const buffer = Buffer.from(base64, 'base64');
  const extension = (() => {
    if (!mime) return 'bin';
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/png') return 'png';
    if (mime === 'image/gif') return 'gif';
    if (mime === 'image/webp') return 'webp';
    if (mime === 'image/svg+xml') return 'svg';
    const [, subtype] = mime.split('/');
    return subtype || 'bin';
  })();

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

async function saveDataUrlToFile(dataUrl, baseDir, prefix) {
  if (!isDataUrl(dataUrl)) {
    return dataUrl;
  }
  await ensureDir(baseDir);
  const { buffer, extension } = parseDataUrl(dataUrl);
  const fileName = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}.${extension}`;
  const destination = path.join(baseDir, fileName);
  await fs.writeFile(destination, buffer);
  return toPublicPath(destination);
}

async function removeFile(publicPath) {
  if (!publicPath) {
    return;
  }
  const absolute = fromPublicPath(publicPath);
  if (!absolute) return;
  try {
    await fs.unlink(absolute);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

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

async function loadProfanityList() {
  if (profanityCache) {
    return profanityCache;
  }
  try {
    const raw = await fs.readFile(PROFANITY_FILE, 'utf8');
    const data = JSON.parse(raw);
    profanityCache = Array.isArray(data) ? data.map((item) => normalizeText(item)).filter(Boolean) : [];
  } catch (error) {
    profanityCache = [];
  }
  return profanityCache;
}

async function containsProfanity(value) {
  if (!value) {
    return false;
  }
  const normalized = normalizeText(value);
  const list = await loadProfanityList();
  return list.some((entry) => normalized.includes(entry));
}

function isAdminConfigured() {
  return Boolean((ADMIN_EMAIL_HASH || ADMIN_EMAIL) && (ADMIN_PASSWORD_HASH || ADMIN_PASSWORD));
}

async function compareWithHash(value, hash) {
  if (!hash) {
    return false;
  }
  try {
    return await bcrypt.compare(value, hash);
  } catch (error) {
    return false;
  }
}

async function authenticateAdminCredentials(email, password) {
  if (!isAdminConfigured()) {
    return null;
  }

  const normalizedEmail = (email || '').toLowerCase();

  let emailMatches = false;
  if (ADMIN_EMAIL_HASH) {
    emailMatches = await compareWithHash(normalizedEmail, ADMIN_EMAIL_HASH);
  } else if (ADMIN_EMAIL) {
    emailMatches = ADMIN_EMAIL === normalizedEmail;
  }

  if (!emailMatches) {
    return null;
  }

  let passwordMatches = false;
  if (ADMIN_PASSWORD_HASH) {
    passwordMatches = await compareWithHash(password, ADMIN_PASSWORD_HASH);
  } else if (ADMIN_PASSWORD) {
    passwordMatches = ADMIN_PASSWORD === password;
  }

  if (!passwordMatches) {
    return null;
  }

  return normalizedEmail;
}

function purgeExpiredAdminSessions() {
  const now = Date.now();
  for (const [token, session] of adminSessions.entries()) {
    if (session.expiresAt <= now) {
      adminSessions.delete(token);
    }
  }
}

function createAdminSession(email) {
  purgeExpiredAdminSessions();
  const token = uuid();
  adminSessions.set(token, { email, expiresAt: Date.now() + ADMIN_SESSION_TTL });
  return token;
}

function getAdminSessionFromRequest(req) {
  purgeExpiredAdminSessions();
  const authHeader = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/.exec(authHeader);
  if (!match) {
    return null;
  }
  const token = match[1];
  const session = adminSessions.get(token);
  if (!session) {
    return null;
  }
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function requireAdmin(req, res, next) {
  if (!isAdminConfigured()) {
    return res.status(404).json({ message: 'Bulunamadı' });
  }
  const session = getAdminSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ message: 'Yetkisiz işlem.' });
  }
  req.admin = session;
  return next();
}

async function removeProviderAccount(providerId) {
  const users = await getUsers();
  const index = users.findIndex((candidate) => candidate.id === providerId && candidate.role === 'usta');
  if (index === -1) {
    return null;
  }

  const [removed] = users.splice(index, 1);
  await saveUsers(users);

  const requests = await getRequests();
  let changed = false;
  const sanitizedRequests = requests.map((request) => {
    if (!Array.isArray(request.offers) || !request.offers.length) {
      return request;
    }
    const filteredOffers = request.offers.filter((offer) => offer.providerId !== providerId);
    if (filteredOffers.length === request.offers.length) {
      return request;
    }
    changed = true;
    const acceptedStillExists = filteredOffers.some((offer) => offer.id === request.acceptedOfferId);
    return {
      ...request,
      offers: filteredOffers,
      acceptedOfferId: acceptedStillExists ? request.acceptedOfferId : null,
      status: acceptedStillExists ? request.status : 'Teklif Bekleniyor',
    };
  });
  if (changed) {
    await saveRequests(sanitizedRequests);
  }

  await removeDirectory(path.join(PROVIDER_MEDIA_ROOT, providerId));
  return buildProviderSummary(removed);
}

async function removeCustomerAccount(customerId) {
  const users = await getUsers();
  const index = users.findIndex((candidate) => candidate.id === customerId && candidate.role === 'musteri');
  if (index === -1) {
    return null;
  }

  const [removed] = users.splice(index, 1);
  await saveUsers(users);

  const requests = await getRequests();
  const filteredRequests = requests.filter((request) => request.userId !== customerId);
  if (filteredRequests.length !== requests.length) {
    await saveRequests(filteredRequests);
  }

  await removeDirectory(path.join(CUSTOMER_MEDIA_ROOT, customerId));
  return sanitizeUser(removed);
}

async function removeRequestItem(requestId) {
  const requests = await getRequests();
  const index = requests.findIndex((candidate) => candidate.id === requestId);
  if (index === -1) {
    return null;
  }
  const [removed] = requests.splice(index, 1);
  await saveRequests(requests);
  return removed;
}

async function removeOfferItem(requestId, offerId) {
  const requests = await getRequests();
  const request = requests.find((candidate) => candidate.id === requestId);
  if (!request || !Array.isArray(request.offers)) {
    return null;
  }

  const index = request.offers.findIndex((offer) => offer.id === offerId);
  if (index === -1) {
    return null;
  }

  const [removed] = request.offers.splice(index, 1);
  if (request.acceptedOfferId === removed.id) {
    request.acceptedOfferId = null;
    request.status = 'Teklif Bekleniyor';
  }
  await saveRequests(requests);
  return { request, offer: removed };
}

function countProviderOffers(requests = []) {
  return requests.reduce((acc, request) => {
    if (!Array.isArray(request.offers)) {
      return acc;
    }
    request.offers.forEach((offer) => {
      if (!offer.providerId) return;
      acc[offer.providerId] = (acc[offer.providerId] || 0) + 1;
    });
    return acc;
  }, {});
}

function countCustomerRequests(requests = []) {
  return requests.reduce((acc, request) => {
    if (!request.userId) {
      return acc;
    }
    acc[request.userId] = (acc[request.userId] || 0) + 1;
    return acc;
  }, {});
}

async function buildAdminSummary() {
  const [users, requests] = await Promise.all([getUsers(), getRequests()]);
  const providerOfferCounts = countProviderOffers(requests);
  const customerRequestCounts = countCustomerRequests(requests);

  const providers = users
    .filter((user) => user.role === 'usta')
    .map((user) => ({
      ...buildProviderSummary(user),
      email: user.email,
      offerCount: providerOfferCounts[user.id] || 0,
    }));

  const customers = users
    .filter((user) => user.role === 'musteri')
    .map((user) => ({
      id: user.id,
      email: user.email,
      profile: user.profile || {},
      requestCount: customerRequestCounts[user.id] || 0,
    }));

  const requestsWithProviders = mapRequestsWithProviders(requests, users);

  return {
    stats: {
      providerCount: providers.length,
      customerCount: customers.length,
      requestCount: requestsWithProviders.length,
    },
    providers,
    customers,
    requests: requestsWithProviders,
  };
}

ensureMediaRoots().catch((error) => {
  console.error('Medya klasörleri oluşturulamadı:', error);
});

async function readJson(filePath) {
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function getUsers() {
  return readJson(USERS_FILE);
}

async function saveUsers(users) {
  await writeJson(USERS_FILE, users);
}

async function getRequests() {
  return readJson(REQUESTS_FILE);
}

async function saveRequests(requests) {
  await writeJson(REQUESTS_FILE, requests);
}

function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function buildProviderSummary(user) {
  const profile = user.profile || {};
  const reviews = user.reviews || [];
  const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
  const rating = reviews.length ? Number((totalRating / reviews.length).toFixed(2)) : 0;

  const firstName = profile.firstName || '';
  const lastName = profile.lastName || '';
  const emailName = user.email ? user.email.split('@')[0] : '';
  let fullName = `${firstName} ${lastName}`.trim();
  if (!fullName) {
    fullName = profile.profession || '';
  }
  if (!fullName) {
    fullName = emailName;
  }
  if (!fullName) {
    fullName = 'Trabzon Ustası';
  }

  return {
    id: user.id,
    fullName,
    firstName,
    lastName,
    profession: profile.profession || '',
    category: profile.category || 'Belirtilmedi',
    city: profile.city || 'Trabzon',
    district: profile.district || 'Ortahisar',
    about: profile.about || '',
    rating,
    reviewCount: reviews.length,
    completedJobs: (user.stats && user.stats.completedJobs) || 0,
    contact: {
      phone: (profile.contact && profile.contact.phone) || '',
      email: (profile.contact && profile.contact.email) || user.email,
      website: (profile.contact && profile.contact.website) || '',
    },
    avatar: profile.avatar || '',
    banner: profile.banner || '',
    gallery: profile.gallery || [],
    reviews,
  };
}

function updateProviderStats(users, providerId, feedback) {
  const provider = users.find((candidate) => candidate.id === providerId && candidate.role === 'usta');
  if (!provider) {
    return;
  }

  provider.stats = provider.stats || {};
  provider.stats.completedJobs = (provider.stats.completedJobs || 0) + 1;

  if (feedback && feedback.rating) {
    provider.reviews = provider.reviews || [];
    provider.reviews.push({
      id: uuid(),
      rating: feedback.rating,
      comment: feedback.comment || '',
      customerName: feedback.customerName || 'Müşteri',
      createdAt: new Date().toISOString(),
    });
  }
}

function matchesQuery(value = '', query = '') {
  if (!query) {
    return true;
  }
  const normalizedValue = value.toString().toLowerCase();
  const normalizedQuery = query.toString().toLowerCase();
  return normalizedValue.includes(normalizedQuery);
}

app.get('/api/providers', async (req, res) => {
  try {
    const users = await getUsers();
    const { category, q } = req.query;
    const providers = users
      .filter((user) => user.role === 'usta')
      .map(buildProviderSummary)
      .filter((provider) => {
        const categoryMatch = !category || provider.category === category;
        if (!categoryMatch) {
          return false;
        }
        if (!q) {
          return true;
        }
        const haystack = [
          provider.fullName,
          provider.profession,
          provider.category,
          provider.city,
          provider.about,
        ]
          .filter(Boolean)
          .join(' ');
        return matchesQuery(haystack, q);
      });

    res.json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Hizmet sağlayıcıları yüklenemedi.' });
  }
});

app.get('/api/providers/:id', async (req, res) => {
  try {
    const users = await getUsers();
    const user = users.find((candidate) => candidate.id === req.params.id && candidate.role === 'usta');

    if (!user) {
      return res.status(404).json({ message: 'Usta bulunamadı.' });
    }

    res.json(buildProviderSummary(user));
  } catch (error) {
    res.status(500).json({ message: 'Usta bilgileri alınamadı.' });
  }
});

app.put('/api/providers/:id', async (req, res) => {
  try {
    const users = await getUsers();
    const user = users.find((candidate) => candidate.id === req.params.id && candidate.role === 'usta');

    if (!user) {
      return res.status(404).json({ message: 'Usta bulunamadı.' });
    }

    const {
      firstName,
      lastName,
      profession,
      city,
      district,
      about,
      category,
      contact,
      avatar,
      banner,
      gallery,
    } = req.body;

    user.profile = user.profile || {};
    if (firstName !== undefined) user.profile.firstName = (firstName || '').trim();
    if (lastName !== undefined) user.profile.lastName = (lastName || '').trim();
    if (profession !== undefined) user.profile.profession = (profession || '').trim();
    if (city !== undefined || district !== undefined) {
      const location = normalizeLocation(
        city !== undefined ? city : user.profile.city,
        district !== undefined ? district : user.profile.district,
      );
      user.profile.city = location.city;
      user.profile.district = location.district;
    }
    if (about !== undefined) {
      if (await containsProfanity(about)) {
        return res.status(400).json({ message: 'Metin uygunsuz ifadeler içeriyor.' });
      }
      user.profile.about = about || '';
    }
    if (category !== undefined) user.profile.category = (category || '').trim();
    if (contact !== undefined) {
      user.profile.contact = {
        phone: contact?.phone || '',
        email: contact?.email || user.email,
        website: contact?.website || '',
      };
    }

    const providerBaseDir = path.join(PROVIDER_MEDIA_ROOT, user.id);
    const avatarDir = path.join(providerBaseDir, 'avatar');
    const bannerDir = path.join(providerBaseDir, 'banner');
    const galleryDir = path.join(providerBaseDir, 'gallery');

    const previousAvatar = user.profile.avatar || '';
    const previousBanner = user.profile.banner || '';
    const previousGallery = Array.isArray(user.profile.gallery) ? [...user.profile.gallery] : [];

    if (avatar !== undefined) {
      if (!avatar) {
        await removeFile(previousAvatar);
        user.profile.avatar = '';
      } else {
        const storedAvatar = await saveDataUrlToFile(avatar, avatarDir, 'avatar');
        if (storedAvatar !== previousAvatar) {
          await removeFile(previousAvatar);
        }
        user.profile.avatar = storedAvatar;
      }
    }

    if (banner !== undefined) {
      if (!banner) {
        await removeFile(previousBanner);
        user.profile.banner = '';
      } else {
        const storedBanner = await saveDataUrlToFile(banner, bannerDir, 'banner');
        if (storedBanner !== previousBanner) {
          await removeFile(previousBanner);
        }
        user.profile.banner = storedBanner;
      }
    }

    if (Array.isArray(gallery)) {
      const normalizedGallery = [];
      for (const item of gallery) {
        if (!item) {
          continue;
        }
        if (isDataUrl(item)) {
          // eslint-disable-next-line no-await-in-loop
          const stored = await saveDataUrlToFile(item, galleryDir, 'gallery');
          normalizedGallery.push(stored);
        } else {
          normalizedGallery.push(item);
        }
      }
      const removed = previousGallery.filter((existing) => !normalizedGallery.includes(existing));
      await Promise.all(removed.map((file) => removeFile(file)));
      user.profile.gallery = normalizedGallery;
    }

    await saveUsers(users);
    res.json(buildProviderSummary(user));
  } catch (error) {
    res.status(500).json({ message: 'Usta bilgileri güncellenemedi.' });
  }
});

app.get('/api/categories', async (_req, res) => {
  try {
    const users = await getUsers();
    const providers = users.filter((user) => user.role === 'usta');
    const categories = Array.from(new Set(providers.map((provider) => provider.profile.category || 'Belirtilmedi')))
      .filter(Boolean)
      .map((name) => ({
        name,
        providerCount: providers.filter((provider) => (provider.profile.category || 'Belirtilmedi') === name).length,
      }));

    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Kategoriler yüklenemedi.' });
  }
});

app.get('/api/locations', (_req, res) => {
  res.json(REGIONS);
});

app.get('/api/customers/:id', async (req, res) => {
  try {
    const users = await getUsers();
    const user = users.find((candidate) => candidate.id === req.params.id && candidate.role === 'musteri');

    if (!user) {
      return res.status(404).json({ message: 'Müşteri bulunamadı.' });
    }

    res.json(sanitizeUser(user));
  } catch (error) {
    res.status(500).json({ message: 'Müşteri bilgileri alınamadı.' });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const users = await getUsers();
    const user = users.find((candidate) => candidate.id === req.params.id && candidate.role === 'musteri');

    if (!user) {
      return res.status(404).json({ message: 'Müşteri bulunamadı.' });
    }

    const { firstName, lastName, city, district, email, phone, avatar } = req.body;
    user.profile = user.profile || {};

    if (firstName !== undefined) user.profile.firstName = firstName;
    if (lastName !== undefined) user.profile.lastName = lastName;
    if (city !== undefined || district !== undefined) {
      const location = normalizeLocation(
        city !== undefined ? city : user.profile.city,
        district !== undefined ? district : user.profile.district,
      );
      user.profile.city = location.city;
      user.profile.district = location.district;
    }
    if (email !== undefined) user.profile.email = email;
    if (phone !== undefined) user.profile.phone = phone;
    const customerBaseDir = path.join(CUSTOMER_MEDIA_ROOT, user.id);
    const avatarDir = path.join(customerBaseDir, 'avatar');
    const previousAvatar = user.profile.avatar || '';

    if (avatar !== undefined) {
      if (!avatar) {
        await removeFile(previousAvatar);
        user.profile.avatar = '';
      } else {
        const storedAvatar = await saveDataUrlToFile(avatar, avatarDir, 'avatar');
        if (storedAvatar !== previousAvatar) {
          await removeFile(previousAvatar);
        }
        user.profile.avatar = storedAvatar;
      }
    }

    await saveUsers(users);
    res.json(sanitizeUser(user));
  } catch (error) {
    res.status(500).json({ message: 'Müşteri bilgileri güncellenemedi.' });
  }
});

function mapOffersWithProvider(offers = [], users = []) {
  return offers.map((offer) => {
    const provider = users.find((candidate) => candidate.id === offer.providerId && candidate.role === 'usta');
    const providerSummary = provider ? buildProviderSummary(provider) : null;
    return {
      ...offer,
      provider: providerSummary
        ? {
            id: providerSummary.id,
            fullName: providerSummary.fullName,
            profession: providerSummary.profession,
            city: providerSummary.city,
            district: providerSummary.district,
            avatar: providerSummary.avatar,
            contact: providerSummary.contact,
          }
        : {
            id: offer.providerId,
            fullName: offer.providerName || 'Usta',
            city: offer.providerCity || '',
            district: offer.providerDistrict || '',
          },
    };
  });
}

function mapRequestsWithProviders(requests = [], users = []) {
  return requests.map((request) => ({
    ...request,
    offers: mapOffersWithProvider(request.offers || [], users),
  }));
}

app.get('/api/requests', async (_req, res) => {
  try {
    const [requests, users] = await Promise.all([readJson(REQUESTS_FILE), getUsers()]);
    res.json(mapRequestsWithProviders(requests, users));
  } catch (error) {
    res.status(500).json({ message: 'Talepler yüklenemedi.' });
  }
});

app.get('/api/requests/customer/:customerId', async (req, res) => {
  try {
    const [requests, users] = await Promise.all([readJson(REQUESTS_FILE), getUsers()]);
    const filtered = requests.filter((request) => request.userId === req.params.customerId);
    res.json(mapRequestsWithProviders(filtered, users));
  } catch (error) {
    res.status(500).json({ message: 'Müşteri talepleri yüklenemedi.' });
  }
});

app.get('/api/requests/provider/:providerId', async (req, res) => {
  try {
    const [requests, users] = await Promise.all([readJson(REQUESTS_FILE), getUsers()]);
    const filtered = requests.filter((request) => {
      if (!Array.isArray(request.offers)) {
        return false;
      }
      return request.offers.some((offer) => offer.providerId === req.params.providerId);
    });
    res.json(mapRequestsWithProviders(filtered, users));
  } catch (error) {
    res.status(500).json({ message: 'Usta teklifleri yüklenemedi.' });
  }
});

app.post('/api/requests', async (req, res) => {
  const { userId, category, description } = req.body;
  if (!userId || !category || !description) {
    return res.status(400).json({ message: 'Tüm alanları doldurun.' });
  }

  try {
    const users = await getUsers();
    const customer = users.find((user) => user.id === userId && user.role === 'musteri');

    if (!customer) {
      return res.status(400).json({ message: 'Talep oluşturmak için müşteri hesabı gerekir.' });
    }

    if (await containsProfanity(description) || (await containsProfanity(category))) {
      return res.status(400).json({ message: 'Metin uygunsuz ifadeler içeriyor.' });
    }

    const requests = await readJson(REQUESTS_FILE);
    const location = normalizeLocation(customer.profile?.city, customer.profile?.district);
    const newRequest = {
      id: uuid(),
      userId,
      category,
      description,
      status: 'Teklif Bekleniyor',
      createdAt: new Date().toISOString(),
      city: location.city,
      district: location.district,
      offers: [],
    };
    requests.unshift(newRequest);
    await writeJson(REQUESTS_FILE, requests);
    res.status(201).json(newRequest);
  } catch (error) {
    res.status(500).json({ message: 'Talep oluşturulamadı.' });
  }
});

app.post('/api/requests/:requestId/offers', async (req, res) => {
  const { providerId, message, price } = req.body;

  if (!providerId || !message || !price) {
    return res.status(400).json({ message: 'Tüm alanları doldurun.' });
  }

  try {
    const users = await getUsers();
    const provider = users.find((user) => user.id === providerId && user.role === 'usta');
    if (!provider) {
      return res.status(400).json({ message: 'Teklif göndermek için usta hesabı gerekir.' });
    }

    if (await containsProfanity(message)) {
      return res.status(400).json({ message: 'Metin uygunsuz ifadeler içeriyor.' });
    }

    const requests = await readJson(REQUESTS_FILE);
    const request = requests.find((candidate) => candidate.id === req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Talep bulunamadı.' });
    }

    request.offers = request.offers || [];
    const providerSummary = buildProviderSummary(provider);
    const offer = {
      id: uuid(),
      providerId,
      providerName: providerSummary.fullName,
      providerProfession: providerSummary.profession,
      providerCity: providerSummary.city,
      providerDistrict: providerSummary.district,
      message,
      price,
      status: 'Beklemede',
      createdAt: new Date().toISOString(),
    };
    request.offers.push(offer);

    await writeJson(REQUESTS_FILE, requests);
    res.status(201).json(offer);
  } catch (error) {
    res.status(500).json({ message: 'Teklif gönderilemedi.' });
  }
});

app.post('/api/requests/:requestId/offers/:offerId/accept', async (req, res) => {
  const { customerId, rating, comment } = req.body;

  if (!customerId) {
    return res.status(400).json({ message: 'Müşteri bilgisi eksik.' });
  }

  try {
    const users = await getUsers();
    const requests = await readJson(REQUESTS_FILE);
    const request = requests.find((candidate) => candidate.id === req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Talep bulunamadı.' });
    }

    if (request.userId !== customerId) {
      return res.status(403).json({ message: 'Bu talep size ait değil.' });
    }

    if (!Array.isArray(request.offers)) {
      return res.status(400).json({ message: 'Bu talep için teklif bulunmuyor.' });
    }

    const offer = request.offers.find((candidate) => candidate.id === req.params.offerId);
    if (!offer) {
      return res.status(404).json({ message: 'Teklif bulunamadı.' });
    }

    if (comment && (await containsProfanity(comment))) {
      return res.status(400).json({ message: 'Metin uygunsuz ifadeler içeriyor.' });
    }

    request.offers = request.offers.map((candidate) => ({
      ...candidate,
      status: candidate.id === offer.id ? 'Kabul Edildi' : 'Reddedildi',
    }));
    request.status = 'Teklif Kabul Edildi';
    request.acceptedOfferId = offer.id;

    await writeJson(REQUESTS_FILE, requests);

    const customer = users.find((candidate) => candidate.id === customerId);
    const feedback = rating
      ? {
          rating: Number(rating),
          comment,
          customerName: customer
            ? `${customer.profile.firstName || ''} ${customer.profile.lastName || ''}`.trim() || customer.email
            : 'Müşteri',
        }
      : null;

    updateProviderStats(users, offer.providerId, feedback);
    await saveUsers(users);

    res.json({ message: 'Teklif kabul edildi.', request });
  } catch (error) {
    res.status(500).json({ message: 'Teklif kabul edilemedi.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    password,
    role,
    profession,
    city: cityInput,
    district: districtInput,
    category,
  } = req.body;

  if (!firstName || !lastName || !email || !password || !role) {
    return res.status(400).json({ message: 'Lütfen tüm alanları doldurun.' });
  }

  if (!['usta', 'musteri'].includes(role)) {
    return res.status(400).json({ message: 'Geçersiz rol seçimi.' });
  }

  try {
    const users = await getUsers();
    const existing = users.find((user) => user.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(409).json({ message: 'Bu e-posta ile kayıtlı bir kullanıcı zaten mevcut.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuid();
    const location = normalizeLocation(cityInput, districtInput);
    const profileBase = {
      firstName,
      lastName,
      city: location.city,
      district: location.district,
      avatar: '',
    };

    const newUser = {
      id,
      role,
      email,
      passwordHash,
      profile: {
        ...profileBase,
        ...(role === 'usta'
          ? {
              profession: profession || '',
              about: '',
              category: category || '',
              banner: '',
              gallery: [],
              contact: {
                phone: '',
                email,
                website: '',
              },
            }
          : {
              email,
              phone: '',
            }),
      },
    };

    if (role === 'usta') {
      newUser.stats = { completedJobs: 0 };
      newUser.reviews = [];
    }

    users.push(newUser);
    await saveUsers(users);

    res.status(201).json({
      message: 'Kayıt başarılı.',
      user: sanitizeUser(newUser),
    });
  } catch (error) {
    res.status(500).json({ message: 'Kayıt sırasında bir sorun oluştu.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'E-posta ve şifre gereklidir.' });
  }

  try {
    const adminEmail = await authenticateAdminCredentials(email, password);
    if (adminEmail) {
      const token = createAdminSession(adminEmail);
      return res.json({
        message: 'Giriş başarılı.',
        user: {
          id: 'admin',
          role: 'admin',
          email: adminEmail,
          token,
          profile: {
            firstName: 'Yönetici',
            lastName: '',
            city: 'Trabzon',
            district: 'Merkez',
          },
        },
      });
    }

    const normalizedEmail = email.toLowerCase();
    const users = await getUsers();
    const user = users.find((candidate) => candidate.email.toLowerCase() === normalizedEmail);

    if (!user) {
      return res.status(401).json({ message: 'E-posta veya şifre hatalı.' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'E-posta veya şifre hatalı.' });
    }

    res.json({
      message: 'Giriş başarılı.',
      user: sanitizeUser(user),
    });
  } catch (error) {
    res.status(500).json({ message: 'Giriş sırasında bir sorun oluştu.' });
  }
});

const adminRouter = express.Router();

adminRouter.use(requireAdmin);

adminRouter.get('/summary', async (_req, res) => {
  try {
    const summary = await buildAdminSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Yönetici verileri yüklenemedi.' });
  }
});

adminRouter.delete('/providers/:id', async (req, res) => {
  try {
    const provider = await removeProviderAccount(req.params.id);
    if (!provider) {
      return res.status(404).json({ message: 'Usta bulunamadı.' });
    }
    const summary = await buildAdminSummary();
    return res.json({ message: 'Usta kaldırıldı.', provider, summary });
  } catch (error) {
    return res.status(500).json({ message: 'Usta silinemedi.' });
  }
});

adminRouter.delete('/customers/:id', async (req, res) => {
  try {
    const customer = await removeCustomerAccount(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı.' });
    }
    const summary = await buildAdminSummary();
    return res.json({ message: 'Müşteri kaldırıldı.', customer, summary });
  } catch (error) {
    return res.status(500).json({ message: 'Müşteri silinemedi.' });
  }
});

adminRouter.delete('/requests/:id', async (req, res) => {
  try {
    const removed = await removeRequestItem(req.params.id);
    if (!removed) {
      return res.status(404).json({ message: 'Talep bulunamadı.' });
    }
    const summary = await buildAdminSummary();
    return res.json({ message: 'Talep kaldırıldı.', request: removed, summary });
  } catch (error) {
    return res.status(500).json({ message: 'Talep silinemedi.' });
  }
});

adminRouter.delete('/requests/:requestId/offers/:offerId', async (req, res) => {
  try {
    const removed = await removeOfferItem(req.params.requestId, req.params.offerId);
    if (!removed) {
      return res.status(404).json({ message: 'Teklif bulunamadı.' });
    }
    const summary = await buildAdminSummary();
    return res.json({ message: 'Teklif kaldırıldı.', summary });
  } catch (error) {
    return res.status(500).json({ message: 'Teklif silinemedi.' });
  }
});

app.use('/api/admin', adminRouter);

app.use((req, res) => {
  res.status(404).json({ message: 'Bulunamadı' });
});

app.listen(PORT, () => {
  console.log(`TrabzonIsBul sunucusu ${PORT} portunda çalışıyor.`);
});
