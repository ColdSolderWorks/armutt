import {
  ensureRole,
  attachLogout,
  apiRequest,
  renderAlert,
  formatDate,
  createStatusPill,
} from './common.js';

const session = ensureRole('admin');
if (!session) {
  throw new Error('Yetkisiz erişim');
}

document.title = 'Yönetim Paneli | TrabzonİşBul';

const feedback = document.getElementById('admin-feedback');
const statsContainer = document.getElementById('admin-stats');
const providersTable = document.getElementById('admin-providers');
const customersTable = document.getElementById('admin-customers');
const requestsContainer = document.getElementById('admin-requests');
const refreshButton = document.getElementById('refresh-summary');

attachLogout(document.getElementById('logout'));

let summary = null;

function renderStats(stats = {}) {
  if (!statsContainer) return;
  statsContainer.innerHTML = '';
  const items = [
    { label: 'Aktif Usta', value: stats.providerCount || 0 },
    { label: 'Aktif Müşteri', value: stats.customerCount || 0 },
    { label: 'Talep Sayısı', value: stats.requestCount || 0 },
  ];
  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `<strong>${item.value}</strong><span>${item.label}</span>`;
    statsContainer.appendChild(card);
  });
}

function renderProviders(providers = []) {
  if (!providersTable) return;
  providersTable.innerHTML = '';
  if (!providers.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="6">Kayıtlı usta bulunamadı.</td>';
    providersTable.appendChild(row);
    return;
  }
  providers.forEach((provider) => {
    const row = document.createElement('tr');
    const location = [provider.city, provider.district].filter(Boolean).join(' / ');
    const contact = [provider.contact?.phone, provider.contact?.email].filter(Boolean).join('<br />');
    row.innerHTML = `
      <td><a href="/provider-profile.html?id=${provider.id}" target="_blank" rel="noreferrer">${
        provider.fullName
      }</a></td>
      <td>${provider.profession || provider.category || 'Belirtilmedi'}</td>
      <td>${location || '-'}</td>
      <td>${contact || '-'}</td>
      <td>${provider.offerCount || 0}</td>
      <td><button class="button danger" type="button" data-remove-provider="${provider.id}">Kaldır</button></td>
    `;
    providersTable.appendChild(row);
  });
}

