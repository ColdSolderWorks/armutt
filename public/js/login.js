import { redirectAuthenticated, apiRequest, setSession, renderAlert } from './common.js';

redirectAuthenticated();

const form = document.getElementById('login-form');
const feedback = document.getElementById('feedback');

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  renderAlert(feedback, null, '');
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  try {
    const { user, message } = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setSession(user);
    renderAlert(feedback, 'success', message || 'Giriş başarılı.');
    setTimeout(() => {
      if (user.role === 'usta') {
        window.location.replace('/provider-dashboard.html');
      } else {
        window.location.replace('/customer-dashboard.html');
      }
    }, 400);
  } catch (error) {
    renderAlert(feedback, 'error', error.message);
  }
});
