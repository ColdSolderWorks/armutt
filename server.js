const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROVIDERS_FILE = path.join(DATA_DIR, 'providers.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function readJson(filePath) {
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

app.get('/api/providers', async (req, res) => {
  try {
    const providers = await readJson(PROVIDERS_FILE);
    const { category } = req.query;
    const filtered = category
      ? providers.filter((provider) => provider.category === category)
      : providers;
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: 'Hizmet sağlayıcıları yüklenemedi.' });
  }
});

app.get('/api/categories', async (_req, res) => {
  try {
    const providers = await readJson(PROVIDERS_FILE);
    const categories = Array.from(
      new Set(providers.map((provider) => provider.category))
    ).map((name) => ({
      name,
      providerCount: providers.filter((p) => p.category === name).length,
    }));
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Kategoriler yüklenemedi.' });
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

app.post('/api/requests', async (req, res) => {
  const { userId, category, description } = req.body;
  if (!userId || !category || !description) {
    return res.status(400).json({ message: 'Tüm alanları doldurun.' });
  }

  try {
    const requests = await readJson(REQUESTS_FILE);
    const newRequest = {
      id: uuid(),
      userId,
      category,
      description,
      status: 'Teklif Bekleniyor',
      createdAt: new Date().toISOString(),
    };
    requests.unshift(newRequest);
    await writeJson(REQUESTS_FILE, requests);
    res.status(201).json(newRequest);
  } catch (error) {
    res.status(500).json({ message: 'Talep oluşturulamadı.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Lütfen tüm alanları doldurun.' });
  }

  try {
    const users = await readJson(USERS_FILE);
    const existing = users.find((user) => user.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(409).json({ message: 'Bu e-posta ile kayıtlı bir kullanıcı zaten mevcut.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuid(),
      name,
      email,
      passwordHash,
    };

    users.push(newUser);
    await writeJson(USERS_FILE, users);

    res.status(201).json({
      message: 'Kayıt başarılı.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
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
    const users = await readJson(USERS_FILE);
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
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
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
