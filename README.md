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
- Trabzon, Gümüşhane ve Rize illeri için bağımlı il/ilçe seçicileri; tüm panellerde ve kayıt ekranında konum yönetimi
- Geniş küfür ve argo filtre listesiyle talepler, teklifler ve yorumlar için ön moderasyon
- Gizli yönetim paneli sayesinde ustalar, müşteriler, talepler ve teklifler üzerinde tam kontrol

## Kurulum

```bash
npm install
npm start
```

Uygulama [http://localhost:3000](http://localhost:3000) adresinde çalışır. Sunucu statik dosyaları da aynı porttan servis eder; tarayıcıdan doğrudan `/login.html`, `/register.html`, `/customer-dashboard.html` ve `/provider-dashboard.html` sayfalarına erişebilirsiniz.

### Yönetici hesabını etkinleştirme

Projeyi ilk kez çalıştırdığınızda yönetici paneli kapalıdır. Paneli açmak için gizli bilgilerinizi ortam değişkenlerine girmeniz gerekir:

1. Depodaki `.env.example` dosyasını kopyalayın ve `.env` olarak yeniden adlandırın.
2. `ADMIN_EMAIL` ve `ADMIN_PASSWORD` satırlarının başındaki `#` karakterini silip kullanmak istediğiniz yönetici e-postası ile parolasını yazın. İsterseniz aynı dosyada yer alan `ADMIN_EMAIL_HASH` ve `ADMIN_PASSWORD_HASH` satırlarına `bcrypt` hash'leri koyup düz değerleri boş bırakabilirsiniz.
3. Dosyayı kaydedin ve terminalde projenin kök klasöründe aşağıdaki komutu çalıştırarak sunucuyu başlatın:

   ```bash
   npm start
   ```

Sunucu `.env` dosyasını okuyarak yönetici bilgileriyle giriş yapılmasına izin verir. Ortam değişkenlerini tek seferlik komutla vermek isterseniz aşağıdaki gibi kullanabilirsiniz:

```bash
ADMIN_EMAIL="your-admin-email@example.com" ADMIN_PASSWORD="your-strong-password" npm start
```

Gizli bilgiler `.env` dosyasında kaldığı sürece depoya eklenmez ve Git geçmişine girmez.

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
- `POST /api/auth/verify` — e-posta ile iletilen doğrulama kodunu onaylama

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
- `GET /api/locations` — kayıt ve panellerde kullanılan Trabzon/Gümüşhane/Rize konum listesi

### Yönetici

- `GET /api/admin/summary` — ustalar, müşteriler, talepler ve teklifler için özet veri
- `PUT /api/admin/users/:id/role` — bir kullanıcının rolünü (usta/müşteri/admin) güncelleme
- `DELETE /api/admin/providers/:id` — belirtilen ustayı ve ilişkili tekliflerini kaldırma
- `DELETE /api/admin/customers/:id` — müşteriyi ve taleplerini kaldırma
- `DELETE /api/admin/requests/:id` — bir talebi tüm teklifleriyle silme
- `DELETE /api/admin/requests/:requestId/offers/:offerId` — tekil teklifi kaldırma

Tüm uçlar JSON döner ve hata durumlarında açıklayıcı mesajlar içerir. Medya alanları (avatar, banner, galeri) güncellendiğinde içerikler otomatik olarak `public/uploads` altında ilgili kullanıcı klasörlerine kaydedilir ve API yalnızca göreli dosya yolunu döndürür.

## Geliştirme Notları

Bu proje artık JSON yerine SQLite kullanan güvenli bir temel üzerine kuruludur. Öne çıkan noktalar:

- JWT ile 7 günlük süreli oturumlar ve `Authorization` header kontrolü.
- `/api` altında CSRF koruması ve istemcide otomatik CSRF token alma (bkz. `public/js/common.js`).
- `express-rate-limit` ile POST/PUT/DELETE isteklerine standart hız sınırı ve 5 başarısız girişten sonra 15 dakikalık bloke (SQLite tabanlı kayıt) ile kaba kuvvet engelleme; talep oluşturma için ek kısıtlama.
- Yalnızca izinli origin'lere açılan CORS (`ALLOWED_ORIGINS`) ve admin işlemleri için `authMiddleware` + rol kontrolü. Production ortamında ortam değişkeniyle tanımlı admin hesabı kullanılır, geliştirmede veritabanında `role=admin` kullanıcılar yönetim paneline erişebilir.
- Görsel yüklemelerinde MIME/boyut doğrulaması, rastgele dosya adları ve kullanıcı bazlı dizinler altında saklama.
- Tüm serbest metin alanları XSS'e karşı HTML encode edilerek saklanır.

Yönetim paneline erişim için ortam değişkenlerini ayarlama adımları "Yönetici hesabını etkinleştirme" bölümünde açıklanmıştır; `.env` dosyası depoya eklenmez.
