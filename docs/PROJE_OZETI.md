# ScanDesk — Proje Özeti

**Tarih:** 2026-03-15
**Branch:** `claude/review-project-summary-Y06tv`
**Durum:** Aktif Geliştirme

---

## 1. Proje Tanımı

ScanDesk, sanayi ortamlarında vardiya bazlı barkod tarama ve envanter takibi için geliştirilmiş **offline-first** bir web ve Android uygulamasıdır.

**Hedef kullanıcı:** Üretim/depo/lojistik ortamlarında çalışan barkod operatörleri ve yöneticileri.

---

## 2. Mimari Özet

```
┌──────────────────────────────────────────────────────┐
│                    İstemci (Client)                  │
│                                                      │
│   React 18 SPA (Vite 6)                              │
│   ├── App.jsx — Merkezi state yönetimi               │
│   ├── components/pages/   — Ekranlar                 │
│   ├── components/modals/  — Dialog'lar               │
│   ├── components/ui/      — Yeniden kullanılabilir   │
│   ├── components/shared/  — Ortak widget'lar         │
│   ├── services/           — API / storage katmanı    │
│   └── hooks/              — Custom React hook'ları   │
│                                                      │
│   Capacitor 7 → Android APK                          │
└─────────────────────┬────────────────────────────────┘
                      │ HTTP + x-api-key
          ┌───────────▼─────────────┐
          │   Express Sunucu        │
          │   (server/index.js)     │
          │   /api/taramalar        │
          │   /api/users            │
          │   /api/app-config       │
          │   + React SPA (dist/)   │
          └───────────┬─────────────┘
                      │ pg (Pool)
          ┌───────────▼─────────────┐
          │      PostgreSQL          │
          │   taramalar (CRUD)       │
          │   app_state (KV store)   │
          └──────────────────────────┘

  Alternatif entegrasyon:
  İstemci → Google Apps Script → Google Sheets (no-cors)
```

**Deployment:** Tek Docker konteyneri (Node.js + Express + React dist/). PostgreSQL ayrı konteyner/servis.

---

## 3. Temel Özellikler

| Özellik | Açıklama |
|---------|----------|
| Barkod tarama | ZXing Browser, kamera veya USB/Bluetooth okuyucu |
| Vardiya yönetimi | 3 sabit vardiya: 12-8, 8-4, 4-12 |
| Çoklu kullanıcı | Admin / normal kullanıcı rolleri |
| Dinamik alanlar | Kullanıcı tanımlı özel alanlar (JSONB) |
| Müşteri/açıklama | Seçmeli liste, admin yönetebilir |
| Vardiya devir | Bir önceki vardiyadan kayıt devralma |
| Excel/CSV export | Tüm kayıtlar veya filtrelenmiş |
| Excel/CSV import | Barkod listesi toplu yükleme |
| Cloud sync | PostgreSQL API veya Google Sheets |
| Offline kuyruğu | Bağlantı kesilince kayıtlar kuyruğa alınır |
| Rapor ekranı | Vardiya/müşteri/kullanıcı bazlı istatistikler |
| Android APK | Capacitor 7 ile native paketleme |

---

## 4. Veri Modeli

### Uygulama İçi Format (camelCase)
```javascript
{
  id: "uuid",
  barcode: "8691234567890",
  timestamp: "2026-03-14T10:15:00.000Z",
  shift: "8-4",                    // "12-8" | "8-4" | "4-12"
  shiftDate: "2026-03-14",
  customer: "ABC Ltd.",
  aciklama: "kontrol edildi",
  scannedBy: "Ad Soyad",
  scannedByUsername: "username",
  syncStatus: "synced",            // "pending" | "synced" | "failed"
  syncError: "",
  source: "scan",                  // "scan" | "import" | "shift_takeover"
  sourceRecordId: "",
  updatedAt: "2026-03-14T10:15:00.000Z",
  customFields: { alan1: "değer", alan2: 42 }
}
```

### Veritabanı Formatı (snake_case)
`recordModel.js` → `toDbPayload()` / `fromDbPayload()` dönüşümünü yapar.
Dinamik alanlar `custom_fields JSONB` kolonunda tutulur.

---

## 5. Servisler Katmanı

| Dosya | Sorumluluk |
|-------|-----------|
| `storage.js` | `loadState` / `saveState` — web: localStorage, native: Capacitor Preferences |
| `recordModel.js` | Kayıt normalizasyonu, migrasyon, camelCase ↔ snake_case dönüşümü |
| `integrations.js` | PostgreSQL API ve Google Sheets HTTP çağrıları |
| `syncQueue.js` | Başarısız sync işlemleri için offline kuyruk (saf fonksiyonlar) |

