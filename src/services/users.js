const path = require('path');
const { v4: uuid } = require('uuid');
const { sanitizeText, validateEmail, validatePasswordComplexity, hashPassword, comparePassword } = require('../utils/security');
const { normalizeLocation } = require('../utils/regions');
const { saveMedia, removeFile } = require('../utils/media');
const { get, run } = require('../db');
const { PROVIDER_MEDIA_ROOT, CUSTOMER_MEDIA_ROOT } = require('../config');

function buildUserResponse(user, token) {
  if (!user) return null;
  const gallery = user.gallery ? JSON.parse(user.gallery) : [];
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    profession: user.profession,
    category: user.category,
    about: user.about,
    city: user.city,
    district: user.district,
    shopName: user.shop_name,
    shopAddress: user.shop_address,
    contact: {
      phone: user.phone,
      email: user.contact_email || user.email,
      website: user.website,
    },
    avatar: user.avatar,
    banner: user.banner,
    gallery,
    media: {
      avatar: user.avatar,
      banner: user.banner,
      gallery,
    },
    stats: {
      rating: user.rating,
      reviewCount: user.review_count,
      completedJobs: user.completed_jobs,
    },
    verified: Boolean(user.verified),
    fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
    access: {
      admin: user.role === 'admin',
      provider: user.role === 'usta',
      customer: user.role === 'musteri',
    },
    token,
  };
}

async function createUser(db, payload) {
  const verificationCode = uuid();
  const hashed = await hashPassword(payload.password);
  const location = normalizeLocation(payload.city, payload.district);
  const userId = uuid();
  await run(
    db,
    `INSERT INTO users (id, role, email, password_hash, first_name, last_name, profession, category, about, city, district, verification_code)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      userId,
      payload.role,
      payload.email.toLowerCase(),
      hashed,
      sanitizeText(payload.firstName),
      sanitizeText(payload.lastName),
      sanitizeText(payload.profession),
      sanitizeText(payload.category),
      '',
      location.city,
      location.district,
      verificationCode,
    ],
  );
  return { userId, verificationCode };
}

async function updateProvider(db, provider, body) {
  const updates = { ...provider };
  if (body.firstName && sanitizeText(body.firstName) !== provider.first_name) {
    const err = new Error('Ad bilgisi kayıt sonrası değiştirilemez.');
    err.status = 400;
    throw err;
  }
  if (body.lastName && sanitizeText(body.lastName) !== provider.last_name) {
    const err = new Error('Soyad bilgisi kayıt sonrası değiştirilemez.');
    err.status = 400;
    throw err;
  }
  if (body.profession !== undefined) updates.profession = sanitizeText(body.profession);
  if (body.category !== undefined) updates.category = sanitizeText(body.category);
  if (body.about !== undefined) updates.about = sanitizeText(body.about);
  if (body.shopName !== undefined) updates.shop_name = sanitizeText(body.shopName);
  if (body.shopAddress !== undefined) updates.shop_address = sanitizeText(body.shopAddress);

  if (body.city || body.district) {
    const location = normalizeLocation(body.city || provider.city, body.district || provider.district);
    updates.city = location.city;
    updates.district = location.district;
  }

  if (body.contact) {
    updates.phone = sanitizeText(body.contact.phone);
    updates.contact_email = sanitizeText(body.contact.email || provider.email);
    updates.website = sanitizeText(body.contact.website);
  }

  const providerDir = path.join(PROVIDER_MEDIA_ROOT, provider.id);
  if (body.avatar !== undefined) {
    if (!body.avatar) {
      await removeFile(provider.avatar);
      updates.avatar = '';
    } else {
      const avatar = await saveMedia(body.avatar, path.join(providerDir, 'avatar'));
      await removeFile(provider.avatar);
      updates.avatar = avatar;
    }
  }

  if (body.banner !== undefined) {
    if (!body.banner) {
      await removeFile(provider.banner);
      updates.banner = '';
    } else {
      const banner = await saveMedia(body.banner, path.join(providerDir, 'banner'));
      await removeFile(provider.banner);
      updates.banner = banner;
    }
  }

  if (body.gallery) {
    const items = Array.isArray(body.gallery) ? body.gallery : [];
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
    `UPDATE users SET first_name=?, last_name=?, profession=?, category=?, about=?, city=?, district=?, phone=?, contact_email=?, website=?, avatar=?, banner=?, gallery=?, shop_name=?, shop_address=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
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
      updates.shop_name,
      updates.shop_address,
      provider.id,
    ],
  );

  return get(db, 'SELECT * FROM users WHERE id = ?', [provider.id]);
}

async function updateCustomer(db, user, body) {
  const updates = { ...user };
  if (body.profile) {
    if (body.profile.firstName && sanitizeText(body.profile.firstName) !== user.first_name) {
      const err = new Error('Ad bilgisi kayıt sonrası değiştirilemez.');
      err.status = 400;
      throw err;
    }
    if (body.profile.lastName && sanitizeText(body.profile.lastName) !== user.last_name) {
      const err = new Error('Soyad bilgisi kayıt sonrası değiştirilemez.');
      err.status = 400;
      throw err;
    }
    updates.about = sanitizeText(body.profile.about);
  }
  if (body.city || body.district) {
    const location = normalizeLocation(body.city || user.city, body.district || user.district);
    updates.city = location.city;
    updates.district = location.district;
  }
  if (body.email && validateEmail(body.email)) {
    updates.email = sanitizeText(body.email.toLowerCase());
  }
  if (body.phone) {
    updates.phone = sanitizeText(body.phone);
  }

  const customerDir = path.join(CUSTOMER_MEDIA_ROOT, user.id, 'avatar');
  if (body.avatar !== undefined) {
    if (!body.avatar) {
      await removeFile(user.avatar);
      updates.avatar = '';
    } else {
      const avatar = await saveMedia(body.avatar, customerDir);
      await removeFile(user.avatar);
      updates.avatar = avatar;
    }
  }

  await run(
    db,
    'UPDATE users SET first_name=?, last_name=?, about=?, city=?, district=?, email=?, phone=?, avatar=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [updates.first_name, updates.last_name, updates.about, updates.city, updates.district, updates.email, updates.phone, updates.avatar, user.id],
  );

  return get(db, 'SELECT * FROM users WHERE id = ?', [user.id]);
}

module.exports = {
  buildUserResponse,
  createUser,
  updateProvider,
  updateCustomer,
  sanitizeText,
  validateEmail,
  validatePasswordComplexity,
  hashPassword,
  comparePassword,
};
