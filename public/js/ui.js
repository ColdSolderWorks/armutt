export function initialsFromName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return 'TU';
  }
  const letters = parts.slice(0, 2).map((part) => part[0].toUpperCase());
  return letters.join('');
}

let lightboxInitialized = false;
let activeLightbox = null;

function closeLightbox() {
  if (!activeLightbox) return;
  document.body.classList.remove('lightbox-open');
  activeLightbox.remove();
  activeLightbox = null;
}

function openLightbox(src, alt) {
  closeLightbox();
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';

  const content = document.createElement('div');
  content.className = 'lightbox-content';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'lightbox-close';
  closeButton.setAttribute('aria-label', 'Kapat');
  closeButton.innerHTML = '&times;';
  closeButton.addEventListener('click', closeLightbox);

  const image = document.createElement('img');
  image.src = src;
  image.alt = alt || 'Görsel';

  content.append(closeButton, image);
  overlay.appendChild(content);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeLightbox();
    }
  });

  document.body.appendChild(overlay);
  document.body.classList.add('lightbox-open');
  activeLightbox = overlay;
}

export function initializeMediaLightbox() {
  if (lightboxInitialized) return;
  lightboxInitialized = true;

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-lightbox-src], img[data-lightbox]');
    if (!trigger) return;
    const src = trigger.getAttribute('data-lightbox-src') || trigger.getAttribute('src');
    if (!src) return;
    const alt = trigger.getAttribute('data-lightbox-alt') || trigger.getAttribute('alt') || 'Görsel';
    event.preventDefault();
    openLightbox(src, alt);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeLightbox();
    }
  });
}

function createContactRow(icon, value, href) {
  if (!value) {
    return null;
  }
  const row = document.createElement('div');
  row.className = 'contact-row';
  const iconSpan = document.createElement('span');
  iconSpan.className = 'contact-icon';
  iconSpan.textContent = icon;
  row.appendChild(iconSpan);
  const link = document.createElement(href ? 'a' : 'span');
  link.textContent = value;
  if (href) {
    link.href = href;
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
  }
  row.appendChild(link);
  return row;
}

export function createProviderCard(provider, options = {}) {
  const { showContact = true, showRating = true } = options;
  const card = document.createElement('article');
  card.className = 'provider-card';

  const banner = document.createElement('div');
  banner.className = 'provider-banner';
  if (provider.banner) {
    banner.style.setProperty('--banner-image', `url('${provider.banner}')`);
    banner.dataset.hasImage = 'true';
  }

  const header = document.createElement('div');
  header.className = 'provider-card-header';

  const avatar = document.createElement('div');
  avatar.className = 'provider-avatar';
  if (provider.avatar) {
    avatar.style.backgroundImage = `url('${provider.avatar}')`;
    avatar.dataset.hasImage = 'true';
  } else {
    avatar.textContent = initialsFromName(provider.fullName || provider.profession || 'Usta');
  }

  const info = document.createElement('div');
  info.className = 'provider-info';
  const nameEl = document.createElement('h3');
  nameEl.textContent = provider.fullName || provider.profession || 'Usta';
  const professionEl = document.createElement('p');
  professionEl.className = 'provider-profession';
  professionEl.textContent = provider.profession || provider.category || 'Uzmanlık bilgisi bekleniyor';
  const metaEl = document.createElement('p');
  metaEl.className = 'provider-meta';
  const metaParts = [provider.city, provider.category].filter(Boolean);
  metaEl.textContent = metaParts.join(' · ');

  info.append(nameEl, professionEl, metaEl);
  header.append(avatar, info);

  const about = document.createElement('p');
  about.className = 'provider-about';
  about.textContent = provider.about || 'Usta henüz bir açıklama eklemedi.';

  const footer = document.createElement('div');
  footer.className = 'provider-card-footer';
  if (showRating && typeof provider.rating === 'number' && provider.rating > 0) {
    const rating = document.createElement('span');
    rating.className = 'provider-rating';
    rating.textContent = `⭐ ${provider.rating} (${provider.reviewCount})`;
    footer.appendChild(rating);
  }
  const profileLink = document.createElement('a');
  profileLink.className = 'button button-ghost';
  profileLink.href = `/provider-profile.html?id=${encodeURIComponent(provider.id)}`;
  profileLink.textContent = 'Profili Gör';
  footer.appendChild(profileLink);

  card.append(banner, header);
  card.appendChild(about);

  if (showContact) {
    const contact = document.createElement('div');
    contact.className = 'provider-contact';
    const contactRows = [
      createContactRow('📞', provider.contact?.phone, provider.contact?.phone ? `tel:${provider.contact.phone}` : null),
      createContactRow('✉️', provider.contact?.email, provider.contact?.email ? `mailto:${provider.contact.email}` : null),
      createContactRow('🌐', provider.contact?.website, provider.contact?.website),
    ].filter(Boolean);
    if (contactRows.length) {
      const contactTitle = document.createElement('h4');
      contactTitle.textContent = 'İletişim';
      contact.append(contactTitle, ...contactRows);
      card.appendChild(contact);
    }
  }

  card.appendChild(footer);

  return card;
}
