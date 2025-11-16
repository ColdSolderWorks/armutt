const { WebSocketServer } = require('ws');
const { authenticate } = require('./middleware/auth');
const { logInfo, logError } = require('./logger');

function createWebSocketServer(server, db) {
  const connections = new Map();
  const wss = new WebSocketServer({ server, path: '/ws' });

  function attachConnection(userId, socket) {
    const existing = connections.get(userId) || new Set();
    existing.add(socket);
    connections.set(userId, existing);
  }

  function detachConnection(userId, socket) {
    const set = connections.get(userId);
    if (!set) return;
    set.delete(socket);
    if (!set.size) {
      connections.delete(userId);
    }
  }

  wss.on('connection', async (socket, req) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      const user = await authenticate(db, token);
      if (!user) {
        socket.close(4001, 'unauthorized');
        return;
      }
      socket.userId = user.id;
      attachConnection(user.id, socket);
      logInfo('WebSocket bağlantısı açıldı', { userId: user.id });

      socket.on('close', () => {
        detachConnection(user.id, socket);
      });
    } catch (error) {
      logError('WebSocket bağlantısı hatası', { message: error.message });
      socket.close(1011, 'error');
    }
  });

  function notify(userId, payload) {
    const sockets = connections.get(userId);
    if (!sockets || !sockets.size) return;
    const message = JSON.stringify(payload);
    sockets.forEach((socket) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(message);
      }
    });
  }

  function broadcast(userIds = [], payload) {
    userIds.forEach((id) => notify(id, payload));
  }

  return { broadcast };
}

module.exports = { createWebSocketServer };
