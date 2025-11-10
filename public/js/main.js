const categoryList = document.getElementById('category-list');
const providerList = document.getElementById('provider-list');
const requestList = document.getElementById('request-list');
const categoryFilter = document.getElementById('category-filter');
const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const registerFeedback = document.getElementById('register-feedback');
const loginFeedback = document.getElementById('login-feedback');
const currentUserEl = document.getElementById('current-user');
const dashboardSection = document.getElementById('dashboard');
const dashboardIntro = document.getElementById('dashboard-intro');
const providerPanel = document.getElementById('provider-panel');
const customerPanel = document.getElementById('customer-panel');

const providerProfileForm = document.getElementById('provider-profile-form');
const providerProfileFeedback = document.getElementById('provider-profile-feedback');
const providerMediaForm = document.getElementById('provider-media-form');
const providerMediaFeedback = document.getElementById('provider-media-feedback');
const providerMediaPreview = document.getElementById('provider-media-preview');
const providerReviewsList = document.getElementById('provider-reviews');
const providerOpenRequests = document.getElementById('provider-open-requests');
const providerOffers = document.getElementById('provider-offers');

const customerProfileForm = document.getElementById('customer-profile-form');
const customerProfileFeedback = document.getElementById('customer-profile-feedback');
const customerAvatarInput = document.getElementById('customer-avatar');
const customerRequestForm = document.getElementById('customer-request-form');
const customerRequestFeedback = document.getElementById('customer-request-feedback');
const customerRequests = document.getElementById('customer-requests');

const providerAvatarInput = document.getElementById('provider-avatar');
const providerBannerInput = document.getElementById('provider-banner');
const providerGalleryInput = document.getElementById('provider-gallery');
const registerRoleSelect = document.getElementById('register-role');

let currentUser = null;
let providerDetails = null;
let customerDetails = null;

document.getElementById('year').textContent = new Date().getFullYear();
document.querySelectorAll('.feedback').forEach((element) => {
  element.dataset.baseClass = element.className;
});

function setFeedback(element, message, type = '') {
  if (!element) return;
  element.textContent = message;
  const base = element.dataset?.baseClass || 'feedback';
  element.className = base;
  if (type) {
    element.classList.add(type);
  }
}

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
      <h3>${provider.fullName}</h3>
      <p><strong>Meslek:</strong> ${provider.profession || 'Belirtilmedi'}</p>
      <p><strong>Kategori:</strong> ${provider.category}</p>
      <p><strong>Şehir:</strong> ${provider.city}</p>
      <p><strong>Puan:</strong> ${provider.rating} ⭐ (${provider.reviewCount})</p>
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
    const offerCount = Array.isArray(request.offers) ? request.offers.length : 0;
    item.innerHTML = `
      <h3>${request.category}</h3>
      <span>${date} • ${request.status}</span>
      <p>${request.description}</p>
      <p><strong>Teklif Sayısı:</strong> ${offerCount}</p>
    `;
    requestList.appendChild(item);
  });
}

function updateRoleFields() {
  const selectedRole = registerRoleSelect.value;
  document.querySelectorAll('.role-field').forEach((field) => {
    const { role } = field.dataset;
    field.classList.toggle('active', role === selectedRole);
  });
}

function showCurrentUser() {
  if (!currentUser) {
    currentUserEl.innerHTML = '';
    dashboardSection.classList.add('hidden');
    providerPanel.classList.add('hidden');
    customerPanel.classList.add('hidden');
    return;
  }

  const profile = currentUser.profile || {};
  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || currentUser.email;
  currentUserEl.innerHTML = `
    <strong>${fullName}</strong><br />
    Rol: ${currentUser.role === 'usta' ? 'Usta' : 'Müşteri'}<br />
    Kullanıcı ID: <code>${currentUser.id}</code>
  `;
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsDataURL(file);
  });
}

