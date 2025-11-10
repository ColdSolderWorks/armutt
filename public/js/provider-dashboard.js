import {
  ensureRole,
  attachLogout,
  apiRequest,
  renderAlert,
  updateSessionProfile,
  filesToDataUrls,
  fileListToArray,
  readFileAsDataUrl,
  formatDate,
  createStatusPill,
} from './common.js';
import { initialsFromName, initializeMediaLightbox } from './ui.js';

const session = ensureRole('usta');
if (!session) {
  throw new Error('Yetkisiz erişim');
}

initializeMediaLightbox();

const feedback = document.getElementById('provider-feedback');
const summaryBadge = document.getElementById('provider-summary');
const profileForm = document.getElementById('provider-profile-form');
const contactForm = document.getElementById('provider-contact-form');
const mediaForm = document.getElementById('provider-media-form');
const mediaPreview = document.getElementById('provider-media-preview');
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

attachLogout(document.getElementById('logout'));

document.title = `Usta Paneli | ${session.profile?.firstName || 'TrabzonİşBul'}`;

let providerData = null;

function patchLocalSessionProfile(patch) {
  session.profile = {
    ...(session.profile || {}),
    ...patch,
  };
}

function renderHero() {
  if (!providerData) return;
  if (heroName) {
    heroName.textContent = providerData.fullName || 'Usta Paneli';
  }
  if (heroProfession) {
    heroProfession.textContent =
      providerData.profession || providerData.category || 'Uzmanlık bilgilerinizi güncelleyin.';
  }
  if (heroMeta) {
    const metaParts = [providerData.city, providerData.contact?.phone, providerData.contact?.email].filter(Boolean);
    heroMeta.innerHTML = metaParts
      .map((part) => `<span>${part}</span>`)
      .join('<span class="dot"></span>');
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
    if (providerData.city) {
      badgeParts.push(providerData.city);
    }
    summaryBadge.textContent = badgeParts.join(' · ') || 'Profilinizi tamamlayın';
  }
  renderHero();
}

function populateProfileForm() {
  if (!providerData) return;
  const profile = providerData;
  profileForm.querySelector('#prov-firstName').value = profile.firstName || '';
  profileForm.querySelector('#prov-lastName').value = profile.lastName || '';
  profileForm.querySelector('#prov-profession').value = profile.profession || '';
  profileForm.querySelector('#prov-category').value = profile.category || '';
  profileForm.querySelector('#prov-city').value = profile.city || '';
  profileForm.querySelector('#prov-about').value = profile.about || '';
}

function populateContactForm() {
  if (!providerData) return;
  const contact = providerData.contact || {};
  contactForm.querySelector('#prov-phone').value = contact.phone || '';
  contactForm.querySelector('#prov-email').value = contact.email || session.email || '';
  contactForm.querySelector('#prov-website').value = contact.website || '';
}

