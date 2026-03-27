# ScanDesk

Barkod tarama ve envanter yönetim uygulaması. Gerçek zamanlı barkod okuma, çoklu kullanıcı desteği, müşteri/ürün yönetimi ve veri dışa aktarma özellikleri sunar.

## Özellikler
- 👥 **Çoklu kullanıcı** — Admin ve kullanıcı rolleri
- 🏢 **Müşteri yönetimi** — Özel veri alanları ile
- ⏰ **Vardiya takibi** — Envanter operasyonları için
- 📊 **Excel/CSV dışa aktarma**
- ☁️ **Bulut entegrasyonu** — Supabase (PostgreSQL) ve Google Sheets
- 📱 **Mobil uyumlu** — Responsive web + Android (Capacitor)

## Teknolojiler

| Kategori | Teknoloji |
|----------|-----------|
| Frontend | React 18 |
| Build | Vite 6 |
| Mobil | Capacitor 7 (Android) |
| Dışa Aktarma | XLSX |

## Proje Yapısı

```
src/
├── components/        # UI bileşenleri
│   ├── ScanPage.jsx   # Barkod tarama sayfası
│   ├── DataPage.jsx   # Veri görüntüleme/yönetim
│   ├── UsersPage.jsx  # Kullanıcı yönetimi
│   ├── SettingsPage.jsx # Uygulama ayarları
│   ├── FieldsPage.jsx # Özel alan yönetimi
│   ├── Login.jsx      # Giriş ekranı
│   ├── ErrorBoundary.jsx # Hata yakalama
│   └── ...            # Diğer bileşenler
├── services/          # İş mantığı servisleri
│   ├── storage.js     # Veri kalıcılığı
│   └── integrations.js # Supabase & Sheets
├── hooks/             # Özel React hook'ları
│   └── useToast.js    # Bildirim sistemi
├── constants.js       # Sabitler ve başlangıç durumu
├── utils.js           # Yardımcı fonksiyonlar
├── index.css          # Uygulama stilleri
├── App.jsx            # Ana uygulama bileşeni
└── main.jsx           # Giriş noktası
```
