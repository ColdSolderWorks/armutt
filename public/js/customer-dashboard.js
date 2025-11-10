import {
  ensureRole,
  attachLogout,
  apiRequest,
  renderAlert,
  updateSessionProfile,
  readFileAsDataUrl,
  formatDate,
  createStatusPill,
} from './common.js';

const session = ensureRole('musteri');
if (!session) {
  throw new Error('Yetkisiz erişim');
}

const feedback = document.getElementById('customer-feedback');
const summaryBadge = document.getElementById('customer-summary');
const profileForm = document.getElementById('customer-profile-form');
const requestForm = document.getElementById('request-form');
const requestsContainer = document.getElementById('customer-requests');
const refreshRequestsButton = document.getElementById('refresh-requests');

attachLogout(document.getElementById('logout'));

document.title = `Müşteri Paneli | ${session.profile?.firstName || 'TrabzonİşBul'}`;

let customerData = null;

function renderSummary() {
  if (!summaryBadge || !customerData) return;
  const profile = customerData.profile || {};
  const parts = [profile.city, profile.email].filter(Boolean);
  summaryBadge.textContent = parts.join(' · ') || 'Profilinizi güncelleyin';
}

function populateProfileForm() {
  if (!customerData) return;
  const profile = customerData.profile || {};
  profileForm.querySelector('#cust-firstName').value = profile.firstName || '';
  profileForm.querySelector('#cust-lastName').value = profile.lastName || '';
  profileForm.querySelector('#cust-city').value = profile.city || '';
  profileForm.querySelector('#cust-email').value = profile.email || session.email || '';
  profileForm.querySelector('#cust-phone').value = profile.phone || '';
}

async function loadCustomer() {
  try {
    customerData = await apiRequest(`/api/customers/${session.id}`);
    renderSummary();
    populateProfileForm();
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
}

profileForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(profileForm);
  const payload = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    city: formData.get('city'),
    email: formData.get('email'),
    phone: formData.get('phone'),
  };

  const avatarFile = profileForm.querySelector('#cust-avatar').files[0];
  if (avatarFile) {
    try {
      payload.avatar = await readFileAsDataUrl(avatarFile);
    } catch (error) {
      renderAlert(feedback, 'error', error.message);
      return;
    }
  }

  try {
    await apiRequest(`/api/customers/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    updateSessionProfile(payload);
    renderAlert(feedback, 'success', 'Profiliniz güncellendi.');
    profileForm.reset();
    await loadCustomer();
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
});

requestForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(requestForm);
  const payload = {
    userId: session.id,
    category: formData.get('category'),
    description: formData.get('description'),
  };
  try {
    await apiRequest('/api/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    renderAlert(feedback, 'success', 'Talebiniz oluşturuldu.');
    requestForm.reset();
    await fetchCustomerRequests();
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
});

async function fetchCustomerRequests() {
  try {
    const requests = await apiRequest(`/api/requests/customer/${session.id}`);
    renderRequests(requests);
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
}

function renderRequests(requests = []) {
  if (!requestsContainer) return;
  requestsContainer.innerHTML = '';

  if (!requests.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Henüz oluşturulmuş bir talebiniz yok.';
    requestsContainer.appendChild(empty);
    return;
  }

  requests.forEach((request) => {
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

    const offers = request.offers || [];
    if (!offers.length) {
      const waiting = document.createElement('p');
      waiting.textContent = 'Teklif bekleniyor.';
      item.appendChild(waiting);
    } else {
      const offersList = document.createElement('div');
      offersList.className = 'section';
      offers.forEach((offer) => {
        const offerCard = document.createElement('div');
        offerCard.className = 'card';
        offerCard.innerHTML = `
          <p><strong>Usta:</strong> ${offer.providerId}</p>
          <p><strong>Fiyat:</strong> ${offer.price} ₺</p>
          <p>${offer.message}</p>
          <small>${formatDate(offer.createdAt)}</small>
        `;

        if (request.status !== 'Teklif Kabul Edildi') {
          const actionForm = document.createElement('form');
          actionForm.className = 'section';
          actionForm.innerHTML = `
            <div class="form-grid">
              <div>
                <label>Puan (1-5)</label>
                <input name="rating" type="number" min="1" max="5" />
              </div>
              <div>
                <label>Yorum</label>
                <textarea name="comment" placeholder="İsteğe bağlı"></textarea>
              </div>
            </div>
            <button class="button button-primary" type="submit">Teklifi Kabul Et</button>
          `;
          actionForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const data = new FormData(actionForm);
            const ratingValue = data.get('rating');
            const payload = {
              customerId: session.id,
            };
            if (ratingValue) {
              payload.rating = Number(ratingValue);
              payload.comment = data.get('comment');
            }
            try {
              await apiRequest(`/api/requests/${request.id}/offers/${offer.id}/accept`, {
                method: 'POST',
                body: JSON.stringify(payload),
              });
              renderAlert(feedback, 'success', 'Teklif kabul edildi.');
              await fetchCustomerRequests();
            } catch (error) {
              renderAlert(feedback, 'error', error.message);
            }
          });
          offerCard.appendChild(actionForm);
        } else if (request.acceptedOfferId === offer.id) {
          const accepted = document.createElement('p');
          accepted.className = 'badge';
          accepted.textContent = 'Bu teklifi kabul ettiniz.';
          offerCard.appendChild(accepted);
        }

        offersList.appendChild(offerCard);
      });
      item.appendChild(offersList);
    }

    requestsContainer.appendChild(item);
  });
}

refreshRequestsButton?.addEventListener('click', fetchCustomerRequests);

loadCustomer();
fetchCustomerRequests();
