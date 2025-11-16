import {
  ensureRole,
  attachLogout,
  apiRequest,
  renderAlert,
  formatDate,
  createStatusPill,
} from './common.js';
import { initialsFromName } from './ui.js';
import { initializeNotifications } from './notifications.js';

const session = ensureRole('usta');
if (!session) {
  throw new Error('Yetkisiz erişim');
}

const feedback = document.getElementById('provider-feedback');
const summaryBadge = document.getElementById('provider-summary');
const requestsContainer = document.getElementById('provider-requests');
const offersContainer = document.getElementById('provider-offers');
const refreshRequestsButton = document.getElementById('refresh-requests');
const refreshOffersButton = document.getElementById('refresh-offers');
const heroName = document.getElementById('provider-name-display');
const heroProfession = document.getElementById('provider-profession-display');
const heroMeta = document.getElementById('provider-meta-display');
const heroAvatar = document.getElementById('provider-avatar-display');
const heroBanner = document.getElementById('provider-banner-display');
const statsList = document.getElementById('provider-stats');
const heroCity = document.getElementById('provider-city-display');

attachLogout(document.getElementById('logout'));
initializeNotifications();

document.title = `Usta Paneli | ${session.profile?.firstName || 'TrabzonİşBul'}`;

let providerData = null;

function renderHero() {
  if (!providerData) return;
  if (heroName) {
    heroName.textContent = providerData.fullName || 'Usta Paneli';
  }
  if (heroProfession) {
    heroProfession.textContent =
      providerData.profession || providerData.category || 'Uzmanlık bilgilerinizi güncelleyin.';
  }
  if (heroCity) {
    const locationParts = [providerData.city, providerData.district].filter(Boolean);
    heroCity.textContent = locationParts.length
      ? locationParts.join(' • ')
      : 'Konumunuzu güncelleyin.';
  }
  if (heroMeta) {
    const metaParts = [providerData.contact?.phone, providerData.contact?.email].filter(Boolean);
    heroMeta.innerHTML = metaParts.map((part) => `<span>${part}</span>`).join('<span class="dot"></span>');
  }
  if (heroAvatar) {
    heroAvatar.textContent = '';
    heroAvatar.style.backgroundImage = '';
    if (providerData.avatar) {
      heroAvatar.style.backgroundImage = `url('${providerData.avatar}')`;
      heroAvatar.dataset.hasImage = 'true';
    } else {
      heroAvatar.textContent = initialsFromName(providerData.fullName || 'TrabzonİşBul');
      delete heroAvatar.dataset.hasImage;
    }
  }
  if (heroBanner) {
    heroBanner.style.removeProperty('--banner-image');
    if (providerData.banner) {
      heroBanner.style.setProperty('--banner-image', `url('${providerData.banner}')`);
      heroBanner.dataset.hasImage = 'true';
    } else {
      delete heroBanner.dataset.hasImage;
    }
  }
  if (statsList) {
    statsList.innerHTML = '';
    const stats = [
      { label: 'Tamamlanan iş', value: providerData.completedJobs || 0 },
      {
        label: 'Puan ortalaması',
        value:
          providerData.rating && providerData.rating > 0
            ? `${providerData.rating} (${providerData.reviewCount})`
            : 'Değerlendirme bekleniyor',
      },
      { label: 'Kategori', value: providerData.category || 'Belirtilmedi' },
    ];
    stats.forEach((stat) => {
      const item = document.createElement('li');
      item.innerHTML = `<strong>${stat.value}</strong><span>${stat.label}</span>`;
      statsList.appendChild(item);
    });
  }
}

function renderSummary() {
  if (!providerData) return;
  if (summaryBadge) {
    const badgeParts = [];
    if (providerData.rating && providerData.rating > 0) {
      badgeParts.push(`⭐ ${providerData.rating} (${providerData.reviewCount})`);
    }
    if (providerData.category) {
      badgeParts.push(providerData.category);
    }
    const locationText = [providerData.city, providerData.district].filter(Boolean).join(' / ');
    if (locationText) {
      badgeParts.push(locationText);
    }
    summaryBadge.textContent = badgeParts.join(' · ') || 'Profilinizi tamamlayın';
  }
  renderHero();
}

async function loadProvider() {
  try {
    providerData = await apiRequest(`/api/providers/${session.id}`);
    renderSummary();
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
}

function renderProviderRequests(requests = []) {
  if (!requestsContainer) return;
  requestsContainer.innerHTML = '';

  const openRequests = requests.filter((request) => request.status !== 'Teklif Kabul Edildi');

  if (!openRequests.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Şu anda teklif verebileceğiniz yeni bir talep bulunmuyor.';
    requestsContainer.appendChild(empty);
    return;
  }

  openRequests.forEach((request) => {
    const offer = (request.offers || []).find((item) => item.providerId === session.id);
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="section-header">
        <div>
          <strong>${request.category}</strong>
          <div>${createStatusPill(request.status)}</div>
        </div>
        <small>${formatDate(request.createdAt)}</small>
      </div>
      <p>${request.description}</p>
    `;

    if (offer) {
      const info = document.createElement('div');
      info.innerHTML = `<p><strong>Gönderdiğiniz teklif:</strong> ${offer.price} ₺ · ${offer.message}</p>`;
      item.appendChild(info);
    } else {
      const form = document.createElement('form');
      form.className = 'section';
      form.innerHTML = `
        <div class="form-grid">
          <div>
            <label>Teklif Mesajı</label>
            <textarea name="message" required placeholder="Hizmeti nasıl sunacağınızı anlatın"></textarea>
          </div>
          <div>
            <label>Fiyat (₺)</label>
            <input name="price" type="number" min="0" step="1" required />
          </div>
        </div>
        <button class="button button-primary" type="submit">Teklif Gönder</button>
      `;
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        try {
          await apiRequest(`/api/requests/${request.id}/offers`, {
            method: 'POST',
            body: JSON.stringify({
              providerId: session.id,
              message: data.get('message'),
              price: data.get('price'),
            }),
          });
          renderAlert(feedback, 'success', 'Teklif gönderildi.');
          await fetchAllRequests();
          await fetchProviderOffers();
        } catch (error) {
          renderAlert(feedback, 'error', error.message);
        }
      });
      item.appendChild(form);
    }

    requestsContainer.appendChild(item);
  });
}

function renderProviderOffers(requests = []) {
  if (!offersContainer) return;
  offersContainer.innerHTML = '';

  if (!requests.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Henüz teklif gönderilmedi.';
    offersContainer.appendChild(empty);
    return;
  }

  requests.forEach((request) => {
    const offer = (request.offers || []).find((item) => item.providerId === session.id);
    if (!offer) return;

    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="section-header">
        <strong>${request.category}</strong>
        <span>${createStatusPill(offer.status)}</span>
      </div>
      <p>${request.description}</p>
      <p><strong>Teklifiniz:</strong> ${offer.price} ₺ · ${offer.message}</p>
      <small>Gönderim: ${formatDate(offer.createdAt)}</small>
    `;

    if (request.status === 'Teklif Kabul Edildi' && request.acceptedOfferId === offer.id) {
      item.innerHTML += '<p class="badge">Teklifiniz müşteri tarafından kabul edildi.</p>';
    }

    offersContainer.appendChild(item);
  });
}

refreshRequestsButton?.addEventListener('click', fetchAllRequests);
refreshOffersButton?.addEventListener('click', fetchProviderOffers);

loadProvider();
fetchAllRequests();
fetchProviderOffers();