function fillProviderForms(details) {
  if (!providerProfileForm || !details) return;
  providerProfileForm.elements.firstName.value = details.firstName || '';
  providerProfileForm.elements.lastName.value = details.lastName || '';
  providerProfileForm.elements.profession.value = details.profession || '';
  providerProfileForm.elements.city.value = details.city || '';
  providerProfileForm.elements.about.value = details.about || '';
  providerProfileForm.elements.category.value = details.category || '';
  const contact = details.contact || {};
  providerProfileForm.elements.phone.value = contact.phone || '';
  providerProfileForm.elements.website.value = contact.website || '';
  providerProfileForm.elements.contactEmail.value = contact.email || '';

  providerMediaPreview.innerHTML = '';
  if (details.avatar) {
    const avatarImg = document.createElement('img');
    avatarImg.src = details.avatar;
    avatarImg.alt = 'Profil Fotoğrafı';
    providerMediaPreview.appendChild(avatarImg);
  }
  if (details.banner) {
    const bannerImg = document.createElement('img');
    bannerImg.src = details.banner;
    bannerImg.alt = 'Banner';
    providerMediaPreview.appendChild(bannerImg);
  }
  if (Array.isArray(details.gallery) && details.gallery.length) {
    details.gallery.forEach((photo, index) => {
      const jobImg = document.createElement('img');
      jobImg.src = photo;
      jobImg.alt = `Tamamlanan iş ${index + 1}`;
      providerMediaPreview.appendChild(jobImg);
    });
  }

  providerReviewsList.innerHTML = '';
  if (Array.isArray(details.reviews) && details.reviews.length) {
    details.reviews.forEach((review) => {
      const reviewItem = document.createElement('div');
      reviewItem.className = 'list-item';
      const date = new Date(review.createdAt).toLocaleDateString('tr-TR');
      reviewItem.innerHTML = `
        <h3>${review.customerName || 'Müşteri'}</h3>
        <span>${review.rating} ⭐ • ${date}</span>
        <p>${review.comment || 'Yorum bulunmuyor.'}</p>
      `;
      providerReviewsList.appendChild(reviewItem);
    });
  } else {
    providerReviewsList.innerHTML = '<p>Henüz yorum bulunmuyor.</p>';
  }
}

