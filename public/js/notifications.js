import { apiRequest, getSession } from './common.js';

let ws;
let notificationState = [];
let rendered = false;

function renderIndicator(indicator, list) {
  if (!indicator) return;
  const unread = list.some((item) => !item.read);
  indicator.hidden = !unread;
}

function renderList(container, list) {
  if (!container) return;
  container.innerHTML = '';
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Henüz bildirim yok.';
    container.appendChild(empty);
    return;
  }

  list.forEach((item) => {
    const entry = document.createElement('button');
    entry.type = 'button';
    entry.className = `notification-item${item.read ? '' : ' unread'}`;
    entry.innerHTML = `
      <div>
        <p>${item.message || 'Yeni bildirim'}</p>
        <small>${new Date(item.createdAt).toLocaleString('tr-TR')}</small>
      </div>
    `;
    entry.dataset.id = item.id;
    container.appendChild(entry);
  });
}

function showToast(message) {
  if (!message) return;
  let tray = document.querySelector('.toast-tray');
  if (!tray) {
    tray = document.createElement('div');
    tray.className = 'toast-tray';
    document.body.appendChild(tray);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  tray.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('visible');
  }, 50);
  setTimeout(() => {
    toast.classList.remove('visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 4000);
}

async function markRead(id) {
  try {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'POST' });
    notificationState = notificationState.map((item) => (item.id === id ? { ...item, read: true } : item));
  } catch (error) {
    // sessizce geç
  }
}

function handleIncoming(data, indicator, listContainer) {
  const entry = {
    id: data.id,
    message: data.message,
    payload: data,
    createdAt: data.createdAt || new Date().toISOString(),
    read: false,
  };
  notificationState = [entry, ...notificationState].slice(0, 50);
  renderList(listContainer, notificationState);
  renderIndicator(indicator, notificationState);
  showToast(data.message);
}

async function fetchNotifications(indicator, listContainer) {
  try {
    notificationState = await apiRequest('/api/notifications');
    renderList(listContainer, notificationState);
    renderIndicator(indicator, notificationState);
  } catch (error) {
    // sessizce geç
  }
}

export function initializeNotifications() {
  if (rendered) return;
  const session = getSession();
  const toggle = document.getElementById('notification-toggle');
  const panel = document.getElementById('notification-panel');
  const indicator = document.getElementById('notification-indicator');
  const listContainer = document.getElementById('notification-list');
  if (!session || !toggle || !panel || !listContainer) return;

  rendered = true;

  fetchNotifications(indicator, listContainer);

  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('#notification-toggle') || event.target.closest('#notification-panel')) return;
    panel.hidden = true;
  });

  listContainer.addEventListener('click', async (event) => {
    const item = event.target.closest('.notification-item');
    if (!item) return;
    const id = item.dataset.id;
    item.classList.remove('unread');
    await markRead(id);
    renderIndicator(indicator, notificationState);
  });

  const wsUrl = `${window.location.origin.replace('http', 'ws')}/ws?token=${encodeURIComponent(session.token)}`;
  try {
    ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleIncoming(payload, indicator, listContainer);
      } catch (error) {
        // yut
      }
    };
    ws.onerror = () => {
      // sessiz
    };
  } catch (error) {
    // sessiz
  }
}
