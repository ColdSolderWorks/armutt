import { apiRequest } from './common.js';
import { createProviderCard } from './ui.js';

const providerGrid = document.getElementById('home-provider-grid');
const emptyState = document.getElementById('home-empty');
const statProviderCount = document.getElementById('stat-provider-count');
const searchForm = document.getElementById('home-search');
const queryInput = document.getElementById('home-query');

let allProviders = [];

function renderProviders(providers, limit = null) {
  if (!providerGrid) return;

  providerGrid.innerHTML = '';
  const list = limit ? providers.slice(0, limit) : providers;

  if (!list.length) {
    if (emptyState) {
      emptyState.hidden = false;
    }
    return;
  }

  if (emptyState) {
    emptyState.hidden = true;
  }

  list.forEach((provider) => {
    const card = createProviderCard(provider);
    providerGrid.appendChild(card);
  });
}

function filterProviders(query) {
  const value = query.trim().toLowerCase();
  if (!value) {
    renderProviders(allProviders, 6);
    return;
  }
  const filtered = allProviders.filter((provider) => {
    const haystack = [
      provider.fullName,
      provider.profession,
      provider.category,
      provider.city,
      provider.district,
      provider.about,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(value);
  });
  renderProviders(filtered);
}

async function loadProviders() {
  try {
    const providers = await apiRequest('/api/providers');
    allProviders = [...providers].sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'));
    if (statProviderCount) {
      statProviderCount.textContent = allProviders.length.toString();
    }
    renderProviders(allProviders, 6);
  } catch (error) {
    if (emptyState) {
      emptyState.textContent = `Ustalar yüklenemedi: ${error.message}`;
      emptyState.hidden = false;
    }
  }
}

searchForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  filterProviders(queryInput?.value || '');
  if (providerGrid) {
    providerGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

queryInput?.addEventListener('input', () => {
  filterProviders(queryInput.value);
});

loadProviders();