async function loadProviderOpenRequests() {
  if (!currentUser || currentUser.role !== 'usta') return;
  try {
    const requests = await fetchJSON('/api/requests');
    const openRequests = requests.filter((request) => {
      if (request.status !== 'Teklif Bekleniyor') return false;
      const offers = Array.isArray(request.offers) ? request.offers : [];
      return !offers.some((offer) => offer.providerId === currentUser.id);
    });

    providerOpenRequests.innerHTML = '';
    if (!openRequests.length) {
      providerOpenRequests.innerHTML = '<p>Tüm taleplere teklif verdiniz. Yeni talepler için beklemedesiniz.</p>';
      return;
    }

    openRequests.forEach((request) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      const date = new Date(request.createdAt).toLocaleDateString('tr-TR');
      item.innerHTML = `
        <h3>${request.category}</h3>
        <span>${date}</span>
        <p>${request.description}</p>
      `;

      const form = document.createElement('form');
      form.className = 'offer-form';
      form.innerHTML = `
        <div class="inline">
          <label>
            Mesaj
            <textarea name="message" rows="3" required placeholder="Hizmet teklifinizi açıklayın"></textarea>
          </label>
          <label>
            Fiyat (₺)
            <input type="number" name="price" min="0" step="any" required />
          </label>
        </div>
        <button type="submit" class="button">Teklif Gönder</button>
        <p class="feedback"></p>
      `;

      const feedback = form.querySelector('.feedback');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = {
          providerId: currentUser.id,
          message: formData.get('message').trim(),
          price: formData.get('price'),
        };

        setFeedback(feedback, '');
        try {
          await fetchJSON(`/api/requests/${request.id}/offers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          setFeedback(feedback, 'Teklifiniz gönderildi.', 'success');
          form.reset();
          await loadProviderOpenRequests();
          await loadProviderOffers();
        } catch (error) {
          setFeedback(feedback, error.message, 'error');
        }
      });

      item.appendChild(form);
      providerOpenRequests.appendChild(item);
    });
  } catch (error) {
    providerOpenRequests.innerHTML = `<p>${error.message}</p>`;
  }
}

async function loadProviderOffers() {
  if (!currentUser || currentUser.role !== 'usta') return;
  try {
    const requests = await fetchJSON(`/api/requests/provider/${currentUser.id}`);
    providerOffers.innerHTML = '';

    if (!requests.length) {
      providerOffers.innerHTML = '<p>Henüz gönderdiğiniz teklif bulunmuyor.</p>';
      return;
    }

    requests.forEach((request) => {
      const offer = (request.offers || []).find((candidate) => candidate.providerId === currentUser.id);
      if (!offer) return;

      const item = document.createElement('div');
      item.className = 'list-item';
      const date = new Date(offer.createdAt).toLocaleDateString('tr-TR');
      item.innerHTML = `
        <h3>${request.category}</h3>
        <span>${date} • <span class="status-tag">${offer.status}</span></span>
        <p>${offer.message}</p>
        <p><strong>Teklif:</strong> ₺${offer.price}</p>
      `;
      providerOffers.appendChild(item);
    });
  } catch (error) {
    providerOffers.innerHTML = `<p>${error.message}</p>`;
  }
}

async function loadCustomerRequests() {
  if (!currentUser || currentUser.role !== 'musteri') return;
  try {
    const requests = await fetchJSON(`/api/requests/customer/${currentUser.id}`);
    customerRequests.innerHTML = '';

    if (!requests.length) {
      customerRequests.innerHTML = '<p>Henüz talep oluşturmadınız.</p>';
      return;
    }

    requests.forEach((request) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      const date = new Date(request.createdAt).toLocaleDateString('tr-TR');
      item.innerHTML = `
        <h3>${request.category}</h3>
        <span>${date} • <span class="status-tag">${request.status}</span></span>
        <p>${request.description}</p>
      `;

      const offers = Array.isArray(request.offers) ? request.offers : [];
      if (offers.length) {
        const offersWrapper = document.createElement('div');
        offersWrapper.className = 'list';
        offers.forEach((offer) => {
          const offerItem = document.createElement('div');
          offerItem.className = 'list-item';
          const offerDate = new Date(offer.createdAt).toLocaleDateString('tr-TR');
          offerItem.innerHTML = `
            <h3>Teklif • ₺${offer.price}</h3>
            <span>${offerDate} • ${offer.status}</span>
            <p>${offer.message}</p>
          `;

          if (offer.status === 'Beklemede' && request.status === 'Teklif Bekleniyor') {
            const form = document.createElement('form');
            form.className = 'offer-accept-form';
            form.innerHTML = `
              <div class="inline">
                <label>
                  Puan (1-5)
                  <input type="number" name="rating" min="1" max="5" step="1" />
                </label>
                <label>
                  Yorum (opsiyonel)
                  <input type="text" name="comment" placeholder="Hizmeti değerlendirin" />
                </label>
              </div>
              <button type="submit" class="button">Teklifi Kabul Et</button>
              <p class="feedback"></p>
            `;

            const feedback = form.querySelector('.feedback');
            form.addEventListener('submit', async (event) => {
              event.preventDefault();
              const formData = new FormData(form);
              const payload = {
                customerId: currentUser.id,
                rating: formData.get('rating') || undefined,
                comment: formData.get('comment') || '',
              };

              setFeedback(feedback, '');
              try {
                await fetchJSON(`/api/requests/${request.id}/offers/${offer.id}/accept`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                });
                setFeedback(feedback, 'Teklif kabul edildi.', 'success');
                await loadCustomerRequests();
                await loadProviderOffers();
                await refreshCurrentUser();
              } catch (error) {
                setFeedback(feedback, error.message, 'error');
              }
            });

            offerItem.appendChild(form);
          }

          offersWrapper.appendChild(offerItem);
        });
        item.appendChild(offersWrapper);
      } else {
        const empty = document.createElement('p');
        empty.textContent = 'Bu talep için henüz teklif gelmedi.';
        item.appendChild(empty);
      }

      customerRequests.appendChild(item);
    });
  } catch (error) {
    customerRequests.innerHTML = `<p>${error.message}</p>`;
  }
}

async function refreshCurrentUser() {
  if (!currentUser) return;
  try {
    if (currentUser.role === 'usta') {
      providerDetails = await fetchJSON(`/api/providers/${currentUser.id}`);
      fillProviderForms(providerDetails);
      await loadProviderOpenRequests();
      await loadProviderOffers();
      currentUser.profile = currentUser.profile || {};
      currentUser.profile.firstName = providerDetails.firstName || '';
      currentUser.profile.lastName = providerDetails.lastName || '';
      currentUser.profile.city = providerDetails.city || '';
    } else {
      const data = await fetchJSON(`/api/customers/${currentUser.id}`);
      customerDetails = data;
      const profile = data.profile || {};
      customerProfileForm.elements.firstName.value = profile.firstName || '';
      customerProfileForm.elements.lastName.value = profile.lastName || '';
      customerProfileForm.elements.city.value = profile.city || '';
      customerProfileForm.elements.phone.value = profile.phone || '';
      customerProfileForm.elements.email.value = profile.email || currentUser.email;
      currentUser.profile = profile;
      await loadCustomerRequests();
    }
    showCurrentUser();
  } catch (error) {
    console.error(error);
  }
}

async function initializeDashboard() {
  if (!currentUser) return;
  dashboardSection.classList.remove('hidden');
  if (currentUser.role === 'usta') {
    dashboardIntro.textContent = 'Usta panelinden profilinizi güncelleyebilir, görseller ekleyebilir ve yeni taleplere teklif gönderebilirsiniz.';
    providerPanel.classList.remove('hidden');
    customerPanel.classList.add('hidden');
  } else {
    dashboardIntro.textContent = 'Müşteri panelinden profil bilgilerinizi düzenleyebilir, yeni hizmet talepleri oluşturabilir ve gelen teklifleri yönetebilirsiniz.';
    providerPanel.classList.add('hidden');
    customerPanel.classList.remove('hidden');
  }
  await refreshCurrentUser();
}

categoryFilter.addEventListener('change', (event) => {
  loadProviders(event.target.value);
});

registerRoleSelect.addEventListener('change', updateRoleFields);
updateRoleFields();

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const payload = Object.fromEntries(formData.entries());
  payload.firstName = payload.firstName.trim();
  payload.lastName = payload.lastName.trim();
  payload.profession = payload.profession ? payload.profession.trim() : '';
  payload.city = payload.city ? payload.city.trim() : '';

  setFeedback(registerFeedback, '');
  try {
    const data = await fetchJSON('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    currentUser = data.user;
    registerForm.reset();
    registerRoleSelect.value = 'musteri';
    updateRoleFields();
    setFeedback(registerFeedback, 'Kayıt başarılı. Paneliniz aşağıda açıldı.', 'success');
    showCurrentUser();
    await initializeDashboard();
  } catch (error) {
    setFeedback(registerFeedback, error.message, 'error');
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = Object.fromEntries(formData.entries());

  setFeedback(loginFeedback, '');
  try {
    const data = await fetchJSON('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    currentUser = data.user;
    loginForm.reset();
    setFeedback(loginFeedback, 'Giriş başarılı. Paneliniz aşağıda.', 'success');
    showCurrentUser();
    await initializeDashboard();
  } catch (error) {
    setFeedback(loginFeedback, error.message, 'error');
  }
});

providerProfileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser || currentUser.role !== 'usta') return;

  const formData = new FormData(providerProfileForm);
  const payload = {
    firstName: formData.get('firstName').trim(),
    lastName: formData.get('lastName').trim(),
    profession: formData.get('profession').trim(),
    city: formData.get('city').trim(),
    about: formData.get('about').trim(),
    category: formData.get('category').trim(),
    contact: {
      phone: formData.get('phone').trim(),
      website: formData.get('website').trim(),
      email: formData.get('contactEmail').trim(),
    },
  };

  setFeedback(providerProfileFeedback, '');
  try {
    providerDetails = await fetchJSON(`/api/providers/${currentUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setFeedback(providerProfileFeedback, 'Profil başarıyla güncellendi.', 'success');
    await refreshCurrentUser();
  } catch (error) {
    setFeedback(providerProfileFeedback, error.message, 'error');
  }
});

providerMediaForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser || currentUser.role !== 'usta') return;

  const payload = {};
  const galleryFiles = Array.from(providerGalleryInput.files || []);

  if (providerAvatarInput.files[0]) {
    payload.avatar = await readFileAsDataUrl(providerAvatarInput.files[0]);
  }
  if (providerBannerInput.files[0]) {
    payload.banner = await readFileAsDataUrl(providerBannerInput.files[0]);
  }
  if (galleryFiles.length) {
    payload.gallery = await Promise.all(galleryFiles.map((file) => readFileAsDataUrl(file)));
  }

  if (!Object.keys(payload).length) {
    setFeedback(providerMediaFeedback, 'Güncellenecek bir görsel seçin.', 'error');
    return;
  }

  setFeedback(providerMediaFeedback, '');
  try {
    providerDetails = await fetchJSON(`/api/providers/${currentUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    providerMediaForm.reset();
    setFeedback(providerMediaFeedback, 'Görseller kaydedildi.', 'success');
    await refreshCurrentUser();
  } catch (error) {
    setFeedback(providerMediaFeedback, error.message, 'error');
  }
});

customerProfileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser || currentUser.role !== 'musteri') return;

  const formData = new FormData(customerProfileForm);
  const payload = {
    firstName: formData.get('firstName').trim(),
    lastName: formData.get('lastName').trim(),
    city: formData.get('city').trim(),
    phone: formData.get('phone').trim(),
    email: formData.get('email').trim(),
  };

  if (customerAvatarInput.files[0]) {
    payload.avatar = await readFileAsDataUrl(customerAvatarInput.files[0]);
  }

  setFeedback(customerProfileFeedback, '');
  try {
    customerDetails = await fetchJSON(`/api/customers/${currentUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    customerProfileForm.reset();
    setFeedback(customerProfileFeedback, 'Profil bilgileriniz güncellendi.', 'success');
    await refreshCurrentUser();
    showCurrentUser();
  } catch (error) {
    setFeedback(customerProfileFeedback, error.message, 'error');
  }
});

customerRequestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser || currentUser.role !== 'musteri') return;

  const formData = new FormData(customerRequestForm);
  const payload = {
    userId: currentUser.id,
    category: formData.get('category').trim(),
    description: formData.get('description').trim(),
  };

  setFeedback(customerRequestFeedback, '');
  try {
    await fetchJSON('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    customerRequestForm.reset();
    setFeedback(customerRequestFeedback, 'Talebiniz oluşturuldu.', 'success');
    await loadCustomerRequests();
    await loadRequests();
  } catch (error) {
    setFeedback(customerRequestFeedback, error.message, 'error');
  }
});

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

loadCategories();
loadProviders();
loadRequests();
