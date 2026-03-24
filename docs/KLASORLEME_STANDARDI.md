# ScanDesk — Klasörleme ve Dosyalama Standardı

## Klasör Haritası

| Klasör | Ne için? | Örnek |
|--------|----------|-------|
| `src/components/pages/` | Tam ekran sayfa bileşenleri | `ScanPage.jsx` |
| `src/components/modals/` | Açılır pencere (modal/popup) bileşenleri | `EditRecordModal.jsx` |
| `src/components/ui/` | Küçük, tekrar kullanılabilir UI parçaları | `Icon.jsx`, `Toggle.jsx` |
| `src/components/shared/` | Birden fazla sayfada kullanılan widget'lar | `CustomerPicker.jsx` |
| `src/services/` | API, storage ve dış servis bağlantıları | `storage.js` |
| `src/hooks/` | Custom React hook'ları | `useToast.js` |
| `src/utils.js` | Yardımcı pure fonksiyonlar | tarih, şifre, vardiya |
| `src/constants.js` | Sabit veriler ve başlangıç değerleri | `INITIAL_USERS` |

## Güncel Dosya Yapısı

```
src/
├── App.jsx
├── main.jsx
├── index.css
├── constants.js
├── utils.js
├── logger.js               ← geliştirme logları (prod'da sessiz)
│
├── services/
│   ├── storage.js          ← platform detection (web/Android), dokunma
│   ├── integrations.js     ← PostgreSQL + Google Sheets API
│   ├── recordModel.js      ← kayıt normalizasyonu ve migrasyon
│   ├── syncQueue.js        ← çevrimdışı senkronizasyon kuyruğu
│   └── referenceTable.js   ← referans tablo (palet/lot) yükleme ve sorgulama
│
├── hooks/
│   ├── useToast.js
│   ├── useFormState.js
│   ├── useBackButton.js    ← Android geri tuşu yönetimi
│   ├── useSyncQueue.js     ← senkronizasyon kuyruğu state + işlemleri
│   ├── useServerSync.js    ← SSE tabanlı gerçek zamanlı sunucu senkronizasyonu
│   └── useShiftTimer.js    ← vardiya bitimi ve grace period geri sayımı
│
└── components/
    ├── pages/
    │   ├── ScanPage.jsx
    │   ├── DataPage.jsx
    │   ├── ReportPage.jsx
    │   ├── FieldsPage.jsx
    │   ├── UsersPage.jsx
    │   ├── SettingsPage.jsx
    │   └── Login.jsx
    │
    ├── modals/
    │   ├── EditRecordModal.jsx
    │   ├── CustomerModal.jsx
    │   ├── ShiftInheritModal.jsx
    │   ├── ShiftTakeoverPrompt.jsx
    │   ├── AciklamaModal.jsx
    │   └── DetailFormModal.jsx
    │
    ├── ui/
    │   ├── Icon.jsx
    │   ├── Modal.jsx
    │   ├── Toggle.jsx
    │   ├── ErrorBoundary.jsx
    │   ├── PasswordInput.jsx
    │   └── SelectInput.jsx
    │
    └── shared/
        ├── CustomerPicker.jsx
        ├── AciklamaPicker.jsx
        └── FieldInput.jsx
```

## Yeni Dosya Eklerken Nereye Koy?

- Yeni ekran/sayfa geliştiriyorsan → `components/pages/`
- Yeni açılır pencere yazıyorsan → `components/modals/`
- Küçük buton/ikon/toggle gibi bir şey → `components/ui/`
- Birkaç sayfada ortak kullanılacak widget → `components/shared/`
- Fetch, storage, 3rd party bağlantısı → `services/`
- `useXxx` şeklinde hook → `hooks/`

## Dosya Adlandırma Kuralları

- Bileşenler: `PascalCase` + `.jsx` uzantısı → `ScanPage.jsx`
- Servisler: `camelCase` + `.js` uzantısı → `storage.js`
- Hook'lar: `use` öneki + camelCase + `.js` → `useToast.js`
- Sabitler/Utils: `camelCase` + `.js` → `constants.js`

## Import Sırası (her dosyada bu sırayı koru)

1. React ve React hook'ları
2. Üçüncü parti kütüphaneler (`zxing`, `xlsx`, `@capacitor/...` vb.)
3. Servisler (`../../services/`)
4. Hook'lar (`../../hooks/`)
5. Bileşenler (diğer `../pages/`, `../modals/`, `../ui/`, `../shared/`)
6. Sabitler ve utils (`../../constants`, `../../utils`)
7. CSS dosyaları (en sonda)

## Import Path Kuralları

Bulunduğun klasöre göre doğru `..` sayısını kullan:

| Dosyanın konumu | `src/` seviyesine ulaşmak için |
|-----------------|-------------------------------|
| `src/` | `./` |
| `src/components/pages/` | `../../` |
| `src/components/modals/` | `../../` |
| `src/components/ui/` | `../../` |
| `src/components/shared/` | `../../` |
| `src/hooks/` | `../` |
| `src/services/` | `../` |

Aynı klasör içindeki bileşeni import etmek için: `./Icon`
Komşu klasördeki bileşen için: `../ui/Modal`, `../modals/EditRecordModal`

## Dikkat Edilmesi Gerekenler

- `App.jsx` tüm global state'i yönetir; büyük değişikliklerden önce dikkatli ol
- `utils.js` PBKDF2 şifreleme içerir (`hashPassword`, `verifyPassword`) — fonksiyon imzalarını değiştirme
- `storage.js` platform detection yapar (web/Android) — mantığını bozma
- Capacitor plugin import'ları (`@capacitor/...`) native köprüdür; taşıma
- `syncQueue.js` çevrimdışı kuyruğu yönetir; `integrations.js` ile birlikte çalışır
- `SelectInput.jsx` şu an hiçbir sayfada kullanılmıyor; kullanmadan önce `ui/` altından import et
