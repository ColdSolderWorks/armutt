const jwt = require('jsonwebtoken');
const { get } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function authenticate(db, token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role === 'admin') {
      return { id: 'admin', role: 'admin', email: decoded.email };
    }
    const user = await get(db, 'SELECT * FROM users WHERE id = ?', [decoded.sub]);
    if (!user) return null;
    return { ...user, role: user.role };
  } catch (err) {
    return null;
  }
}

function authMiddleware(db, options = {}) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const [, token] = authHeader.split(' ');
    const user = await authenticate(db, token);
    if (!user) {
      return res.status(401).json({ message: 'Oturum doğrulanamadı.' });
    }
    if (options.role && user.role !== options.role) {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
    }
    req.user = user;
    return next();
  };
}

module.exports = {
  createToken,
  authMiddleware,
};
