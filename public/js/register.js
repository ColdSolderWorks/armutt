import { redirectAuthenticated, apiRequest, setSession, renderAlert } from './common.js';
import { initializeLocationSelects, resolveSelectedLocation } from './locations.js';

redirectAuthenticated();

const form = document.getElementById('register-form');
const feedback = document.getElementById('feedback');
const verifyForm = document.getElementById('verify-form');
const verifyBox = document.getElementById('verify-box');
const roleSelect = document.getElementById('role');
const providerExtra = document.getElementById('provider-extra');
const citySelect = document.getElementById('city');
const districtSelect = document.getElementById('district');

initializeLocationSelects(citySelect, districtSelect);

roleSelect?.addEventListener('change', () => {
  providerExtra.hidden = roleSelect.value !== 'usta';
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  renderAlert(feedback, null, '');

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  if (payload.password !== payload.confirmPassword) {
    renderAlert(feedback, 'error', 'Şifreler eşleşmiyor.');
    return;
  }

  const submission = {
    firstName: payload.firstName?.trim(),
    lastName: payload.lastName?.trim(),
    email: payload.email?.trim(),
    password: payload.password,
    confirmPassword: payload.confirmPassword,
    role: payload.role,
    ...resolveSelectedLocation(citySelect, districtSelect),
  };

  if (payload.role === 'usta') {
    submission.profession = payload.profession?.trim();
    submission.category = payload.category?.trim();
  }

  try {
    await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(submission),
    });

    renderAlert(feedback, 'success', 'Kayıt oluşturuldu. E-posta doğrulama kodunuzu girin.');
    verifyBox.hidden = false;
    verifyForm.elements.email.value = submission.email;
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
});

verifyForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  renderAlert(feedback, null, '');
  const formData = new FormData(verifyForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    const verifyResponse = await apiRequest('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const { user, message } = verifyResponse;
    setSession(user);
    renderAlert(feedback, 'success', message || 'Doğrulama tamamlandı. Yönlendiriliyorsunuz...');
    const role = user?.access?.provider ? 'usta' : user?.access?.customer ? 'musteri' : null;
    setTimeout(() => {
      if (role === 'usta') {
        window.location.replace('/provider-dashboard.html');
      } else {
        window.location.replace('/customer-dashboard.html');
      }
    }, 500);
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
});