function renderCustomers(customers = []) {
  if (!customersTable) return;
  customersTable.innerHTML = '';
  if (!customers.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="5">Kayıtlı müşteri bulunamadı.</td>';
    customersTable.appendChild(row);
    return;
  }
  customers.forEach((customer) => {
    const profile = customer.profile || {};
    const name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || customer.email;
    const location = [profile.city, profile.district].filter(Boolean).join(' / ');
    const contact = [profile.email || customer.email, profile.phone].filter(Boolean).join('<br />');
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${name}</td>
      <td>${contact || '-'}</td>
      <td>${location || '-'}</td>
      <td>${customer.requestCount || 0}</td>
      <td><button class="button danger" type="button" data-remove-customer="${customer.id}">Kaldır</button></td>
    `;
    customersTable.appendChild(row);
  });
}

function renderOffers(offers = [], requestId) {
  if (!offers.length) {
    return '<p>Bu talep için teklif bulunmuyor.</p>';
  }
  return offers
    .map((offer) => {
      const provider = offer.provider || {};
      const providerLocation = [provider.city || offer.providerCity, provider.district || offer.providerDistrict]
        .filter(Boolean)
        .join(' • ');
      return `
        <div class="card nested">
          <header class="offer-header">
            <div>
              <strong>${provider.fullName || offer.providerName || 'Usta'}</strong>
              <span>${provider.profession || offer.providerProfession || ''}</span>
              ${providerLocation ? `<span class="offer-location">${providerLocation}</span>` : ''}
            </div>
            <div>${createStatusPill(offer.status)}</div>
          </header>
          <p><strong>Fiyat:</strong> ${offer.price} ₺</p>
          <p>${offer.message}</p>
          <small>${formatDate(offer.createdAt)}</small>
          <div class="action-row">
            <button class="button danger ghost" type="button" data-remove-offer="${offer.id}" data-request-id="${requestId}">Teklifi Sil</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderRequests(requests = []) {
  if (!requestsContainer) return;
  requestsContainer.innerHTML = '';
  if (!requests.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Sistemde kayıtlı talep bulunamadı.';
    requestsContainer.appendChild(empty);
    return;
  }

  requests.forEach((request) => {
    const card = document.createElement('article');
    card.className = 'card admin-request';
    const location = [request.city, request.district].filter(Boolean).join(' • ');
    card.innerHTML = `
      <header class="section-header">
        <div>
          <strong>${request.category}</strong>
          <div class="section-sub">${location || 'Konum belirtilmedi'}</div>
          <div>${createStatusPill(request.status)}</div>
        </div>
        <div class="action-row">
          <small>${formatDate(request.createdAt)}</small>
          <button class="button danger" type="button" data-remove-request="${request.id}">Talebi Sil</button>
        </div>
      </header>
      <p>${request.description}</p>
      <div class="offers-wrapper">${renderOffers(request.offers || [], request.id)}</div>
    `;
    requestsContainer.appendChild(card);
  });
}

function applySummary(nextSummary) {
  summary = nextSummary;
  renderStats(summary?.stats);
  renderProviders(summary?.providers);
  renderCustomers(summary?.customers);
  renderRequests(summary?.requests);
}

async function loadSummary() {
  try {
    renderAlert(feedback, null, '');
    const data = await apiRequest('/api/admin/summary');
    applySummary(data);
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
}

async function handleProviderRemoval(id, button) {
  if (!id) return;
  try {
    button.disabled = true;
    button.textContent = 'Kaldırılıyor...';
    const response = await apiRequest(`/api/admin/providers/${id}`, { method: 'DELETE' });
    applySummary(response.summary || summary);
    renderAlert(feedback, 'success', response.message || 'Usta kaldırıldı.');
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Kaldır';
  }
}

async function handleCustomerRemoval(id, button) {
  if (!id) return;
  try {
    button.disabled = true;
    button.textContent = 'Kaldırılıyor...';
    const response = await apiRequest(`/api/admin/customers/${id}`, { method: 'DELETE' });
    applySummary(response.summary || summary);
    renderAlert(feedback, 'success', response.message || 'Müşteri kaldırıldı.');
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Kaldır';
  }
}

async function handleRequestRemoval(id, button) {
  if (!id) return;
  try {
    button.disabled = true;
    button.textContent = 'Siliniyor...';
    const response = await apiRequest(`/api/admin/requests/${id}`, { method: 'DELETE' });
    applySummary(response.summary || summary);
    renderAlert(feedback, 'success', response.message || 'Talep silindi.');
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Talebi Sil';
  }
}

async function handleOfferRemoval(requestId, offerId, button) {
  if (!requestId || !offerId) return;
  try {
    button.disabled = true;
    button.textContent = 'Siliniyor...';
    const response = await apiRequest(`/api/admin/requests/${requestId}/offers/${offerId}`, {
      method: 'DELETE',
    });
    applySummary(response.summary || summary);
    renderAlert(feedback, 'success', response.message || 'Teklif silindi.');
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Teklifi Sil';
  }
}

providersTable?.addEventListener('click', (event) => {
  const target = event.target.closest('[data-remove-provider]');
  if (!target) return;
  const id = target.getAttribute('data-remove-provider');
  handleProviderRemoval(id, target);
});

customersTable?.addEventListener('click', (event) => {
  const target = event.target.closest('[data-remove-customer]');
  if (!target) return;
  const id = target.getAttribute('data-remove-customer');
  handleCustomerRemoval(id, target);
});

requestsContainer?.addEventListener('click', (event) => {
  const requestButton = event.target.closest('[data-remove-request]');
  if (requestButton) {
    const requestId = requestButton.getAttribute('data-remove-request');
    handleRequestRemoval(requestId, requestButton);
    return;
  }
  const offerButton = event.target.closest('[data-remove-offer]');
  if (offerButton) {
    const requestId = offerButton.getAttribute('data-request-id');
    const offerId = offerButton.getAttribute('data-remove-offer');
    handleOfferRemoval(requestId, offerId, offerButton);
  }
});

refreshButton?.addEventListener('click', () => {
  loadSummary();
});

loadSummary();
