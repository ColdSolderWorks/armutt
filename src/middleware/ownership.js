function requireOwnership(req, res, next) {
  if (req.user?.role === 'admin') return next();
  const targetId = req.params.id || req.params.userId || req.body.userId;
  if (targetId && req.user?.id !== targetId) {
    return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
  }
  return next();
}

module.exports = { requireOwnership };