---

## 6. State Yönetimi

- Tüm global state `App.jsx`'te tutulur (tek kaynak).
- Prop drilling ile alt bileşenlere iletilir (context/store kullanılmaz).
- Her değişiklik sonrası `saveState()` çağrılır (localStorage/Preferences).
- Uygulama açılışında `loadState()` ile hydrate edilir.
- Kayıt migrasyonu başlangıçta `migrateRecords()` ile yapılır.

---

## 7. CI/CD

- **GitHub Actions** — Her PR açıldığında/güncellendiğinde otomatik debug APK üretilir.
- Artifact: `ScanDesk-debug-<PR-no>` (14 gün saklanır)
- Build sırası: `npm ci` → `npm run build` → `cap sync android` → `./gradlew assembleDebug`
- Java 21, Node 20 kullanılır.

---

## 8. Güvenlik Değerlendirmesi

### Tespit Edilen Riskler

| Risk | Önem | Konum |
|------|------|-------|
| Varsayılan admin şifresi `admin123` kaynak kodunda | **Yüksek** | `constants.js:2` |
| Varsayılan API anahtarı kaynak kodunda sabit | **Yüksek** | `constants.js:6` |
| Google Apps Script URL kaynak kodunda açık | **Orta** | `constants.js:7` |
| Sunucu: SQL parametreleri doğru kullanılmış (injection yok) | ✅ Güvenli | `server/index.js` |
| API key doğrulaması tüm route'larda mevcut | ✅ Güvenli | `server/index.js` |

### Öneriler
1. Varsayılan şifre ve API key'i `.env` üzerinden alın, kaynak koddan kaldırın.
2. `DEFAULT_POSTGRES_KEY` production key olmamalı; kullanıcıya ilk kurulumda ayarlatın.
3. `PBKDF2` şifre hash'leme zaten mevcut (`utils.js`) — tüm kullanıcı şifrelerinin hash'li saklandığından emin olun.

---

## 9. Bilinen Sorunlar ve Açık Konular

| No | Sorun | Durum |
|----|-------|-------|
| 1 | `SelectInput.jsx` hiçbir yerde kullanılmıyor | Açık — kaldırılabilir veya entegre edilebilir |
| 2 | Google Sheets `no-cors` modu: sunucu hatası tespit edilemiyor | Tasarım kısıtı — dokümante edilmiş |
| 3 | `shift_date` ve `inherited_from_shift` kolonları schema'da comment'te var ama tabloda yok | Açık — `server/init.sql` güncellenmeli |
| 4 | `App.jsx` 1000+ satır — state çok büyük, bölünebilir | Teknik borç |
| 5 | `handleEdit` → `syncRecordToSheets` kullanıyor ✅ | Çözüldü |

---

## 10. Teknoloji Stack'i (Özet)

| Katman | Teknoloji | Versiyon |
|--------|-----------|----------|
| Frontend | React | 18.3.1 |
| Build | Vite | 6.0.0 |
| Mobil | Capacitor | 7.0.0 |
| Barkod | ZXing Browser | 0.1.5 |
| Excel | SheetJS (xlsx) | 0.18.5 |
| Backend | Express | 4.21.2 |
| Veritabanı | PostgreSQL (pg) | 8.13.3 |
| Konteyner | Docker | — |
| CI | GitHub Actions | — |

---

## 11. Geliştirme Kılavuzu (Hızlı Başlangıç)

```bash
# Geliştirme sunucusu
npm install
npm run dev

# Sunucu + DB (Docker)
cp .env.example .env  # DATABASE_URL ve API_KEY ayarla
docker compose up

# Android APK
bash build.sh
```

**Ortam değişkenleri:** `.env.example` dosyasına bakın.

**Varsayılan giriş:** `admin` / `admin123` (ilk kurulumda değiştirin)

---

## 12. İlgili Dokümanlar

| Doküman | İçerik |
|---------|--------|
| `docs/KLASORLEME_STANDARDI.md` | Dosya/klasör düzeni ve adlandırma kuralları |
| `docs/POSTGRESQL_SCHEMA.md` | Veritabanı şema önerileri |
| `docs/SENKRONIZASYON_MIMARISI.md` | Offline sync ve kuyruk mimarisi |
| `docs/TEKNIK_RAPOR.md` | Servis katmanı detayları |
| `docs/UYGULAMA_MIMARI_DOKUMANTASYONU.md` | Kapsamlı teknik mimari |
| `docs/ZEBRA_TERMINAL_EKRAN_UYUMLULUK_ARASTIRMASI.md` | Zebra cihaz uyumluluk araştırması |
