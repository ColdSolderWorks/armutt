# TrabzonİşBul

TrabzonİşBul, Armut benzeri bir hizmet pazaryerini yalnızca Node.js kullanarak yeniden oluşturan örnek projedir. Sunucu tarafı Express ile yazılmıştır; kalıcı veriler için ilişkisel veritabanı yerine JSON dosyaları kullanılır ve tüm parolalar `bcrypt` ile hashlenir.

## Özellikler

- Express tabanlı REST API ve çok sayfalı statik arayüz (ana sayfa, giriş, kayıt, müşteri ve usta panelleri, usta dizini, usta profili)
- Ana sayfada kayıtlı ustaların canlı listesi, anlık arama, öne çıkan istatistikler ve animasyonlu görseller
- `Ustalar` sayfasında kategori filtresi ve arama desteğiyle Facebook benzeri profil kartları
- Rol seçimiyle kayıt ve `bcrypt` korumalı kimlik doğrulama uçları
- Usta panelinde kapak/başlık alanı, profil fotoğrafı, iletişim, medya (profil, banner, galeri) yönetimi ve taleplere teklif gönderme
- Her usta için `public/uploads/providers/{id}` yapısında avatar, banner ve galeri klasörleri; müşteriler için `public/uploads/customers/{id}/avatar`
- Galerideki tüm görseller için ışık kutusu (lightbox) ile tam ekran ön izleme ve animasyonlarla zenginleştirilmiş arayüz
- Müşteri panelinde Facebook profiline benzer görünüm, profil güncelleme, yeni hizmet talebi açma ve gelen teklifleri puanlayarak kabul etme
- Talep-teklif akışının JSON dosyaları üzerinde saklanması; kabul edilen teklifler usta istatistiklerini günceller ve yorumları günceller

## Kurulum

```bash
npm install
npm start
```

Uygulama [http://localhost:3000](http://localhost:3000) adresinde çalışır. Sunucu statik dosyaları da aynı porttan servis eder; tarayıcıdan doğrudan `/login.html`, `/register.html`, `/customer-dashboard.html` ve `/provider-dashboard.html` sayfalarına erişebilirsiniz.

## JSON Deposu

| Dosya | İçerik |
| --- | --- |
| `data/users.json` | Kullanıcı hesapları, roller, `bcrypt` hash'leri ve profil alanları |
| `data/requests.json` | Müşteri talepleri, ustaların teklifleri ve kabul durumları |
| `data/providers.json` | İsteğe bağlı örnek veri dosyası; uygulama kayıtlı ustalardan liste üretir |
| `public/uploads/` | Sunucu tarafından oluşturulan medya klasörleri (usta/müşteri avatar, banner, galeri görselleri) |

> Not: Depo ilk kurulduğunda tüm JSON dosyaları boştur. Deneyimlemek için önce kayıt olup rollere göre giriş yapın.

## API Uçları

### Kimlik Doğrulama

- `POST /api/auth/register` — rol seçimi ile yeni kullanıcı kaydı
- `POST /api/auth/login` — mevcut kullanıcı girişi

### Usta (Service Provider)

- `GET /api/providers` — tüm ustalar; `?category=` ve `?q=` parametreleriyle filtreleme ve arama
- `GET /api/providers/:id` — belirli usta profilini, görselleri ve yorumları alma
- `PUT /api/providers/:id` — usta profilini, iletişim bilgilerini ve medya içeriklerini güncelleme

### Müşteri (Customer)

- `GET /api/customers/:id` — müşteri profilini alma
- `PUT /api/customers/:id` — müşteri profilini ve avatarını güncelleme

### Talepler ve Teklifler

- `GET /api/requests` — tüm talepleri zaman sırasıyla listeleme
- `GET /api/requests/customer/:customerId` — ilgili müşterinin talepleri ve gelen teklifleri
- `GET /api/requests/provider/:providerId` — ustanın gönderdiği tekliflerin durumu
- `POST /api/requests` — yeni hizmet talebi oluşturma (yalnızca müşteri)
- `POST /api/requests/:requestId/offers` — ustaların taleplere teklif göndermesi
- `POST /api/requests/:requestId/offers/:offerId/accept` — müşterinin teklifi opsiyonel puan ve yorumla kabul etmesi

Tüm uçlar JSON döner ve hata durumlarında açıklayıcı mesajlar içerir. Medya alanları (avatar, banner, galeri) güncellendiğinde içerikler otomatik olarak `public/uploads` altında ilgili kullanıcı klasörlerine kaydedilir ve API yalnızca göreli dosya yolunu döndürür.

## Geliştirme Notları

- JSON dosyaları eşzamanlı yazıldığından gerçek projelerde kilitleme veya satır içi kuyruklama gibi önlemler eklenebilir.
- Üretim ortamında oturum yönetimi veya JWT tabanlı kimlik doğrulama tercih edilmelidir.
- Görsel yüklemeleri otomatik olarak disk üzerinde saklanır; base64 veri URI'ları istemci oturumunda tutulmaz.
