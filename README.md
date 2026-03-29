# ScanDesk

Sanayi ortamlarında vardiya bazlı barkod tarama ve envanter takibi için geliştirilmiş **offline-first** web ve Android uygulaması. Gerçek zamanlı barkod okuma, çoklu kullanıcı desteği, müşteri/ürün yönetimi, cloud senkronizasyon ve veri dışa aktarma özellikleri sunar.

## Özellikler

- **Çoklu kullanıcı** — Admin ve kullanıcı rolleri, PBKDF2 şifreleme
- **Müşteri yönetimi** — Seçmeli müşteri/açıklama listeleri, kullanıcıya özel
- **Vardiya takibi** — 3 sabit vardiya (12-8, 8-4, 4-12), otomatik algılama, grace period
- **Vardiya devir** — Bir önceki vardiyadan kayıt devralma
- **Dinamik alanlar** — Kullanıcı tanımlı özel alanlar (Metin, Sayı, Tarih, Onay Kutusu)
- **Excel/CSV dışa aktarma ve içe aktarma**
- **Bulut entegrasyonu** — PostgreSQL API ve Google Sheets (offline kuyruk ile)
- **Gerçek zamanlı sync** — SSE (Server-Sent Events) + fallback polling
- **Referans tablo** — Palet/lot verisi yükleme ve sorgulama
- **Mobil uyumlu** — Responsive web + Android APK (Capacitor)
- **Zebra uyumlu** — DataWedge klavye girişi ile endüstriyel el terminali desteği

## Teknolojiler

| Kategori | Teknoloji | Versiyon |
|----------|-----------|----------|
| Frontend | React | 18.3.1 |
| Build | Vite | 6.0.0 |
| Mobil | Capacitor | 7.0.0 |
| Backend | Express | 4.21.2 |
| Veritabanı | PostgreSQL (pg) | 8.13.3 |
| Excel | SheetJS (xlsx) + xlsx-js-style | 0.18.5 / 1.2.0 |
| QR | qrcode | 1.5.4 |
| Konteyner | Docker + docker-compose | — |
| CI | GitHub Actions | — |

## Proje Yapısı

