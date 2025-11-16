import { apiRequest } from './common.js';

let cachedLocations = null;

export async function getLocations() {
  if (cachedLocations) {
    return cachedLocations;
  }
  const locations = await apiRequest('/api/locations');
  cachedLocations = Array.isArray(locations) ? locations : [];
  return cachedLocations;
}

function findRegion(city, locations) {
  return locations.find((region) => region.city === city) || locations[0] || null;
}

function buildOptions(options, placeholder) {
  const frag = document.createDocumentFragment();
  if (placeholder) {
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    frag.appendChild(placeholderOption);
  }
  options.forEach((option) => {
    const opt = document.createElement('option');
    opt.value = option;
    opt.textContent = option;
    frag.appendChild(opt);
  });
  return frag;
}

export async function initializeLocationSelects(citySelect, districtSelect, initial = {}) {
  if (!citySelect || !districtSelect) {
    return;
  }
  const locations = await getLocations();
  const defaultRegion = findRegion(initial.city, locations) || locations[0];
  citySelect.innerHTML = '';
  citySelect.appendChild(buildOptions(locations.map((region) => region.city), 'Şehir seçin'));
  citySelect.value = defaultRegion ? defaultRegion.city : '';

  function updateDistricts(selectedCity, preferredDistrict) {
    const region = findRegion(selectedCity, locations);
    districtSelect.innerHTML = '';
    if (!region) {
      return;
    }
    districtSelect.appendChild(buildOptions(region.districts, 'İlçe seçin'));
    const target = region.districts.includes(preferredDistrict) ? preferredDistrict : region.districts[0];
    districtSelect.value = target || '';
  }

  updateDistricts(citySelect.value, initial.district);

  citySelect.addEventListener('change', () => {
    updateDistricts(citySelect.value, null);
  });
}

export function resolveSelectedLocation(citySelect, districtSelect) {
  return {
    city: citySelect?.value || '',
    district: districtSelect?.value || '',
  };
}
