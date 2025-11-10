const STORAGE_KEY = 'trabzonisbul-session';

export function getSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('Oturum okunamadı', error);
    return null;
  }
}

export function setSession(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function redirectAuthenticated() {
  const session = getSession();
  if (!session) {
    return;
  }
  if (session.role === 'usta') {
    window.location.replace('/provider-dashboard.html');
  } else if (session.role === 'musteri') {
    window.location.replace('/customer-dashboard.html');
  }
}

export function ensureRole(requiredRole) {
  const session = getSession();
  if (!session) {
    window.location.replace('/login.html');
    return null;
  }
  if (requiredRole && session.role !== requiredRole) {
    window.location.replace(session.role === 'usta' ? '/provider-dashboard.html' : '/customer-dashboard.html');
    return null;
  }
  return session;
}

export function updateSessionProfile(patch) {
  const session = getSession();
  if (!session) {
    return;
  }
  const nextProfile = {
    ...(session.profile || {}),
    ...stripDataUrls(patch || {}),
  };
  const nextSession = { ...session, profile: nextProfile };
  setSession(nextSession);
}

function stripDataUrls(value) {
  if (typeof value === 'string') {
    return value.startsWith('data:') ? '' : value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => stripDataUrls(item))
      .filter((item) => item !== undefined && item !== null && item !== '');
  }
  if (value && typeof value === 'object') {
    const result = {};
    Object.entries(value).forEach(([key, entry]) => {
      const cleaned = stripDataUrls(entry);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    });
    return result;
  }
  return value;
}

export async function apiRequest(path, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  };
  const response = await fetch(path, config);
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    const message = payload && payload.message ? payload.message : 'İşlem sırasında bir hata oluştu.';
    throw new Error(message);
  }
  return payload;
}

export function renderAlert(container, type, message) {
  if (!container) return;
  if (!message) {
    container.innerHTML = '';
    return;
  }
  const className = type === 'error' ? 'alert alert-error' : 'alert alert-success';
  container.innerHTML = `<div class="${className}">${message}</div>`;
}

export function attachLogout(button, callback) {
  if (!button) return;
  button.addEventListener('click', () => {
    clearSession();
    if (typeof callback === 'function') {
      callback();
    }
    window.location.replace('/');
  });
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function createStatusPill(text) {
  return `<span class="status-pill">${text}</span>`;
}

export function fileListToArray(fileList) {
  if (!fileList || fileList.length === 0) return [];
  return Array.from(fileList);
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(file);
  });
}

export async function filesToDataUrls(files) {
  const results = [];
  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    const dataUrl = await readFileAsDataUrl(file);
    results.push(dataUrl);
  }
  return results;
}

window.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});