```
├── src/
│   ├── App.jsx                     # Ana bileşen, merkezi state yönetimi
│   ├── main.jsx                    # React giriş noktası
│   ├── index.css                   # Global stiller, tema değişkenleri
│   ├── constants.js                # Sabitler ve başlangıç değerleri
│   ├── utils.js                    # Yardımcı fonksiyonlar (tarih, şifre, vardiya)
│   ├── logger.js                   # Geliştirme logları (prod'da sessiz)
│   │
│   ├── components/
│   │   ├── pages/                  # Tam ekran sayfa bileşenleri
│   │   │   ├── ScanPage.jsx        # Barkod tarama ana sayfası
│   │   │   ├── DataPage.jsx        # Kayıt görüntüleme/filtreleme/export
│   │   │   ├── ReportPage.jsx      # Palet referans tablosu ve raporlama
│   │   │   ├── FieldsPage.jsx      # Dinamik alan yönetimi
│   │   │   ├── UsersPage.jsx       # Kullanıcı yönetimi (admin)
│   │   │   ├── SettingsPage.jsx    # Ayarlar ve entegrasyon yapılandırması
│   │   │   └── Login.jsx           # Giriş ekranı
│   │   ├── modals/                 # Açılır pencere bileşenleri
│   │   │   ├── EditRecordModal.jsx # Kayıt düzenleme
│   │   │   ├── DetailFormModal.jsx # Detay form (özel alanlar)
│   │   │   ├── CustomerModal.jsx   # Müşteri ekleme/silme
│   │   │   ├── AciklamaModal.jsx   # Açıklama ekleme/silme
│   │   │   ├── ShiftInheritModal.jsx   # Vardiya devralma seçimi
│   │   │   └── ShiftTakeoverPrompt.jsx # Vardiya başlangıç prompt
│   │   ├── ui/                     # Atomik, tekrar kullanılabilir UI parçaları
│   │   │   ├── Modal.jsx           # Modal wrapper
│   │   │   ├── Icon.jsx            # SVG ikon sistemi
│   │   │   ├── Toggle.jsx          # Toggle switch
│   │   │   ├── PasswordInput.jsx   # Şifre input (göster/gizle)
│   │   │   └── ErrorBoundary.jsx   # React error boundary
│   │   └── shared/                 # Birden fazla sayfada kullanılan widget'lar
│   │       ├── CustomerPicker.jsx  # Müşteri seçimi
│   │       ├── AciklamaPicker.jsx  # Açıklama seçimi
│   │       └── FieldInput.jsx      # Dinamik form input wrapper
│   │
│   ├── services/
│   │   ├── storage.js              # Veri kalıcılığı (web: localStorage, native: Preferences)
│   │   ├── integrations.js         # PostgreSQL API ve Google Sheets HTTP çağrıları
│   │   ├── recordModel.js          # Kayıt normalizasyonu, camelCase ↔ snake_case dönüşümü
│   │   ├── syncQueue.js            # Offline senkronizasyon kuyruğu (saf fonksiyonlar)
│   │   └── referenceTable.js       # Referans tablo (palet/lot) yükleme ve sorgulama
│   │
│   └── hooks/
│       ├── useToast.js             # Toast bildirim sistemi
│       ├── useFormState.js         # Form state yönetimi
│       ├── useBackButton.js        # Android geri tuşu yönetimi (Capacitor)
│       ├── useSyncQueue.js         # Sync kuyruğu state + işlem hook'u
│       ├── useServerSync.js        # SSE tabanlı gerçek zamanlı sunucu senkronizasyonu
│       └── useShiftTimer.js        # Vardiya bitimi ve grace period geri sayımı
│
├── server/
│   ├── index.js                    # Express sunucu (API + SPA serving)
│   └── init.sql                    # PostgreSQL başlangıç şeması
│
├── android/                        # Capacitor Android projesi
├── docs/                           # Proje dokümantasyonu
├── Dockerfile                      # Çok aşamalı Docker build (Node 20-alpine)
├── docker-compose.yml              # PostgreSQL + uygulama servisleri
├── capacitor.config.json           # Capacitor yapılandırması
├── vite.config.js                  # Vite build yapılandırması
├── build.sh                        # Android APK build scripti
├── .env.example                    # Ortam değişkenleri şablonu
└── package.json
```

## Hızlı Başlangıç

```bash
# Geliştirme sunucusu
npm install
npm run dev

# Sunucu + Veritabanı (Docker)
cp .env.example .env    # API_KEY ve DB_PASSWORD ayarla
docker compose up

# Android APK
bash build.sh
```

**Varsayılan giriş:** `admin` / `admin123` (ilk kurulumda değiştirin)

**Ortam değişkenleri:** `.env.example` dosyasına bakın.

## Dokümanlar

| Doküman | İçerik |
|---------|--------|
| `docs/PROJE_OZETI.md` | Kapsamlı proje özeti ve özellik matrisi |
| `docs/TEKNIK_RAPOR.md` | Servis katmanı, veri modeli ve temel akışlar |
| `docs/UYGULAMA_MIMARI_DOKUMANTASYONU.md` | A'dan Z'ye teknik mimari |
| `docs/SENKRONIZASYON_MIMARISI.md` | Offline sync ve kuyruk mimarisi |
| `docs/KLASORLEME_STANDARDI.md` | Dosya/klasör düzeni ve adlandırma kuralları |
| `docs/POSTGRESQL_SCHEMA.md` | Veritabanı şema önerileri |
| `docs/ZEBRA_TERMINAL_EKRAN_UYUMLULUK_ARASTIRMASI.md` | Zebra cihaz uyumluluk araştırması |
