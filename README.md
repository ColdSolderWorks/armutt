# TrabzonİşBul

TrabzonİşBul, Armut benzeri bir hizmet pazaryeri deneyimini Node.js kullanarak uçtan uca yeniden oluşturan örnek uygulamadır. Kalıcı veri tabanı yerine JSON dosyaları kullanır ve kullanıcı şifrelerini `bcrypt` ile güvenli biçimde saklar.

## Özellikler

- Express tabanlı REST API
- `bcrypt` ile şifrelenen kullanıcı kayıt/giriş uçları
- JSON dosyalarında saklanan kullanıcı, hizmet sağlayıcı ve hizmet talebi verileri
- Kategoriye göre filtrelenebilen hizmet sağlayıcı listesi
- Yeni hizmet talebi oluşturma formu
- Tek sayfalık modern arayüz

## Başlangıç

```bash
npm install
npm start
```

Sunucu varsayılan olarak [http://localhost:3000](http://localhost:3000) adresinde çalışır. Arayüz ve API aynı sunucu üzerinden servis edilir.

## JSON Deposu

| Dosya | İçerik |
| --- | --- |
| `data/users.json` | `bcrypt` ile hashlenmiş parolalara sahip kullanıcı kayıtları |
| `data/providers.json` | Örnek hizmet sağlayıcı profilleri |
| `data/requests.json` | Oluşturulmuş hizmet talepleri |

Demo kullanıcı bilgileri: **demo@trabzonisbul.com / Trabzon123**

## API Uçları

- `POST /api/auth/register` — kullanıcı kaydı
- `POST /api/auth/login` — kullanıcı girişi
- `GET /api/providers` — tüm hizmet sağlayıcıları veya `?category=` filtresi ile listeleme
- `GET /api/categories` — kategorilerin ve profesyonel sayılarının listesi
- `GET /api/requests` — mevcut talepler
- `POST /api/requests` — yeni talep oluşturma

Her uç JSON yanıt döner ve hata durumlarında açıklayıcı mesaj içerir.

## Geliştirme Notları

- Uygulama JSON dosyalarına yazarken mevcut içeriği tamamen günceller; yüksek eş zamanlılık beklenmiyorsa uygundur.
- Gerçek ortamda kimlik doğrulama için oturum veya token mekanizması eklenmesi önerilir.
