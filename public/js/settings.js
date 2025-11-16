import {
  ensureRole,
  attachLogout,
  apiRequest,
  renderAlert,
  readFileAsDataUrl,
  filesToDataUrls,
  fileListToArray,
  setSession,
} from './common.js';
import { initialsFromName, initializeMediaLightbox } from './ui.js';
import { initializeLocationSelects, resolveSelectedLocation } from './locations.js';
import { initializeNotifications } from './notifications.js';

const session = ensureRole();
if (!session || session.role === 'admin') {
  window.location.replace('/login.html');
}

initializeMediaLightbox();
initializeNotifications();
attachLogout(document.getElementById('logout'));

typeof document !== 'undefined' && (document.title = `Ayarlar | ${session?.email || 'TrabzonİşBul'}`);

const feedback = document.getElementById('settings-feedback');
const titleEl = document.getElementById('settings-title');
const avatarDisplay = document.getElementById('settings-avatar-display');

const customerSection = document.getElementById('customer-settings');
const customerForm = document.getElementById('customer-settings-form');
const customerCity = document.getElementById('settings-cust-city');
const customerDistrict = document.getElementById('settings-cust-district');

const providerSection = document.getElementById('provider-settings');
const providerForm = document.getElementById('provider-settings-form');
const providerContactForm = document.getElementById('provider-contact-form');
const providerMediaForm = document.getElementById('provider-media-form');
const providerMediaPreview = document.getElementById('settings-media-preview');
const providerCity = document.getElementById('settings-prov-city');
const providerDistrict = document.getElementById('settings-prov-district');

const isProvider = session?.role === 'usta';
const isCustomer = session?.role === 'musteri';

let profileData = null;
let customerLocationsInitialized = false;
let providerLocationsInitialized = false;

function renderAvatar(name, avatar) {
  if (!avatarDisplay) return;
  avatarDisplay.textContent = '';
  avatarDisplay.style.backgroundImage = '';
  if (avatar) {
    avatarDisplay.style.backgroundImage = `url('${avatar}')`;
    avatarDisplay.dataset.hasImage = 'true';
  } else {
    avatarDisplay.textContent = initialsFromName(name || 'TrabzonİşBul');
    delete avatarDisplay.dataset.hasImage;
  }
}

function toggleSections() {
  if (titleEl) {
    titleEl.textContent = isProvider ? 'Usta Ayarları' : 'Müşteri Ayarları';
  }
  if (customerSection) {
    customerSection.hidden = !isCustomer;
  }
  if (providerSection) {
    providerSection.hidden = !isProvider;
  }
}

toggleSections();

function populateCustomerForm() {
  if (!profileData || !customerForm) return;
  const profile = profileData.profile || {};
  customerForm.querySelector('#settings-cust-firstName').value = profile.firstName || '';
  customerForm.querySelector('#settings-cust-lastName').value = profile.lastName || '';
  customerForm.querySelector('#settings-cust-email').value = profile.email || profileData.email || '';
  customerForm.querySelector('#settings-cust-phone').value = profile.phone || '';
  if (!customerLocationsInitialized) {
    initializeLocationSelects(customerCity, customerDistrict, { city: profile.city, district: profile.district });
    customerLocationsInitialized = true;
  } else {
    customerCity.value = profile.city || '';
    customerCity.dispatchEvent(new Event('change'));
    customerDistrict.value = profile.district || '';
  }
}

function populateProviderForms() {
  if (!profileData || !providerForm) return;
  providerForm.querySelector('#settings-prov-firstName').value = profileData.firstName || '';
  providerForm.querySelector('#settings-prov-lastName').value = profileData.lastName || '';
  providerForm.querySelector('#settings-prov-profession').value = profileData.profession || '';
  providerForm.querySelector('#settings-prov-category').value = profileData.category || '';
  providerForm.querySelector('#settings-prov-about').value = profileData.about || '';
  providerForm.querySelector('#settings-prov-shopName').value = profileData.shopName || '';
  providerForm.querySelector('#settings-prov-shopAddress').value = profileData.shopAddress || '';
  if (!providerLocationsInitialized) {
    initializeLocationSelects(providerCity, providerDistrict, {
      city: profileData.city,
      district: profileData.district,
    });
    providerLocationsInitialized = true;
  } else {
    providerCity.value = profileData.city || '';
    providerCity.dispatchEvent(new Event('change'));
    providerDistrict.value = profileData.district || '';
  }

  if (providerContactForm) {
    const contact = profileData.contact || {};
    providerContactForm.querySelector('#settings-prov-phone').value = contact.phone || '';
    providerContactForm.querySelector('#settings-prov-email').value = contact.email || profileData.email || '';
    providerContactForm.querySelector('#settings-prov-website').value = contact.website || '';
  }

  renderMediaPreview();
}

