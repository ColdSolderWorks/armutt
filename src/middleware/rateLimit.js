const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Giriş denemesi sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.' },
});

const mutateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  skip: (req) => req.method === 'GET',
  legacyHeaders: false,
  message: { message: 'Çok fazla işlem yapıldı. Lütfen daha sonra tekrar deneyin.' },
});

const requestsLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.method === 'GET',
  legacyHeaders: false,
  message: { message: 'Talep oluşturma sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.' },
});

module.exports = { authLimiter, mutateLimiter, requestsLimiter };
