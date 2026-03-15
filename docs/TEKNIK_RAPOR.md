# ScanDesk — Teknik Durum Raporu

**Son güncelleme:** 2026-03-15
**Proje:** ScanDesk
**Durum:** Aktif geliştirme

---

## A. MEVCUT MİMARİ ÖZET

ScanDesk React + Vite SPA'dır. Capacitor aracılığıyla Android APK olarak paketlenir. Tüm state `App.jsx`'te tutulur, Capacitor Preferences (native) veya localStorage (web) üzerinden kalıcı hale getirilir.

---

## B. SERVİSLER KATMANI (`src/services/`)

### `storage.js`
- `loadState()` / `saveState()` — Native'de Capacitor Preferences, web'de localStorage.
- `isNative()` — Platform tespiti.

### `recordModel.js`
Kayıt formatlarını dönüştürür. Uygulama modeli (camelCase, customFields) ↔ DB modeli (snake_case, custom_fields JSONB).

**Sabit sistem alanları (`FIXED_FIELDS`):**
```
id, barcode, timestamp, shift, customer, aciklama,
scanned_by, scanned_by_username, syncStatus, syncError,
source, sourceRecordId, updatedAt
```
Dinamik kullanıcı alanları `customFields: {}` objesi içinde tutulur.

**Temel fonksiyonlar:**
- `normalizeRecord(record, fields)` — Eski flat format dahil her kaydı standart yapıya getirir.
- `toDbPayload(record)` — camelCase → snake_case, `customFields` → `custom_fields`.
- `fromDbPayload(dbRecord)` — snake_case → camelCase, DB'den uygulama modeline.
- `getDynamicFieldValue(record, fieldId)` — `customFields` önce, root level fallback.
- `setDynamicFieldValue(record, fieldId, value)` — `customFields` içine yazar.
- `migrateRecords(records, fields)` — Toplu normalizasyon.

### `integrations.js`
Dış sistemlerle iletişim. İki entegrasyon tipi: `postgres_api` ve `gsheets`.

**PostgreSQL API:**
- `postgresApiInsert(cfg, row)` — POST `/api/taramalar`
- `postgresApiUpdate(cfg, id, row)` — PATCH `/api/taramalar/:id`
- `postgresApiDelete(cfg, id)` — DELETE `/api/taramalar/:id`

**Google Sheets (Apps Script, no-cors):**
- `sheetsInsert(cfg, headers, row)` — Yeni satır.
- `sheetsUpdate(cfg, headers, row)` — row[0] id, Apps Script upsert yapar.
- `sheetsDelete(cfg, id)` — Tekil silme.
- `sheetsDeleteBulk(cfg, ids)` — Ardışık sheetsDelete çağrısı.
- `syncRecordToSheets(cfg, record, fields)` — Standart header + satır yapısıyla sheetsUpdate çağırır. **Tüm senkronizasyon noktaları bu fonksiyonu kullanmalı** (sütun tutarlılığı için).

> **Açık konu:** `handleEdit` (App.jsx) hâlâ `sheetsUpdate`'i manuel header ile çağırıyor; `syncRecordToSheets` ile birleştirilmeli.

### `syncQueue.js`
PostgreSQL sync başarısız olduğunda işlemleri kuyruğa alır. Saf fonksiyonlar, state dışında bağımsız çalışır.

**Queue item:** `{ id, action, recordId, payload, createdAt, retryCount, lastError, status }`
**action:** `create | update | delete`
**status:** `pending | processing | failed`

---

## C. VERİ MODELİ

### Uygulama içi kayıt
```javascript
{
  id: "uuid",
  barcode: "8691234567890",
  timestamp: "2026-03-14T10:15:00.000Z",
  shift: "8-4",             // "12-8" | "8-4" | "4-12"
  customer: "ABC Ltd.",
  aciklama: "kontrol edildi",
  scanned_by: "Kullanıcı Adı",
  scanned_by_username: "username",
  syncStatus: "pending",    // "pending" | "synced" | "failed"
  syncError: "",
  source: "scan",           // "scan" | "import" | "shift_takeover"
  sourceRecordId: "",       // shift_takeover ise kopyalanan kaydın id'si
  updatedAt: "2026-03-14T10:15:00.000Z",
  customFields: {
    qty: 12,
    raf: "A-12"             // kullanıcı tanımlı dinamik alanlar
  }
}
```

