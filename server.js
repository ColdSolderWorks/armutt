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

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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

  return {
    id: user.id,
    fullName: `${firstName} ${lastName}`.trim() || profile.profession || 'Usta',
    firstName,
    lastName,
    profession: profile.profession || '',
    category: profile.category || 'Belirtilmedi',
    city: profile.city || 'Trabzon',
    about: profile.about || '',
    rating,
    reviewCount: reviews.length,
    completedJobs: (user.stats && user.stats.completedJobs) || 0,
    contact: profile.contact || {},
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

app.get('/api/providers', async (req, res) => {
  try {
    const users = await getUsers();
    const { category } = req.query;
    const providers = users
      .filter((user) => user.role === 'usta')
      .map(buildProviderSummary)
      .filter((provider) => !category || provider.category === category);

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
      about,
      category,
      contact,
      avatar,
      banner,
      gallery,
    } = req.body;

    user.profile = user.profile || {};
    if (firstName !== undefined) user.profile.firstName = firstName;
    if (lastName !== undefined) user.profile.lastName = lastName;
    if (profession !== undefined) user.profile.profession = profession;
    if (city !== undefined) user.profile.city = city;
    if (about !== undefined) user.profile.about = about;
    if (category !== undefined) user.profile.category = category;
    if (contact !== undefined) user.profile.contact = contact;
    if (avatar !== undefined) user.profile.avatar = avatar;
    if (banner !== undefined) user.profile.banner = banner;
    if (Array.isArray(gallery)) {
      user.profile.gallery = gallery;
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

    const { firstName, lastName, city, email, phone, avatar } = req.body;
    user.profile = user.profile || {};

    if (firstName !== undefined) user.profile.firstName = firstName;
    if (lastName !== undefined) user.profile.lastName = lastName;
    if (city !== undefined) user.profile.city = city;
    if (email !== undefined) user.profile.email = email;
    if (phone !== undefined) user.profile.phone = phone;
    if (avatar !== undefined) user.profile.avatar = avatar;

    await saveUsers(users);
    res.json(sanitizeUser(user));
  } catch (error) {
    res.status(500).json({ message: 'Müşteri bilgileri güncellenemedi.' });
  }
});

app.get('/api/requests', async (_req, res) => {
  try {
    const requests = await readJson(REQUESTS_FILE);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Talepler yüklenemedi.' });
  }
});

app.get('/api/requests/customer/:customerId', async (req, res) => {
  try {
    const requests = await readJson(REQUESTS_FILE);
    const filtered = requests.filter((request) => request.userId === req.params.customerId);
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: 'Müşteri talepleri yüklenemedi.' });
  }
});

app.get('/api/requests/provider/:providerId', async (req, res) => {
  try {
    const requests = await readJson(REQUESTS_FILE);
    const filtered = requests.filter((request) => {
      if (!Array.isArray(request.offers)) {
        return false;
      }
      return request.offers.some((offer) => offer.providerId === req.params.providerId);
    });
    res.json(filtered);
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

    const requests = await readJson(REQUESTS_FILE);
    const newRequest = {
      id: uuid(),
      userId,
      category,
      description,
      status: 'Teklif Bekleniyor',
      createdAt: new Date().toISOString(),
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

    const requests = await readJson(REQUESTS_FILE);
    const request = requests.find((candidate) => candidate.id === req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Talep bulunamadı.' });
    }

    request.offers = request.offers || [];
    const offer = {
      id: uuid(),
      providerId,
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
  const { firstName, lastName, email, password, role, profession, city } = req.body;

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
    const profileBase = {
      firstName,
      lastName,
      city: city || '',
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
              category: '',
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
    const users = await getUsers();
    const user = users.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());

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

app.use((req, res) => {
  res.status(404).json({ message: 'Bulunamadı' });
});

app.listen(PORT, () => {
  console.log(`TrabzonIsBul sunucusu ${PORT} portunda çalışıyor.`);
});
