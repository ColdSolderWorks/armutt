import { apiRequest } from './common.js';
import { createProviderCard } from './ui.js';

const grid = document.getElementById('providers-grid');
const emptyState = document.getElementById('providers-empty');
const searchForm = document.getElementById('providers-search');
const queryInput = document.getElementById('providers-query');
const categorySelect = document.getElementById('providers-category');

let providers = [];

function renderProviders(list) {
  if (!grid) return;

  grid.innerHTML = '';
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
    const card = createProviderCard(provider, { showContact: true });
    grid.appendChild(card);
  });
}

function applyFilters() {
  const query = (queryInput?.value || '').toLowerCase().trim();
  const category = categorySelect?.value || '';

  const filtered = providers.filter((provider) => {
    const matchesCategory = !category || provider.category === category;
    if (!matchesCategory) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystack = [
      provider.fullName,
      provider.profession,
      provider.category,
      provider.city,
      provider.about,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });

  const ordered = [...filtered].sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'));

  renderProviders(ordered);
}

async function loadProviders() {
  try {
    providers = await apiRequest('/api/providers');
    applyFilters();
  } catch (error) {
    if (emptyState) {
      emptyState.textContent = `Ustalar yüklenemedi: ${error.message}`;
      emptyState.hidden = false;
    }
  }
}

async function loadCategories() {
  if (!categorySelect) return;
  try {
    const categories = await apiRequest('/api/categories');
    categories
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      .forEach((category) => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = `${category.name} (${category.providerCount})`;
        categorySelect.appendChild(option);
      });
  } catch (error) {
    // kategori yüklenemezse sessizce geç
  }
}

function syncFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const qParam = params.get('q');
  const categoryParam = params.get('category');
  if (qParam && queryInput) {
    queryInput.value = qParam;
  }
  if (categoryParam && categorySelect) {
    categorySelect.value = categoryParam;
  }
}

searchForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  applyFilters();
  const params = new URLSearchParams();
  if (queryInput?.value) {
    params.set('q', queryInput.value);
  }
  if (categorySelect?.value) {
    params.set('category', categorySelect.value);
  }
  const queryString = params.toString();
  const newUrl = queryString ? `?${queryString}` : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
});

categorySelect?.addEventListener('change', () => {
  applyFilters();
  const params = new URLSearchParams(window.location.search);
  if (categorySelect.value) {
    params.set('category', categorySelect.value);
  } else {
    params.delete('category');
  }
  const queryString = params.toString();
  const newUrl = queryString ? `?${queryString}` : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
});

queryInput?.addEventListener('input', () => {
  applyFilters();
});

async function init() {
  await loadCategories();
  syncFromUrl();
  await loadProviders();
  applyFilters();
}

init();
