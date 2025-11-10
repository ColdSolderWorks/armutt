const categoryList = document.getElementById('category-list');
const providerList = document.getElementById('provider-list');
const requestList = document.getElementById('request-list');
const categoryFilter = document.getElementById('category-filter');
const requestForm = document.getElementById('request-form');
const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const requestFeedback = document.getElementById('request-feedback');
const registerFeedback = document.getElementById('register-feedback');
const loginFeedback = document.getElementById('login-feedback');
const currentUserEl = document.getElementById('current-user');

let currentUser = null;

document.getElementById('year').textContent = new Date().getFullYear();

async function fetchJSON(url, options) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Bir hata oluştu');
    }
    return data;
  } catch (error) {
    throw new Error(error.message || 'Bağlantı hatası');
  }
}

function renderCategories(categories) {
  categoryList.innerHTML = '';
  categoryFilter.innerHTML = '<option value="">Tüm Kategoriler</option>';

  categories.forEach((category) => {
    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `
      <h3>${category.name}</h3>
      <span>${category.providerCount} profesyonel</span>
    `;
    card.addEventListener('click', () => {
      categoryFilter.value = category.name;
      loadProviders(category.name);
    });
    categoryList.appendChild(card);

    const option = document.createElement('option');
    option.value = category.name;
    option.textContent = category.name;
    categoryFilter.appendChild(option);
  });
}

function renderProviders(providers) {
  providerList.innerHTML = '';
  if (!providers.length) {
    providerList.innerHTML = '<p>Bu kategoride profesyonel bulunamadı.</p>';
    return;
  }

  providers.forEach((provider) => {
    const card = document.createElement('div');
    card.className = 'provider-card';
    card.innerHTML = `
      <h3>${provider.name}</h3>
      <p><strong>Kategori:</strong> ${provider.category}</p>
      <p><strong>Bölge:</strong> ${provider.location}</p>
      <p><strong>Puan:</strong> ${provider.rating} ⭐</p>
      <p><strong>Tamamlanan İş:</strong> ${provider.completedJobs}</p>
      <p>${provider.about}</p>
    `;
    providerList.appendChild(card);
  });
}

function renderRequests(requests) {
  requestList.innerHTML = '';
  if (!requests.length) {
    requestList.innerHTML = '<p>Henüz talep bulunmuyor.</p>';
    return;
  }

  requests.forEach((request) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    const date = new Date(request.createdAt).toLocaleDateString('tr-TR');
    item.innerHTML = `
      <h3>${request.category}</h3>
      <span>${date} • ${request.status}</span>
      <p>${request.description}</p>
    `;
    requestList.appendChild(item);
  });
}

async function loadCategories() {
  try {
    const categories = await fetchJSON('/api/categories');
    renderCategories(categories);
  } catch (error) {
    categoryList.innerHTML = `<p>${error.message}</p>`;
  }
}

async function loadProviders(category = '') {
  try {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    const providers = await fetchJSON(`/api/providers${query}`);
    renderProviders(providers);
  } catch (error) {
    providerList.innerHTML = `<p>${error.message}</p>`;
  }
}

async function loadRequests() {
  try {
    const requests = await fetchJSON('/api/requests');
    renderRequests(requests);
  } catch (error) {
    requestList.innerHTML = `<p>${error.message}</p>`;
  }
}

categoryFilter.addEventListener('change', (event) => {
  loadProviders(event.target.value);
});

requestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(requestForm);
  const payload = Object.fromEntries(formData.entries());

  requestFeedback.textContent = '';
  requestFeedback.className = 'feedback';

  try {
    await fetchJSON('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    requestFeedback.textContent = 'Talebiniz oluşturuldu.';
    requestFeedback.classList.add('success');
    requestForm.reset();
    loadRequests();
  } catch (error) {
    requestFeedback.textContent = error.message;
    requestFeedback.classList.add('error');
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const payload = Object.fromEntries(formData.entries());

  registerFeedback.textContent = '';
  registerFeedback.className = 'feedback';

  try {
    const data = await fetchJSON('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    currentUser = data.user;
    registerFeedback.textContent = 'Kayıt işlemi tamamlandı. Kullanıcı ID’niz formun altında görüntülenir.';
    registerFeedback.classList.add('success');
    showCurrentUser();
    registerForm.reset();
  } catch (error) {
    registerFeedback.textContent = error.message;
    registerFeedback.classList.add('error');
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = Object.fromEntries(formData.entries());

  loginFeedback.textContent = '';
  loginFeedback.className = 'feedback';

  try {
    const data = await fetchJSON('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    currentUser = data.user;
    loginFeedback.textContent = 'Giriş başarılı.';
    loginFeedback.classList.add('success');
    showCurrentUser();
    loginForm.reset();
  } catch (error) {
    loginFeedback.textContent = error.message;
    loginFeedback.classList.add('error');
  }
});

function showCurrentUser() {
  if (!currentUser) {
    currentUserEl.textContent = '';
    return;
  }
  currentUserEl.innerHTML = `
    <strong>Aktif Kullanıcı:</strong><br />
    ${currentUser.name} (${currentUser.email})<br />
    Kullanıcı ID: <code>${currentUser.id}</code>
  `;
}

loadCategories();
loadProviders();
loadRequests();