function renderMedia() {
  if (!mediaPreview) return;
  mediaPreview.innerHTML = '';
  if (!providerData) return;

  const { avatar, banner, gallery = [] } = providerData;

  if (avatar) {
    const avatarEl = document.createElement('div');
    avatarEl.className = 'list-item';
    avatarEl.innerHTML = `
      <strong>Profil Fotoğrafı</strong>
      <div class="media-preview"><img src="${avatar}" alt="Profil" data-lightbox="provider-media" data-lightbox-src="${avatar}" data-lightbox-alt="Profil fotoğrafı" /></div>
      <div class="gallery-actions">
        <button class="button secondary" type="button" data-remove="avatar">Kaldır</button>
      </div>
    `;
    mediaPreview.appendChild(avatarEl);
  }

  if (banner) {
    const bannerEl = document.createElement('div');
    bannerEl.className = 'list-item';
    bannerEl.innerHTML = `
      <strong>Banner</strong>
      <div class="media-preview"><img src="${banner}" alt="Banner" data-lightbox="provider-media" data-lightbox-src="${banner}" data-lightbox-alt="Kapak fotoğrafı" /></div>
      <div class="gallery-actions">
        <button class="button secondary" type="button" data-remove="banner">Kaldır</button>
      </div>
    `;
    mediaPreview.appendChild(bannerEl);
  }

  if (gallery.length) {
    const galleryEl = document.createElement('div');
    galleryEl.className = 'list-item';
    galleryEl.innerHTML = '<strong>Galeri</strong>';
    const grid = document.createElement('div');
    grid.className = 'media-preview';
    gallery.forEach((image, index) => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <img src="${image}" alt="Galeri görseli ${index + 1}" data-lightbox="provider-media" data-lightbox-src="${image}" data-lightbox-alt="Galeri görseli ${index + 1}" />
        <div class="gallery-actions">
          <button class="button secondary" type="button" data-remove="gallery" data-index="${index}">Sil</button>
        </div>
      `;
      grid.appendChild(wrapper);
    });
    galleryEl.appendChild(grid);
    mediaPreview.appendChild(galleryEl);
  }

  if (!avatar && !banner && gallery.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Henüz yüklenmiş görsel bulunmuyor.';
    mediaPreview.appendChild(empty);
  }
}

async function loadProvider() {
  try {
    providerData = await apiRequest(`/api/providers/${session.id}`);
    renderSummary();
    populateProfileForm();
    populateContactForm();
    renderMedia();
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
}

profileForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(profileForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    const updated = await apiRequest(`/api/providers/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const profilePatch = {
      firstName: updated.firstName,
      lastName: updated.lastName,
      profession: updated.profession,
      category: updated.category,
      city: updated.city,
      about: updated.about,
    };
    updateSessionProfile(profilePatch);
    patchLocalSessionProfile(profilePatch);
    renderAlert(feedback, 'success', 'Profil bilgileri güncellendi.');
    await loadProvider();
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
});

contactForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(contactForm);
  const payload = {
    contact: {
      phone: formData.get('phone') || '',
      email: formData.get('email') || session.email || '',
      website: formData.get('website') || '',
    },
  };

  try {
    const updated = await apiRequest(`/api/providers/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    updateSessionProfile({ contact: updated.contact });
    patchLocalSessionProfile({ contact: updated.contact });
    renderAlert(feedback, 'success', 'İletişim bilgileri kaydedildi.');
    await loadProvider();
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
});

mediaForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const avatarFile = mediaForm.querySelector('#prov-avatar').files[0];
  const bannerFile = mediaForm.querySelector('#prov-banner').files[0];
  const galleryFiles = fileListToArray(mediaForm.querySelector('#prov-gallery').files);

  const updates = {};

  try {
    if (avatarFile) {
      updates.avatar = await readFileAsDataUrl(avatarFile);
    }
    if (bannerFile) {
      updates.banner = await readFileAsDataUrl(bannerFile);
    }
    if (galleryFiles.length) {
      const galleryImages = await filesToDataUrls(galleryFiles);
      updates.gallery = [...(providerData?.gallery || []), ...galleryImages];
    }

    if (Object.keys(updates).length === 0) {
      renderAlert(feedback, 'error', 'Güncellenecek medya seçilmedi.');
      return;
    }

    const updated = await apiRequest(`/api/providers/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const mediaPatch = {
      avatar: updated.avatar,
      banner: updated.banner,
      gallery: updated.gallery,
    };
    updateSessionProfile(mediaPatch);
    patchLocalSessionProfile(mediaPatch);
    renderAlert(feedback, 'success', 'Medya içerikleri güncellendi.');
    mediaForm.reset();
    await loadProvider();
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
});

mediaPreview?.addEventListener('click', async (event) => {
  const target = event.target.closest('button[data-remove]');
  if (!target) return;

  const type = target.getAttribute('data-remove');
  const index = target.getAttribute('data-index');

  const payload = {};
  if (type === 'avatar') {
    payload.avatar = '';
  } else if (type === 'banner') {
    payload.banner = '';
  } else if (type === 'gallery') {
    const gallery = [...(providerData?.gallery || [])];
    if (index !== null) {
      gallery.splice(Number(index), 1);
    }
    payload.gallery = gallery;
  }

  try {
    const updated = await apiRequest(`/api/providers/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const removalPatch = {
      avatar: updated.avatar,
      banner: updated.banner,
      gallery: updated.gallery,
    };
    updateSessionProfile(removalPatch);
    patchLocalSessionProfile(removalPatch);
    renderAlert(feedback, 'success', 'Görsel kaldırıldı.');
    await loadProvider();
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
});

async function fetchAllRequests() {
  try {
    const requests = await apiRequest('/api/requests');
    renderProviderRequests(requests);
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
}

async function fetchProviderOffers() {
  try {
    const requests = await apiRequest(`/api/requests/provider/${session.id}`);
    renderProviderOffers(requests);
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
