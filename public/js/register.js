import { redirectAuthenticated, apiRequest, setSession, renderAlert } from './common.js';

redirectAuthenticated();

const form = document.getElementById('register-form');
const feedback = document.getElementById('feedback');
const roleSelect = document.getElementById('role');
const providerExtra = document.getElementById('provider-extra');

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
    role: payload.role,
    city: payload.city?.trim(),
  };

  if (payload.role === 'usta') {
    submission.profession = payload.profession?.trim();
    submission.category = payload.category?.trim();
  }

  try {
    const { user, message } = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(submission),
    });
    setSession(user);
    renderAlert(feedback, 'success', message || 'Kayıt başarılı. Yönlendiriliyorsunuz...');
    setTimeout(() => {
      if (user.role === 'usta') {
        window.location.replace('/provider-dashboard.html');
      } else {
        window.location.replace('/customer-dashboard.html');
      }
    }, 500);
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
});
