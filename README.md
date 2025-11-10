# TrabzonİşBul

TrabzonİşBul, Armut benzeri bir hizmet pazaryeri deneyimini Node.js ile uçtan uca yeniden oluşturan örnek uygulamadır. Kalıcı veritabanı yerine JSON dosyaları kullanır ve kullanıcı şifrelerini `bcrypt` ile güvenli biçimde saklar.

## Özellikler

- Express tabanlı REST API ve tek sunucu üzerinden servis edilen SPA arayüzü
- `bcrypt` ile korunan kayıt/giriş uçları ve rol (Usta / Müşteri) seçimi
- Usta panelinde profil, iletişim ve medya (profil, banner, galeri) yönetimi
- Müşteri panelinde profil düzenleme, talep oluşturma ve gelen teklifleri kabul etme
- Talep-teklif akışı: ustalar talep kartlarından teklif gönderir, müşteriler teklifleri puanlayarak onaylar
- JSON dosyalarında saklanan kullanıcı, profil, yorum ve talep verileri

## Kurulum

```bash
npm install
npm start
```

Uygulama varsayılan olarak [http://localhost:3000](http://localhost:3000) adresinde çalışır. Arayüz ve API aynı sunucu üzerinden sunulur.

## Demo Hesapları

| Rol | E-posta | Şifre |
| --- | --- | --- |
| Usta | `usta@trabzonisbul.com` | `Trabzon123` |
| Müşteri | `musteri@trabzonisbul.com` | `Trabzon123` |

## JSON Deposu

| Dosya | İçerik |
| --- | --- |
| `data/users.json` | Rol bilgileri, `bcrypt` ile hashlenmiş parolalar, usta/ müşteri profilleri ve yorumlar |
| `data/requests.json` | Müşteri talepleri, ustaların teklifleri ve kabul durumları |

> Not: Önceki sürümden kalan `data/providers.json` artık yalnızca örnek veri niteliğindedir; listelemeler kullanıcı kayıtlarından üretilir.

## API Uçları

### Kimlik Doğrulama

- `POST /api/auth/register` — rol seçimi ile yeni kullanıcı kaydı
- `POST /api/auth/login` — mevcut kullanıcı girişi

### Usta (Service Provider)

- `GET /api/providers` — tüm ustalar veya `?category=` filtresiyle listeleme
- `GET /api/providers/:id` — belirli usta profilini, görselleri ve yorumları alma
- `PUT /api/providers/:id` — usta profilini, iletişim bilgilerini ve medya içeriklerini güncelleme

### Müşteri (Customer)

- `GET /api/customers/:id` — müşteri profilini alma
- `PUT /api/customers/:id` — müşteri profilini ve avatarını güncelleme

### Talepler ve Teklifler

- `GET /api/categories` — kategorileri ve usta sayılarını listeleme
- `GET /api/requests` — tüm talepleri zaman sırasıyla listeleme
- `GET /api/requests/customer/:customerId` — ilgili müşterinin talepleri ve gelen teklifleri
- `GET /api/requests/provider/:providerId` — ustanın gönderdiği tekliflerin durumu
- `POST /api/requests` — yeni hizmet talebi oluşturma (yalnızca müşteri)
- `POST /api/requests/:requestId/offers` — ustaların taleplere teklif göndermesi
- `POST /api/requests/:requestId/offers/:offerId/accept` — müşterinin teklifi opsiyonel puan ve yorumla kabul etmesi

Tüm uçlar JSON döner ve hata durumlarında açıklayıcı mesajlar içerir. Görsel alanları base64 veri URI olarak saklanır.

## Geliştirme Notları

- JSON dosyaları senkron biçimde güncellendiğinden eşzamanlı yazımlar için ek önlem gerekebilir.
- Gerçek ortamda oturum yönetimi veya JWT tabanlı kimlik doğrulama eklenmesi önerilir.
- Dosya yüklemeleri demonstrasyon amaçlı olarak base64 formatında kaydedilir; gerçek ortamda kalıcı dosya depolaması tercih edilmelidir.
