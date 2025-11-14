import { apiRequest } from './common.js';
import { initialsFromName, initializeMediaLightbox } from './ui.js';

const params = new URLSearchParams(window.location.search);
const providerId = params.get('id');

const bannerEl = document.getElementById('profile-banner');
const avatarEl = document.getElementById('profile-avatar');
const nameEl = document.getElementById('profile-name');
const professionEl = document.getElementById('profile-profession');
const metaEl = document.getElementById('profile-meta');
const aboutEl = document.getElementById('profile-about');
const contactEl = document.getElementById('profile-contact');
const tagsEl = document.getElementById('profile-tags');
const gallerySection = document.getElementById('gallery-section');
const galleryGrid = document.getElementById('profile-gallery');
const reviewsSection = document.getElementById('reviews-section');
const reviewsEl = document.getElementById('profile-reviews');
const ratingBadge = document.getElementById('profile-rating');

initializeMediaLightbox();

function createContactItem(label, value, href) {
  if (!value) {
    return null;
  }
  const item = document.createElement('li');
  const labelEl = document.createElement('strong');
  labelEl.textContent = `${label}:`;
  const link = document.createElement(href ? 'a' : 'span');
  link.textContent = value;
  if (href) {
    link.href = href;
    if (href.startsWith('http')) {
      link.target = '_blank';
      link.rel = 'noreferrer noopener';
    }
  }
  item.append(labelEl, link);
  return item;
}

function renderGallery(images = []) {
  if (!gallerySection || !galleryGrid) return;
  galleryGrid.innerHTML = '';
  if (!images.length) {
    gallerySection.hidden = true;
    return;
  }
  gallerySection.hidden = false;
  images.forEach((src, index) => {
    const figure = document.createElement('figure');
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Galeri görseli ${index + 1}`;
    img.dataset.lightbox = 'profile-gallery';
    img.dataset.lightboxSrc = src;
    img.dataset.lightboxAlt = `Galeri görseli ${index + 1}`;
    figure.appendChild(img);
    galleryGrid.appendChild(figure);
  });
}

function renderReviews(reviews = [], rating = 0) {
  if (!reviewsSection || !reviewsEl || !ratingBadge) return;
  reviewsEl.innerHTML = '';
  if (!reviews.length) {
    reviewsSection.hidden = true;
    return;
  }
  reviewsSection.hidden = false;
  ratingBadge.textContent = `⭐ ${rating} (${reviews.length})`;
  reviews.forEach((review) => {
    const article = document.createElement('article');
    article.className = 'review-card';
    article.innerHTML = `
      <header>
        <strong>${review.customerName || 'Müşteri'}</strong>
        <span>⭐ ${review.rating}</span>
      </header>
      <p>${review.comment || 'Yorum belirtilmedi.'}</p>
      <small>${new Date(review.createdAt).toLocaleDateString('tr-TR')}</small>
    `;
    reviewsEl.appendChild(article);
  });
}

async function loadProvider() {
  if (!providerId) {
    aboutEl.textContent = 'Usta profili bulunamadı.';
    return;
  }

  try {
    const provider = await apiRequest(`/api/providers/${providerId}`);
    document.title = `${provider.fullName} | TrabzonİşBul`;
    if (bannerEl) {
      if (provider.banner) {
        bannerEl.style.setProperty('--banner-image', `url('${provider.banner}')`);
        bannerEl.dataset.hasImage = 'true';
      } else {
        bannerEl.style.removeProperty('--banner-image');
        bannerEl.dataset.hasImage = 'false';
      }
    }
    if (avatarEl) {
      if (provider.avatar) {
        avatarEl.style.backgroundImage = `url('${provider.avatar}')`;
        avatarEl.dataset.hasImage = 'true';
      } else {
        avatarEl.textContent = initialsFromName(provider.fullName);
        avatarEl.style.backgroundImage = '';
        delete avatarEl.dataset.hasImage;
      }
    }

    nameEl.textContent = provider.fullName;
    professionEl.textContent = provider.profession || provider.category || 'Uzmanlık bilgisi bekleniyor';

    const locationText = [provider.city, provider.district].filter(Boolean).join(' • ');
    const metaParts = [locationText, provider.contact?.phone, provider.contact?.email]
      .filter(Boolean)
      .map((part) => `<span>${part}</span>`);
    metaEl.innerHTML = metaParts.join('<span class="dot"></span>');

    aboutEl.textContent = provider.about || 'Usta henüz bir açıklama eklemedi.';

    if (contactEl) {
      contactEl.innerHTML = '';
      const contacts = [
        createContactItem('Telefon', provider.contact?.phone, provider.contact?.phone ? `tel:${provider.contact.phone}` : null),
        createContactItem('E-posta', provider.contact?.email, provider.contact?.email ? `mailto:${provider.contact.email}` : null),
        createContactItem('Web', provider.contact?.website, provider.contact?.website),
      ].filter(Boolean);
      if (contacts.length) {
        contactEl.append(...contacts);
      } else {
        const empty = document.createElement('li');
        empty.textContent = 'Usta henüz iletişim bilgisi paylaşmadı.';
        contactEl.appendChild(empty);
      }
    }

    if (tagsEl) {
      tagsEl.innerHTML = '';
      const tags = [provider.profession, provider.category, locationText].filter(Boolean);
      if (tags.length) {
        tags.forEach((tag) => {
          const item = document.createElement('li');
          item.textContent = tag;
          tagsEl.appendChild(item);
        });
      } else {
        const item = document.createElement('li');
        item.textContent = 'Bilgiler güncelleniyor.';
        tagsEl.appendChild(item);
      }
    }

    renderGallery(provider.gallery || []);
    renderReviews(provider.reviews || [], provider.rating || 0);
  } catch (error) {
    nameEl.textContent = 'Usta bulunamadı';
    aboutEl.textContent = error.message;
  }
}

loadProvider();
