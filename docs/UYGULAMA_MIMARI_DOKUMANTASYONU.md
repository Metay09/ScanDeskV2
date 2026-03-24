# ScanDesk - Teknik Mimari ve Kod Dokümantasyonu

> **Amaç:** Bu uygulamanın A'dan Z'ye nasıl çalıştığını mühendis ve kodlayıcı mantığıyla açıklayan detaylı teknik dokümantasyon.

---

## İçindekiler

1. [Uygulama Genel Bakış](#1-uygulama-genel-bakış)
2. [Teknoloji Stack'i](#2-teknoloji-stacki)
3. [Proje Yapısı ve Mimari](#3-proje-yapısı-ve-mimari)
4. [Veri Akışı ve State Yönetimi](#4-veri-akışı-ve-state-yönetimi)
5. [Barkod Tarama Sistemi](#5-barkod-tarama-sistemi)
6. [Kullanıcı ve Yetkilendirme Sistemi](#6-kullanıcı-ve-yetkilendirme-sistemi)
7. [Vardiya (Shift) Yönetimi](#7-vardiya-shift-yönetimi)
8. [Veri Kalıcılığı (Persistence)](#8-veri-kalıcılığı-persistence)
9. [Import/Export Sistemi](#9-importexport-sistemi)
10. [Cloud Entegrasyonları](#10-cloud-entegrasyonları)
11. [Mobil Platform Desteği](#11-mobil-platform-desteği)
12. [UI/UX ve Tema Sistemi](#12-uiux-ve-tema-sistemi)
13. [Kritik Algoritmalar ve İş Mantığı](#13-kritik-algoritmalar-ve-iş-mantığı)

---

## 1. Uygulama Genel Bakış

**ScanDesk**, sanayi ortamlarında barkod tabanlı envanter takibi yapmak için geliştirilmiş bir **Progressive Web App (PWA)** ve **Android uygulaması**dır.

### Temel Özellikler:
- **Real-time barkod okuma** (Kamera + ZXing kütüphanesi)
- **Çoklu kullanıcı desteği** (Admin / Normal kullanıcı rolleri)
- **Vardiya bazlı çalışma** (08:00-16:00, 16:00-00:00, 00:00-08:00)
- **Müşteri ve özel alan yönetimi**
- **Excel/CSV dışa/içe aktarım**
- **Cloud senkronizasyon** (PostgreSQL API / Google Sheets)
- **Offline-first mimari** (LocalStorage / Capacitor Preferences)

### Kullanım Senaryosu:
Bir üretim tesisinde vardiya başında kullanıcı giriş yapar, vardiyasını devralır, barkod okutarak ürün/malzeme kaydı oluşturur. Admin tüm vardiyaları görebilir, normal kullanıcı sadece kendi vardiyasını görür. Vardiya sonunda veriler Excel'e aktarılabilir veya PostgreSQL API / Sheets'e otomatik senkronize edilebilir.

---

## 2. Teknoloji Stack'i

### Frontend Framework
- **React 18.3.1** - Bileşen tabanlı UI geliştirme
- **Vite 6.0.0** - Hızlı build tool, HMR (Hot Module Replacement)
- **JSX** - Declarative component syntax

### Mobil Platform
- **Capacitor 7.0.0** - Web uygulamasını native Android app'e dönüştürme
  - `@capacitor/app` - Hardware back button kontrolü
  - `@capacitor/preferences` - Native storage (Android)
  - `@capacitor/filesystem` - Dosya yazma/okuma
  - `@capacitor/share` - Native share dialog

### Barkod Okuma
- **@zxing/browser 0.1.5** - ZXing kütüphanesinin browser implementasyonu
  - `BrowserMultiFormatReader` - Multi-format barcode decoder
  - Desteklenen formatlar: QR Code, Code 128, EAN-13, Data Matrix, vb. (12+ format)

### Veri İşleme
- **XLSX 0.18.5** - Excel dosyası okuma/yazma (SheetJS)
  - Binary dosya işleme için `ArrayBuffer` kullanımı
  - CSV export için custom implementation

### State Yönetimi
- **React Hooks** (useState, useEffect, useCallback, useRef)
- **Prop drilling** - Global state manager kullanmayan lightweight yaklaşım
- **LocalStorage / Capacitor Preferences** - Offline persistence

---

## 3. Proje Yapısı ve Mimari

```
scandesk-project/
├── src/
│   ├── App.jsx                    # Root component, state orchestration
│   ├── main.jsx                   # Entry point, React rendering
│   ├── index.css                  # Global styles, CSS variables
│   ├── constants.js               # Initial data, config constants
│   ├── utils.js                   # Pure functions (date, crypto, etc.)
│   ├── logger.js                  # Geliştirme logları (prod'da sessiz)
│   │
│   ├── components/
│   │   ├── pages/                 # Tam ekran sayfa bileşenleri
│   │   │   ├── ScanPage.jsx       # Barkod tarama ana sayfası
│   │   │   ├── DataPage.jsx       # Kayıtları görüntüleme/filtreleme
│   │   │   ├── ReportPage.jsx     # Raporlama ve grafikler
│   │   │   ├── FieldsPage.jsx     # Dinamik alan yönetimi
│   │   │   ├── UsersPage.jsx      # Kullanıcı CRUD (admin only)
│   │   │   ├── SettingsPage.jsx   # Ayarlar ve entegrasyon config
│   │   │   └── Login.jsx          # Giriş ekranı
│   │   │
│   │   ├── modals/                # Açılır pencere bileşenleri
│   │   │   ├── EditRecordModal.jsx    # Kayıt düzenleme
│   │   │   ├── CustomerModal.jsx      # Müşteri ekleme/silme
│   │   │   ├── ShiftInheritModal.jsx  # Vardiya devralma
│   │   │   ├── ShiftTakeoverPrompt.jsx# Vardiya başlangıç prompt
│   │   │   ├── AciklamaModal.jsx      # Açıklama seçimi
│   │   │   └── DetailFormModal.jsx    # Detay form modal
│   │   │
│   │   ├── ui/                    # Atomik, tekrar kullanılabilir UI parçaları
│   │   │   ├── Icon.jsx           # SVG icon system
│   │   │   ├── Modal.jsx          # Reusable modal wrapper
│   │   │   ├── Toggle.jsx         # Toggle switch
│   │   │   ├── ErrorBoundary.jsx  # React error boundary
│   │   │   ├── PasswordInput.jsx  # Şifre input (göster/gizle)
│   │   │   └── SelectInput.jsx    # Select dropdown (şu an kullanılmıyor)
│   │   │
│   │   └── shared/                # Birden fazla sayfada kullanılan widget'lar
│   │       ├── CustomerPicker.jsx # Müşteri seçimi widget
│   │       ├── AciklamaPicker.jsx # Açıklama seçimi widget
│   │       └── FieldInput.jsx     # Dinamik form input wrapper
│   │
│   ├── services/
│   │   ├── storage.js             # LocalStorage/Preferences abstraction
│   │   ├── integrations.js        # PostgreSQL API & Google Sheets fonksiyonları
│   │   ├── recordModel.js         # Kayıt normalizasyon ve DB dönüşüm katmanı
│   │   ├── syncQueue.js           # PostgreSQL offline sync kuyruğu (saf fonksiyonlar)
│   │   └── referenceTable.js      # Referans tablo (palet/lot) yükleme ve sorgulama
│   │
│   └── hooks/
│       ├── useToast.js            # Toast notification hook
│       ├── useFormState.js        # Form state management hook
│       ├── useBackButton.js       # Android geri tuşu yönetimi
│       ├── useSyncQueue.js        # Sync kuyruğu state + işlem hook'u
│       ├── useServerSync.js       # SSE tabanlı gerçek zamanlı sunucu senkronizasyonu
│       └── useShiftTimer.js       # Vardiya bitimi ve grace period geri sayımı
│
├── docs/                          # Proje dokümantasyonu
├── capacitor.config.json          # Capacitor native configuration
├── vite.config.js                 # Vite build configuration
└── package.json                   # Dependencies
```

### Mimari Prensipleri

**1. Component-Based Architecture**
- Her sayfa bir React component (`ScanPage`, `DataPage`, etc.)
- Modüler ve yeniden kullanılabilir bileşenler
- Props ile tek yönlü veri akışı (unidirectional data flow)

**2. Offline-First Design**
- Tüm veriler önce lokalde saklanır (`localStorage` / `Preferences`)
- Cloud senkronizasyon opsiyonel (background process)
- Network failure toleransı

**3. Single Page Application (SPA)**
- Client-side routing (manuel state: `page`)
- Sayfa yenileme yok, instant navigation
- Mobile-first responsive design

---

## 4. Veri Akışı ve State Yönetimi

### Root State (App.jsx)

`App.jsx` tüm global state'i yönetir:

```javascript
const [users, setUsers]         = useState(INITIAL_USERS);       // Kullanıcı listesi
const [user, setUser]           = useState(null);                // Aktif kullanıcı
const [page, setPage]           = useState("scan");              // Aktif sayfa
const [fields, setFields]       = useState(INITIAL_FIELDS);      // Dinamik alanlar
const [records, setRecords]     = useState([]);                  // Tüm tarama kayıtları
const [lastSaved, setLastSaved] = useState(null);                // Son kaydedilen
const [custList, setCustList]   = useState(DEFAULT_CUSTS);       // Müşteri listesi
const [settings, setSettings]   = useState(INITIAL_SETTINGS);    // Ayarlar
const [integration, setIntegration] = useState({...});           // Cloud config (type: "postgres_api" | "gsheets")
const [shiftTakeovers, setShiftTakeovers] = useState({});        // Vardiya devir log
const [theme, setTheme]         = useState("dark");              // UI tema
const [hydrated, setHydrated]   = useState(false);               // Storage yüklendi mi
const [userLoginShift, setUserLoginShift] = useState(null);      // Giriş anındaki vardiya (normal kullanıcı)
const [graceSecsLeft, setGraceSecsLeft] = useState(null);        // Grace period geri sayım (sn)
const [graceEndTime, setGraceEndTime] = useState(null);          // Grace bitiş mutlak timestamp (ms)
const [logoutReason, setLogoutReason] = useState(null);          // "shift_expired" vb.
const [showExitConfirm, setShowExitConfirm] = useState(false);   // Uygulama çıkış onayı
const [syncQueue, setSyncQueue] = useState([]);                  // PostgreSQL offline sync kuyruğu
const [isSyncing, setIsSyncing] = useState(false);               // Sync işlemi devam ediyor mu
```

### State Güncellemelerinin Tetiklenmesi

**1. Kayıt Ekleme Flow:**
```
ScanPage barkod okutuldu
  → handleSave(record) callback çağrıldı
  → App.jsx: setRecords(prev => [newRecord, ...prev])
  → State değişti → React re-render
  → ScanPage ve DataPage yeni state ile güncellendi
```

**2. Persistence Flow:**
```
useEffect([records, users, settings, ...]) {
  if (!hydrated) return;  // İlk yüklemede kaydetme
  saveState({...});       // Her değişiklikte localStorage'a yaz
}
```

### Data Normalization

**shiftDate Hesaplama:**
```javascript
// Kayıtlara vardiya tarihi ekleme (record.shiftDate)
const addShiftDate = (rec) => {
  if (!rec) return rec;
  const shiftDate = deriveShiftDate(rec);  // utils.js'de tanımlı
  return shiftDate ? { ...rec, shiftDate } : { ...rec };
};

const normalizeRecords = (list) => {
  return Array.isArray(list) ? list.map(addShiftDate) : [];
};
```

**Neden?** Import edilen eski veriler `shiftDate` alanına sahip olmayabilir. Normalizasyon ile her kayıtta tutarlı `shiftDate` garantisi sağlanır.

---

## 5. Barkod Tarama Sistemi

### 5.1 ZXing Kütüphanesi Entegrasyonu

**Dosya:** `src/components/pages/ScanPage.jsx`

```javascript
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, NotFoundException } from "@zxing/library";

// Desteklenen 12+ barkod formatı
const SCAN_FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.EAN_13,
  BarcodeFormat.DATA_MATRIX,
  // ... vb.
];
```

### 5.2 Kamera Başlatma Akışı

**Adım 1: Kullanıcı "Kamerayı Aç" butonuna tıklar**
```javascript
const startCamera = async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Bu tarayıcı kamera erişimini desteklemiyor.", "var(--err)");
    return;
  }
  setCamActive(true);  // Modal'ı aç
};
```

**Adım 2: useEffect kamera stream'ini başlatır**
```javascript
useEffect(() => {
  if (!camActive) return;

  const initCamera = async () => {
    setCamStatus("requesting-camera");
    await startDecoding();  // ZXing decoder'ı başlat
    // ZXing stream'i otomatik alıp videoRef.current.srcObject'e atar
  };

  initCamera();
}, [camActive]);
```

**Adım 3: ZXing sürekli decode yapar**
```javascript
const startDecoding = async () => {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, SCAN_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const reader = new BrowserMultiFormatReader(hints);

  await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
    if (err) return;  // NotFoundException durumlarını ignore et

    const code = result.getText();
    if (!code) return;

    // Debounce check (800ms default)
    if (scanLockRef.current && (Date.now() - lastScanRef.current.ts) < 800) return;

    scanLockRef.current = true;
    lastScanRef.current = { value: code, ts: Date.now() };

    // Kullanıcıya feedback
    setScanPulse(true);  // Animasyon
    setTimeout(() => setScanPulse(false), 220);

    // Kodu işle
    onBarcodeRef.current?.(code);
  });
};
```

### 5.3 Barkod Validasyon ve Duplicate Check

```javascript
const canAcceptCode = (bc) => {
  if (!bc) return { ok: false, msg: null };

  // 1. Uzunluk validasyonu (optional setting)
  if (scanSettings.enforceBarcodeLengthMatch) {
    if (expectedBarcodeLength.current === null) {
      expectedBarcodeLength.current = bc.length;  // İlk barkod referans
    } else if (bc.length !== expectedBarcodeLength.current) {
      return { ok: false, msg: `Barkod uzunluğu ${expectedBarcodeLength.current} olmalı` };
    }
  }

  // 2. Debounce check (aynı barkodu 800ms içinde tekrar okumayı engelle)
  const last = recentRef.current.get(bc);
  if (last && (Date.now() - last) < 800) {
    return { ok: false, msg: "Çift okuma engellendi" };
  }

  // 3. Duplicate check (aynı vardiya+tarih+barkod kontrolü)
  if (findExistingRec(bc)) {
    return { ok: false, msg: "Bu barkod bu vardiyada zaten var", dup: true };
  }

  return { ok: true };
};
```

**Neden duplicate vardiya+tarih bazlı?**
Farklı vardiyalarda aynı barkod olabilir (sabah vardiyasında tarandı, akşam vardiyasında da taranabilir). Bu nedenle uniqueness kontrolü `(barcode + shift + shiftDate)` üçlüsüne göre yapılır.

### 5.4 Flash (Torch) Desteği

```javascript
const toggleTorch = async () => {
  const track = trackRef.current;  // Video track reference
  if (!track) return;

  const caps = track.getCapabilities?.();
  if (!caps.torch) {
    toast('Flash desteklenmiyor', 'var(--mut)');
    return;
  }

  const next = !torchOn;
  await track.applyConstraints({ advanced: [{ torch: next }] });
  setTorchOn(next);
};
```

**Not:** Torch desteği tarayıcı ve cihaz donanımına bağlıdır. Desktop'larda genelde çalışmaz, mobil cihazların arka kamerasında mevcuttur.

---

## 6. Kullanıcı ve Yetkilendirme Sistemi

### 6.1 Kullanıcı Veri Yapısı

```javascript
{
  id: "u0",                          // UUID
  username: "admin",                 // Login için unique identifier
  password: "pbkdf2:...",            // PBKDF2 hash (veya legacy plaintext)
  role: "admin",                     // "admin" | "user"
  name: "Admin",                     // Display name
  active: true                       // Aktif/pasif kullanıcı
}
```

### 6.2 Şifreleme Sistemi (PBKDF2)

**Dosya:** `src/utils.js`

```javascript
export async function hashPassword(plain, saltHex) {
  const salt = saltHex
    ? hexToBytes(saltHex)              // Mevcut salt (verification için)
    : crypto.getRandomValues(new Uint8Array(16));  // Yeni salt

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(plain),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 },
    keyMaterial,
    256
  );

  const hashHex = bytesToHex(new Uint8Array(bits));
  const saltHexOut = bytesToHex(salt);

  return `pbkdf2:${saltHexOut}:${hashHex}`;  // Format: pbkdf2:salt:hash
}

export async function verifyPassword(plain, stored) {
  if (!stored) return false;

  if (stored.startsWith("pbkdf2:")) {
    const parts = stored.split(":");
    const saltHex = parts[1];
    const recomputed = await hashPassword(plain, saltHex);
    return recomputed === stored;  // Constant-time comparison (JS seviyesinde)
  }

  // Legacy: plaintext password support (eski kullanıcılar için)
  return plain === stored;
}
```

**Neden PBKDF2?**
- Web Crypto API native desteği (browser built-in, dependency yok)
- 100.000 iteration ile brute-force saldırılarına dayanıklılık
- Salt kullanımı ile rainbow table saldırısı önleme

**Migration Stratejisi:**
Kullanıcı ilk login olduğunda plaintext şifre hash'e dönüştürülür (`handleMigratePassword` callback).

### 6.3 Rol Bazlı Erişim Kontrolü

**Admin yetkilerı:**
- Tüm vardiyaları görebilir/düzenleyebilir
- Kullanıcı ekleme/silme/düzenleme
- Ayarları değiştirme
- Veri temizleme/import approval
- Vardiya seçimi yapabilir (manuel override)

**Normal kullanıcı yetkileri:**
- Sadece kendi vardiyasını görür
- Müşteri ekleyebilir/silebilir (güncel durum)
- Kendi vardiyasındaki kayıtları düzenleyebilir
- Vardiya otomatik (saat bazlı), değiştiremez

**Kod implementasyonu:**
```javascript
const isAdmin = user?.role === "admin";

// Görünür kayıtlar filtreleme
const visibleRecords = isAdmin
  ? records  // Admin her şeyi görür
  : records.filter(r =>
      r.shift === currentShift &&
      deriveShiftDate(r) === currentShiftDate
    );

// Conditional rendering
{isAdmin && <UsersPage ... />}  // Admin-only sayfa
```

---

## 7. Vardiya (Shift) Yönetimi

### 7.1 Sabit Vardiya Tanımları

**Dosya:** `src/utils.js`

```javascript
export const FIXED_SHIFTS = [
  { label: "12-8", start: 0,  end: 8  },   // 00:00 - 07:59
  { label: "8-4",  start: 8,  end: 16 },   // 08:00 - 15:59
  { label: "4-12", start: 16, end: 24 },   // 16:00 - 23:59
];

export const getShiftByHour = (h) => {
  if (h < 8)  return "12-8";
  if (h < 16) return "8-4";
  return "4-12";
};

export const getCurrentShift = () => {
  return getShiftByHour(new Date().getHours());
};
```

**Neden sabit vardiyalar?**
Sanayi standartları genelde 8 saatlik vardiyalardır. Değişken vardiya yapılandırması ek karmaşıklık getirir, bu yüzden hardcoded.

### 7.2 Vardiya Tarihi Hesaplama

**Problem:** Gece vardiyası (00:00-08:00) hangi günün verisi olacak?

**Çözüm:** `shiftDate` kavramı - kayıt hangi **iş günü**ne ait?

```javascript
export const getShiftDate = (ts, shiftLabel) => {
  const d = ts ? new Date(ts) : new Date();
  const shift = shiftLabel || getShiftByHour(d.getHours());

  // Şu an: gece 02:00, shift: "12-8"
  // shiftDate = bugünün tarihi (iş günü dün akşam başladı, bugün sabah bitiyor)

  return fmtDate(d);  // "YYYY-MM-DD"
};
```

**Not:** Mevcut implementasyonda iş günü mantığı basitleştirilmiş (timestamp'in tarihini direkt kullanıyor). Eğer gece vardiyası bir önceki günün verisi sayılacaksa, shift start saatine göre date adjustment yapılabilir.

### 7.3 Vardiya Devralma (Shift Takeover)

**Senaryo:** Yeni vardiya başladığında kullanıcı önceki vardiyadan kalan kayıtları devralabilir.

**Flow:**
1. Kullanıcı login olduğunda `ShiftTakeoverPrompt` gösterilir
2. Kullanıcı "Devraldım" derse:
   - `shiftTakeovers` state'ine kayıt düşülür: `{ "2025-01-15_8-4": { user: "Ali", userId: "u1", ts: "..." } }`
   - `ShiftInheritModal` açılır (önceki vardiyadan hangi kayıtlar kopyalanacak?)
3. Seçilen kayıtlar yeni ID ile kopyalanır:
   ```javascript
   {
     ...originalRecord,
     id: genId(),
     shift: currentShift,
     inheritedFromShift: "12-8",  // Nereden geldiği işaretlenir
     timestamp: new Date().toISOString()
   }
   ```

**UI'da görünüm:** Devralınan kayıtlar "devralındı" badge'i ile gösterilir.

---

## 8. Veri Kalıcılığı (Persistence)

### 8.1 Storage Abstraction

**Dosya:** `src/services/storage.js`

```javascript
import { Preferences } from "@capacitor/preferences";

export const STORAGE_KEY = "scandesk_state_v2";

export const isNative = () => {
  return Capacitor.isNativePlatform && Capacitor.isNativePlatform();
};

export async function loadState() {
  try {
    if (isNative()) {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      return value ? JSON.parse(value) : null;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveState(state) {
  try {
    const raw = JSON.stringify(state);
    if (isNative()) {
      await Preferences.set({ key: STORAGE_KEY, value: raw });
    } else {
      localStorage.setItem(STORAGE_KEY, raw);
    }
  } catch {}
}
```

**Platform Detection:**
- **Web (browser):** `localStorage` (5-10 MB limit)
- **Android (native):** Capacitor `Preferences` (SharedPreferences wrapper, teorik limit yok)

### 8.2 State Persistence Strategy

**App.jsx:**
```javascript
// İlk yükleme: localStorage'dan state'i çek
useEffect(() => {
  (async () => {
    const st = await loadState();
    if (st?.users) setUsers(st.users);
    if (st?.records) setRecords(normalizeRecords(st.records));
    // ... diğer state'ler
    setHydrated(true);  // Hydration tamamlandı
  })();
}, []);

// Her state değişikliğinde kaydet
useEffect(() => {
  if (!hydrated) return;  // İlk yüklemede kaydetme (sonsuz döngü engeli)
  saveState({
    users, fields, records, lastSaved, custList,
    settings, integration, shiftTakeovers
  });
}, [hydrated, users, fields, records, lastSaved, custList, settings, integration, shiftTakeovers]);
```

**Hydration Flag Neden Gerekli?**
```
1. Component mount → useEffect(loadState) çalışır
2. setRecords([...]) → records değişir
3. useEffect([records]) tetiklenir → saveState çalışır
4. Ama henüz loadState tamamlanmadı! → Boş state kaydedilir (veri kaybı)

Çözüm: hydrated flag ile ilk yükleme tamamlanana kadar saveState'i engelle.
```

---

## 9. Import/Export Sistemi

### 9.1 Excel Export (XLSX)

**Dosya:** `App.jsx → handleExport()`

```javascript
const handleExport = async (type, ids) => {
  const recs = Array.isArray(ids) && ids.length
    ? records.filter(r => ids.includes(r.id))  // Seçili kayıtlar
    : records;                                  // Tüm kayıtlar

  if (!recs.length) {
    toast("Dışa aktarılacak kayıt yok", "var(--acc)");
    return;
  }

  // Header satırı
  const ef = fields.filter(f => f.id !== "barcode");
  const hdr = [
    "Barkod",
    ...ef.map(f => f.label),
    "Müşteri", "Kaydeden", "Kullanıcı Adı", "Tarih", "Saat"
  ];

  // Data satırları
  const data = recs.map(r => {
    const d = new Date(r.timestamp);
    const dateOut = deriveShiftDate(r) || d.toLocaleDateString("tr-TR");
    return [
      r.barcode,
      ...ef.map(f => r[f.id] ?? ""),
      r.customer ?? "",
      r.scanned_by ?? "",
      r.scanned_by_username ?? "",
      dateOut,
      d.toLocaleTimeString("tr-TR")
    ];
  });

  if (type === "xlsx") {
    const ws = XLSX.utils.aoa_to_sheet([hdr, ...data]);  // Array of arrays
    ws["!cols"] = hdr.map(() => ({ wch: 20 }));  // Column width
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Taramalar");

    const filename = `scandesk_${new Date().toISOString().slice(0, 10)}.xlsx`;

    if (isNative()) {
      // Android: Dosyayı base64 encode edip Filesystem API ile kaydet
      const b64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
      await Filesystem.writeFile({
        path: filename,
        data: b64,
        directory: Directory.Documents
      });

      // Native share dialog
      const uri = (await Filesystem.getUri({
        directory: Directory.Documents,
        path: filename
      })).uri;
      await Share.share({ title: "ScanDesk Excel", url: uri });
    } else {
      // Web: Blob download
      XLSX.writeFile(wb, filename);
    }
  }
};
```

**SheetJS (XLSX) Kullanım Paterni:**
1. `aoa_to_sheet()` - 2D array'i Excel worksheet'e çevir
2. `book_new()` - Workbook oluştur
3. `book_append_sheet()` - Worksheet'i workbook'a ekle
4. `write()` / `writeFile()` - Binary çıktı al

### 9.2 Excel/CSV Import

**Dosya:** `DataPage.jsx → handleImportFile()`

**Adım 1: Dosya okuma**
```javascript
const reader = new FileReader();
reader.onload = (ev) => {
  const wb = XLSX.read(ev.target.result, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];  // İlk sheet
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
};
reader.readAsArrayBuffer(file);
```

**Adım 2: Column mapping**
```javascript
// Label → field ID mapping (case-insensitive, Türkçe karakter toleransı)
const labelMap = {};
allFields.forEach(f => {
  labelMap[f.label.toLowerCase()] = f.id;
  labelMap[f.id.toLowerCase()] = f.id;
});
labelMap["müşteri"] = "customer";
labelMap["musteri"] = "customer";
labelMap["kaydeden"] = "scanned_by";
// ... vb.

const imported = rows.map(row => {
  const rec = { id: genId(), synced: false };
  Object.entries(row).forEach(([col, val]) => {
    const fid = labelMap[col.toLowerCase().trim()];
    if (fid) rec[fid] = String(val ?? "");
  });
  // Timestamp reconstruction (varsa tarih+saat kolonlarından)
  if (rec.date && rec.time) {
    rec.timestamp = new Date(`${rec.date}T${rec.time}`).toISOString();
  }
  return rec;
});
```

**Adım 3: Duplicate detection ve admin onayı**
```javascript
const duplicates = [];
imported.forEach(rec => {
  const existing = records.find(r => r.barcode === rec.barcode);
  if (existing) {
    duplicates.push({ imported: rec, existing, reason: "existing" });
  }
});

if (duplicates.length > 0) {
  if (!isAdmin) {
    toast("İçe aktarma için admin yetkisi gerekiyor", "var(--err)");
    return;
  }
  setPendingImport({ records: imported, duplicates });  // Admin modal aç
  return;
}

// Duplicate yok, direkt import et
onImport(imported);
```

**Neden admin approval?**
Duplicate kayıtlar veri tutarsızlığına neden olabilir. Admin onayı ile yanlışlıkla yapılan import'lar engellenir.

---

## 10. Cloud Entegrasyonları

İki entegrasyon tipi desteklenir. `integration.type` değeri `"postgres_api"` veya `"gsheets"` olur. Aynı anda yalnızca biri aktif olabilir.

### 10.1 PostgreSQL API (`postgres_api`)

Özel bir REST API'ye bağlanır. Varsayılan endpoint: `https://scandesk-api.simsekhome.site`.

**`src/services/integrations.js`:**
```javascript
postgresApiInsert(cfg, row)   // POST /api/taramalar
postgresApiUpdate(cfg, id, row) // PATCH /api/taramalar/:id
postgresApiDelete(cfg, id)    // DELETE /api/taramalar/:id
```

Tüm row'lar `toDbPayload(record)` ile dönüştürülür (camelCase → snake_case, `custom_fields` JSONB).

**Offline sync kuyruğu:** Insert/update/delete başarısız olursa `syncQueue`'ya eklenir. Topbar/sidebar'daki ⟳ butonu kuyrukta bekleyenleri yeniden dener.

**Konfigürasyon:**
- `serverUrl`: API base URL
- `apiKey`: `x-api-key` header değeri

### 10.2 Google Sheets (`gsheets`)

Google Apps Script web app üzerinden çalışır. `no-cors` modunda istek atılır — response okunamaz (fire-and-forget).

**`src/services/integrations.js`:**
```javascript
sheetsInsert(cfg, headers, row)       // Yeni satır
sheetsUpdate(cfg, headers, row)       // row[0] id; Apps Script upsert yapar
sheetsDelete(cfg, id)                 // { action: "delete", id }
sheetsDeleteBulk(cfg, ids)            // Ardışık sheetsDelete
syncRecordToSheets(cfg, record, fields) // Standart header yapısıyla sheetsUpdate
```

**Sütun sırası (syncRecordToSheets):**
`Barkod, Müşteri, Açıklama, Kaydeden, Kullanıcı Adı, Tarih, Saat, Vardiya, Kaynak, Kaynak Kayıt ID, Güncellenme, [...dinamik alanlar]`

> Tüm Sheets yazma işlemleri `syncRecordToSheets` üzerinden yapılmalı. `handleEdit` (App.jsx) manuel header kullandığı için sütun sırası farklı — açık konu.

**Apps Script deployment:**
1. Google Sheets → Extensions → Apps Script
2. `POSTGRESQL_SCHEMA.md`'deki script kodunu yapıştır (upsert + delete + log desteği var)
3. Deploy → Web app → Anyone
4. URL → ScanDesk Ayarlar → Google Sheets Script URL

**Konfigürasyon:**
- `scriptUrl`: Apps Script web app URL

---

## 11. Mobil Platform Desteği

### 11.1 Capacitor Build Pipeline

```bash
# 1. Web build
npm run build  # Vite → dist/ klasörüne static files

# 2. Capacitor sync
npx cap sync android  # dist/ → android/app/src/main/assets/public/

# 3. Android build
cd android
./gradlew assembleDebug  # APK oluştur
```

**Capacitor Config (`capacitor.config.json`):**
```json
{
  "appId": "com.scandesk.app",
  "appName": "ScanDesk",
  "webDir": "dist",
  "bundledWebRuntime": false,
  "android": {
    "allowMixedContent": true
  }
}
```

### 11.2 Hardware Back Button (Android)

**Dosya:** `App.jsx`

**3-level navigation sistemi:**
```
1. Başka sayfadaysan → Scan sayfasına git
2. Scan sayfasındaysan → Exit confirmation modal göster (2 saniye timeout)
3. Modal açıkken tekrar basılırsa → Uygulamadan çık
```

**Implementation:**
```javascript
useEffect(() => {
  const handleBackButton = () => {
    // Timer sıfırla
    clearTimeout(backPressTimerRef.current);
    backPressCountRef.current += 1;
    const pressCount = backPressCountRef.current;

    // 2 saniye sonra reset
    backPressTimerRef.current = setTimeout(() => {
      backPressCountRef.current = 0;
      setShowExitConfirm(false);
    }, 2000);

    // 1. Press
    if (pressCount === 1 && page !== "scan") {
      setPage("scan");
      backPressCountRef.current = 0;
      return;
    }

    // 2. Press
    if (pressCount === 2 && page === "scan") {
      setShowExitConfirm(true);
      return;
    }

    // 3. Press
    if (pressCount === 3 && page === "scan" && showExitConfirm) {
      CapApp.exitApp();  // Native exit
    }
  };

  CapApp.addListener('backButton', handleBackButton);

  return () => {
    listener?.remove();
    clearTimeout(backPressTimerRef.current);
  };
}, [page, showExitConfirm]);
```

**Neden 3-level?**
Kullanıcı yanlışlıkla back button'a basıp uygulamadan çıkmasın. Confirmation modal best practice.

### 11.3 Platform-Specific Features

**Kamera:**
- Web: `navigator.mediaDevices.getUserMedia()`
- Android: Capacitor WebView içinde aynı API kullanılır (native bridge yok, direkt browser API)

**File Share:**
- Web: Blob download (`<a>` tag ile)
- Android: `@capacitor/filesystem` + `@capacitor/share` (native share dialog)

**Storage:**
- Web: `localStorage` (5 MB)
- Android: `Preferences` (SharedPreferences, unlimited)

---

## 12. UI/UX ve Tema Sistemi

### 12.1 CSS Variables (Design Tokens)

**Dosya:** `src/index.css`

```css
:root {
  /* Dark theme colors */
  --bg: #0d0f12;
  --s1: #161920;
  --s2: #1e2228;
  --s3: #262b34;
  --brd: #2e3440;

  --acc: #f59e0b;  /* Accent (orange) */
  --ok: #22c55e;   /* Success (green) */
  --err: #ef4444;  /* Error (red) */
  --inf: #3b82f6;  /* Info (blue) */

  --tx: #f1f3f7;   /* Primary text */
  --tx2: #8a93a8;  /* Secondary text */
  --tx3: #3f4a5e;  /* Tertiary text */

  --r: 14px;       /* Border radius */
  --font: 'Inter', sans-serif;
  --mono: 'JetBrains Mono', monospace;
}

[data-theme="light"] {
  --bg: #f0f2f5;
  --s1: #ffffff;
  --tx: #111827;
  /* ... */
}
```

**Theme Toggle:**
```javascript
const [theme, setTheme] = useState(() => {
  return localStorage.getItem("scandesk_theme") || "dark";
});

useEffect(() => {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("scandesk_theme", theme);
}, [theme]);

const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
```

### 12.2 Responsive Layout (Mobile-First)

**Shell Structure:**
```css
.shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;  /* Dynamic viewport height (mobile address bar fix) */
}

.topbar {
  height: 52px;
  flex-shrink: 0;
  /* Mobile only */
  display: flex;
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
}

.bot-nav {
  height: 62px;
  flex-shrink: 0;
  /* Mobile only */
}

@media (min-width: 768px) {
  .topbar, .bot-nav { display: none; }  /* Desktop'ta gizle */
  .side-nav { display: flex; }          /* Sidebar göster */
}
```

**Safe Area Insets (iPhone notch support):**
```css
.topbar {
  padding-top: env(safe-area-inset-top);
}

.bot-nav {
  padding-bottom: env(safe-area-inset-bottom);
}
```

### 12.3 Icon System

**Dosya:** `src/components/ui/Icon.jsx`

```javascript
// SVG path definitions
export const I = {
  barcode: "M3 5v14M7 5v14M11 5v14...",
  camera: "M23 19a2 2 0 0 1-2 2H3a2 2...",
  // ... 20+ icon
};

// Icon component
export const Ic = ({ d, s = 16, c }) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke={c || "currentColor"}
    strokeWidth={2}
  >
    <path d={d} />
  </svg>
);
```

**Kullanım:**
```jsx
<Ic d={I.barcode} s={22} />
<button><Ic d={I.save} s={16} /> Kaydet</button>
```

**Neden custom icon system?**
- Icon library dependency yok (bundle size)
- SVG inline → CSS color inheritance
- Tree-shakeable (sadece kullanılan iconlar bundle'a girer)

---

## 13. Kritik Algoritmalar ve İş Mantığı

### 13.1 Debounce Pattern (Barkod Tekrar Okuma Engeli)

**Problem:** Kamera aynı barkodu 1 saniyede 10+ kez okuyabiliyor.

**Çözüm:**
```javascript
const recentRef = useRef(new Map());  // { barcode: lastTimestamp }

const canAcceptCode = (bc) => {
  const now = Date.now();
  const last = recentRef.current.get(bc);

  if (last && (now - last) < 800) {
    return { ok: false, msg: "Çift okuma engellendi" };
  }

  recentRef.current.set(bc, now);
  return { ok: true };
};
```

**Alternatif:** Scan lock flag
```javascript
const scanLockRef = useRef(false);

// ZXing callback içinde
if (scanLockRef.current) return;  // Locked, ignore
scanLockRef.current = true;

setTimeout(() => {
  scanLockRef.current = false;
}, 800);
```

### 13.2 Stale Closure Problemi (ZXing Callback)

**Problem:**
```javascript
const [bulkMode, setBulkMode] = useState(false);

const onBarcode = (code) => {
  if (bulkMode) {  // BUG: bulkMode değeri callback closure'ında eskimiş olabilir
    // Bulk kayıt
  } else {
    // Tekli kayıt
  }
};

// ZXing setup
reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
  onBarcode(result.getText());  // Stale closure!
});
```

**Çözüm: useRef + callback ref pattern**
```javascript
const bulkModeRef = useRef(false);
const onBarcodeRef = useRef(null);

useEffect(() => {
  bulkModeRef.current = bulkMode;
}, [bulkMode]);

const onBarcode = (code) => {
  if (bulkModeRef.current) {  // Her zaman güncel değer
    // ...
  }
};

onBarcodeRef.current = onBarcode;  // Her render'da güncelle

// ZXing callback
reader.decodeFromVideoDevice(..., (result) => {
  onBarcodeRef.current?.(result.getText());  // Güncel callback'i çağır
});
```

### 13.3 Auto-Focus Scheduling

**Problem:** Kamera kapatıldığında veya modal açıldığında input focus kayboluyor.

**Çözüm:**
```javascript
const scheduleFocus = useCallback(() => {
  clearTimeout(focusTimer.current);
  focusTimer.current = setTimeout(() => {
    if (!camActiveRef.current && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, 120);
}, []);

// Her önemli action sonrası çağır
stopCamera();
scheduleFocus();

handleCustomerSelect(val);
scheduleFocus();
```

**Neden 120ms delay?**
DOM update'lerinin tamamlanmasını beklemek için (modal close animasyonu, vb.). Immediate focus çalışmayabilir.

### 13.4 Record Filtering (Performance)

**Problem:** 10.000+ kayıt varsa filtreleme yavaşlıyor.

**Optimizasyon:**
```javascript
// Önce görünür kayıtları filtrele (rol bazlı)
const visibleRecords = isAdmin
  ? records
  : records.filter(r => r.shift === currentShift);  // Normal kullanıcı sadece kendi vardiyasını görür

// Sonra filtreler uygula
const filtered = visibleRecords.filter(r => {
  if (shiftFilter !== "all" && r.shift !== shiftFilter) return false;
  if (dateFilter && deriveShiftDate(r) !== dateFilter) return false;
  if (!q) return true;

  // Text search (son adım)
  return allFields.some(f =>
    String(r[f.id] ?? "").toLowerCase().includes(q.toLowerCase())
  );
});
```

**İyileştirme önerileri (future):**
- Virtualized list (react-window) → Sadece görünen satırları render et
- Memoization (useMemo) → Filter sonuçlarını cache'le
- Web Worker → Filtering'i background thread'de yap

---

## Sonuç ve Mimari Kararlar

### Güçlü Yönler:
✅ **Offline-first:** Network olmadan çalışır
✅ **Platform agnostic:** Web + Android tek codebase
✅ **Lightweight:** 3rd party dependency minimal (React + Vite + Capacitor + XLSX + ZXing)
✅ **Extensible:** Dinamik alan sistemi, plug-and-play cloud integrations
✅ **Security:** PBKDF2 password hashing, client-side encryption ready

### Trade-offs:
⚠️ **Global state management:** Redux/Zustand yok, büyük uygulamalarda prop drilling problemi olabilir
⚠️ **No backend:** Tüm iş mantığı client-side (admin approval bile client'ta), server-side validation yok
⚠️ **LocalStorage limit:** Web'de 5-10 MB (100.000+ kayıttan sonra problem olabilir)
⚠️ **No real-time sync:** PostgreSQL API / Sheets insert fire-and-forget, conflict resolution yok

### Gelecek İyileştirmeler:
🔮 IndexedDB migration (unlimited storage)
🔮 WebSocket real-time sync (çoklu kullanıcı çakışma engeli)
🔮 Backend API (Node.js + PostgreSQL) ile merkezi validasyon
🔮 PWA service worker (offline caching, background sync)
🔮 Biometric authentication (fingerprint/face unlock)

---

**Hazırlayan:** Claude (Anthropic AI)
**Tarih:** 2026-03-15
**Versiyon:** 1.1.0