### PostgreSQL payload (`toDbPayload` sonrası)
```javascript
{
  id, barcode, timestamp, shift, customer, aciklama,
  scanned_by, scanned_by_username,
  sync_status, sync_error, source, source_record_id, updated_at,
  custom_fields: { qty, raf }   // JSONB
}
```

---

## D. TEMEL AKIŞLAR

### Kayıt oluşturma
1. Barkod uzunluğu ve mükerrer kontrolü (aynı vardiya + tarih).
2. `customFields` oluşturulur, sabit alanlarla `row` hazırlanır.
3. `onSave(row)` → `App.handleSave` → `normalizeRecord` → state.
4. Entegrasyon aktifse: PostgreSQL'e insert, hata → syncQueue; Sheets'e insert.

### Kayıt silme
- Local state'ten çıkarılır.
- PostgreSQL: `postgresApiDelete`, hata → syncQueue'ya `delete`.
- Sheets: `sheetsDeleteBulk`.

### Sync kuyruğu
- Topbar/sidebar ⟳ butonu → `processSyncQueue`.
- `getRetryableItems` (pending + failed) PostgreSQL API'ye sırayla gönderilir.
- Başarılı → kuyruktan çıkar; başarısız → `failed`.

### Oturum sürekliliği
- Login'de `activeSession: { username, loginShift }` state ile birlikte kaydedilir.
- Açılışta `activeSession` varsa vardiya hâlâ geçerliyse oturum restore edilir; süresi geçmişse `logoutReason: "shift_expired"` ile login ekranı gösterilir.

### Vardiya grace period
- Normal kullanıcı vardiya geçişini 15 sn'de bir kontrol eder.
- Geçişte `graceEndTime` (mutlak timestamp = shift bitiş + 5 dk) hesaplanır.
- Her saniye `graceSecsLeft` güncellenir; sıfırlanınca otomatik logout.

---

## E. POSTGRESQL TABLO ŞEMASI (Özet)

Tablo adı: `taramalar`. Detaylar için `POSTGRESQL_SCHEMA.md`.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | TEXT PK | UUID |
| barcode | TEXT NOT NULL | Taranan barkod |
| timestamp | TIMESTAMPTZ | Tarama zamanı |
| shift | TEXT | "12-8" / "8-4" / "4-12" |
| customer | TEXT | Müşteri |
| aciklama | TEXT | Açıklama notu |
| scanned_by | TEXT | Kullanıcı tam adı |
| scanned_by_username | TEXT | Kullanıcı adı |
| sync_status | TEXT | pending / synced / failed |
| sync_error | TEXT | Hata mesajı |
| source | TEXT | scan / import / shift_takeover |
| source_record_id | TEXT | Kaynak kayıt id (devralma) |
| updated_at | TIMESTAMPTZ | Son güncelleme |
| custom_fields | JSONB | Dinamik alanlar |

---

## F. BİLİNEN EKSİKLER / AÇIK KONULAR

| # | Konu | Öncelik |
|---|------|---------|
| 1 | `handleEdit` Sheets sütun sırası `syncRecordToSheets` ile birleştirilmeli | Orta |
| 2 | `sheetsDeleteBulk` sıralı çalışıyor; Apps Script toplu silme desteklerse paralel yapılabilir | Düşük |
| 3 | Back button listener her `page` değişiminde yeniden kaydoluyor | Düşük |
| 4 | Tema `localStorage`'a direkt yazılıyor; diğer state Capacitor Preferences üzerinden gidiyor | Düşük |

## G. KAPANAN / ÇÖZÜLEN KONULAR

| Konu | Çözüm |
|------|-------|
| `handleDelete` ve `handleEdit` `useCallback` ile sarılmamış | Her ikisi de `useCallback` ile sarıldı |
| Veriler/Son Okutmalar sayfasında düzenleme sonrası scroll en üste gidiyordu | `scroll-area` ref + `useLayoutEffect` ile edit öncesi scroll pozisyonu kaydedilip render sonrası geri yükleniyor |
| `src/components/` altındaki tüm bileşenler tek düzey yığılıydı | `pages/`, `modals/`, `ui/`, `shared/` alt klasörleriyle yeniden yapılandırıldı |
