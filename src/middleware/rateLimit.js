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

module.exports = { standardLimiter, authLimiter };