async function loadProfile() {
  try {
    if (isProvider) {
      profileData = await apiRequest(`/api/providers/${session.id}`);
    } else {
      profileData = await apiRequest(`/api/customers/${session.id}`);
    }
    renderAvatar(`${profileData.firstName || ''} ${profileData.lastName || ''}`, profileData.avatar);
    if (isCustomer) populateCustomerForm();
    if (isProvider) populateProviderForms();
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
}

function getCustomerPayload() {
  const formData = new FormData(customerForm);
  const payload = {
    city: customerCity?.value,
    district: customerDistrict?.value,
    email: formData.get('email'),
    phone: formData.get('phone'),
  };
  return payload;
}

customerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = getCustomerPayload();
  const avatarFile = customerForm.querySelector('#settings-cust-avatar').files[0];
  if (avatarFile) {
    try {
      payload.avatar = await readFileAsDataUrl(avatarFile);
    } catch (error) {
      renderAlert(feedback, 'error', error.message);
      return;
    }
  }
  try {
    const updated = await apiRequest(`/api/customers/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    setSession({ ...session, ...updated, token: session.token });
    renderAlert(feedback, 'success', 'Profiliniz güncellendi.');
    await loadProfile();
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
});

providerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(providerForm);
  const payload = {
    profession: formData.get('profession'),
    category: formData.get('category'),
    about: formData.get('about'),
    shopName: formData.get('shopName'),
    shopAddress: formData.get('shopAddress'),
    ...resolveSelectedLocation(providerCity, providerDistrict),
  };
  try {
    const updated = await apiRequest(`/api/providers/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    setSession({ ...session, ...updated, token: session.token });
    renderAlert(feedback, 'success', 'Profil bilgileri güncellendi.');
    await loadProfile();
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
});

providerContactForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(providerContactForm);
  const payload = {
    contact: {
      phone: formData.get('phone') || '',
      email: formData.get('email') || session.email || '',
      website: formData.get('website') || '',
    },
  };
  try {
    await apiRequest(`/api/providers/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    renderAlert(feedback, 'success', 'İletişim bilgileri kaydedildi.');
    await loadProfile();
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
});

function renderMediaPreview() {
  if (!providerMediaPreview || !profileData) return;
  providerMediaPreview.innerHTML = '';
  const { avatar, banner, gallery = [] } = profileData;

  const items = [];
  if (avatar) {
    items.push({ type: 'avatar', label: 'Profil Fotoğrafı', src: avatar });
  }
  if (banner) {
    items.push({ type: 'banner', label: 'Kapak Fotoğrafı', src: banner });
  }
  gallery.forEach((src, index) => {
    items.push({ type: 'gallery', label: `Galeri ${index + 1}`, src, index });
  });

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Henüz yüklenmiş görsel bulunmuyor.';
    providerMediaPreview.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'list-item';
    wrapper.innerHTML = `
      <div class="media-preview"><img src="${item.src}" alt="${item.label}" data-lightbox="settings-media" data-lightbox-src="${item.src}" data-lightbox-alt="${item.label}" /></div>
      <div class="gallery-actions"><button class="button secondary" type="button" data-remove="${item.type}" data-index="${item.index ?? ''}">Kaldır</button></div>
    `;
    providerMediaPreview.appendChild(wrapper);
  });
}

providerMediaPreview?.addEventListener('click', async (event) => {
  const target = event.target.closest('button[data-remove]');
  if (!target) return;
  const type = target.getAttribute('data-remove');
  const index = target.getAttribute('data-index');
  const payload = {};
  if (type === 'avatar') payload.avatar = '';
  if (type === 'banner') payload.banner = '';
  if (type === 'gallery') {
    const nextGallery = [...(profileData?.gallery || [])];
    if (index) {
      nextGallery.splice(Number(index), 1);
    }
    payload.gallery = nextGallery;
  }
  try {
    await apiRequest(`/api/providers/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    renderAlert(feedback, 'success', 'Medya güncellendi.');
    await loadProfile();
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
});

providerMediaForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const avatarFile = providerMediaForm.querySelector('#settings-prov-avatar').files[0];
  const bannerFile = providerMediaForm.querySelector('#settings-prov-banner').files[0];
  const galleryFiles = fileListToArray(providerMediaForm.querySelector('#settings-prov-gallery').files);
  const updates = {};
  try {
    if (avatarFile) updates.avatar = await readFileAsDataUrl(avatarFile);
    if (bannerFile) updates.banner = await readFileAsDataUrl(bannerFile);
    if (galleryFiles.length) {
      const galleryImages = await filesToDataUrls(galleryFiles);
      updates.gallery = [...(profileData?.gallery || []), ...galleryImages];
    }
    if (!Object.keys(updates).length) {
      renderAlert(feedback, 'error', 'Yüklenecek medya seçilmedi.');
      return;
    }
    await apiRequest(`/api/providers/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    renderAlert(feedback, 'success', 'Medya güncellendi.');
    providerMediaForm.reset();
    await loadProfile();
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
});

loadProfile();
