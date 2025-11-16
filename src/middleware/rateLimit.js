const rateLimit = require('express-rate-limit');

const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  legacyHeaders: false,
  message: { message: 'Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.' },
});

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Giriş denemesi sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.' },
});

const mutateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  legacyHeaders: false,
  message: { message: 'Çok fazla işlem yapıldı. Lütfen daha sonra tekrar deneyin.' },
});

const requestsLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.user?.id || req.ip,
  legacyHeaders: false,
  message: { message: 'Talep oluşturma sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.' },
});

module.exports = { standardLimiter, authLimiter, mutateLimiter, requestsLimiter };
