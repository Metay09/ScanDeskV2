# Senkronizasyon Mimarisi

Bu belge, ScanDeskV2 uygulamasının senkronizasyon sistemini dal dal açıklamaktadır.

---

## Genel Yaklaşım

Sistem **"Offline-First"** prensibine dayanır:

- Kayıt **önce yerel state'e** kaydedilir, kullanıcı beklemez.
- Arka planda entegrasyona gönderilir.
- Başarısız olursa **kalıcı bir kuyruğa** alınır.
- İnternet geldiğinde kuyruk **otomatik işlenir**.

---

## Katmanlar

```
┌─────────────────────────────────────────────────────┐
│                   Kullanıcı Arayüzü                 │
│         ScanPage / DataPage / SettingsPage          │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              App.jsx — Orkestrasyon                 │
│  processSyncQueue / handleEdit / handleDelete       │
│  handleImport / handleClear / handleSyncUpdate      │
└───────┬────────────────┬────────────────┬───────────┘
        │                │                │
┌───────▼──────┐ ┌───────▼──────┐ ┌──────▼────────┐
│ syncQueue.js │ │ recordModel  │ │  storage.js   │
│   Kuyruk     │ │  .js Dönüşüm │ │  Kalıcılık    │
└───────┬──────┘ └───────┬──────┘ └──────┬────────┘
        │                │               │
┌───────▼────────────────▼───────────────▼───────────┐
│               integrations.js                      │
│    PostgreSQL API  /  Google Sheets Apps Script     │
└─────────────────────────────────────────────────────┘
```

---

## 1. Kayıt Oluşturma Akışı (Tarama)

> `src/components/pages/ScanPage.jsx:294-353`

```
Barkod okutulur
      │
      ▼
Yeni kayıt nesnesi oluşturulur
  ├─ syncStatus: "pending"
  ├─ syncError:  ""
  ├─ source:     "scan"
  └─ updatedAt:  ISO timestamp
      │
      ▼
Local records state'e eklenir  ← kullanıcı anında görür
      │
      ├──[PostgreSQL aktifse]──────────────────────────┐
      │   postgresApiInsert(toDbPayload(row))           │
      │         ├─ Başarılı → syncStatus: "synced" ✓   │
      │         └─ Hata    → syncStatus: "failed"      │
      │                       addToSyncQueue("create") │
      │                                                │
      └──[Google Sheets aktifse]──────────────────────┘
          sheetsInsert() [no-cors — hata yakalanamaz]
          Hata olsa bile queue'ya alınır
```

---

## 2. Kayıt Güncelleme Akışı

> `App.jsx:408-430`

```
handleEdit(record) çağrılır
      │
      ▼
Local state güncellenir
  └─ updatedAt: yeni timestamp
      │
      ├──[PostgreSQL]──────────────────────────────────┐
      │   postgresApiUpdate(id, toDbPayload(record))    │
      │         ├─ Başarılı → handleSyncUpdate(id, true)│
      │         └─ Hata    → addToSyncQueue("update")  │
      │                                                │
      └──[Google Sheets]──────────────────────────────┘
          syncRecordToSheets() [upsert by ID]
          Hata → addToSyncQueue("update")
```

---

## 3. Kayıt Silme Akışı

> `App.jsx:385-407`

```
handleDelete(id | id[]) çağrılır
      │
      ▼
Local state'den kaldırılır  ← kullanıcı anında görür
      │
      ├──[PostgreSQL]──────────────────────────────────┐
      │   postgresApiDelete(id)                        │
      │         ├─ Başarılı → tamamlandı ✓             │
      │         └─ Hata    → addToSyncQueue("delete")  │
      │                                                │
      └──[Google Sheets]──────────────────────────────┘
          sheetsDelete(id) veya sheetsDeleteBulk(ids)
          Hata → addToSyncQueue("delete")
```

---

## 4. Toplu Silme / Temizleme Akışları

### Tümünü Temizle
> `App.jsx:526-551`

```
handleClear() çağrılır
      │
      ▼
Tüm kayıtlar local'den silinir
      │
      ├──[PostgreSQL] Her kayıt için DELETE isteği gönderilir
      └──[Sheets]     Tüm ID'ler sheetsDeleteBulk() ile silinir
```

### Tarih Aralığı Silme
> `App.jsx:555-603`

```
handleDeleteRange(startDate, endDate)
      │
      ▼
Tarihe göre filtrelenen kayıtlar local'den silinir
      │
      └── Her kayıt için aynı silme akışı uygulanır
```

---

## 5. Import Akışı

> `App.jsx:723-775`, `src/components/pages/DataPage.jsx:108-151`

```
Dosya seçilir (Excel / CSV)
      │
      ▼
DataPage parse eder
  ├─ syncStatus: "pending"
  ├─ source:     "import"
  └─ updatedAt:  timestamp
      │
      ▼
handleImport() → App.jsx
      │
      ├──[PostgreSQL]──────────────────────────────────┐
      │   Her kayıt için postgresApiInsert()            │
      │         ├─ Başarılı → syncStatus: "synced" ✓   │
      │         └─ Hata    → addToSyncQueue("create")  │
      │                                                │
      └──[Google Sheets]──────────────────────────────┘
          Her kayıt için syncRecordToSheets()
          Hata → addToSyncQueue("create")
```

---

## 6. Vardiya Devir Akışı

> `src/components/pages/ScanPage.jsx:406-419`

```
Başka vardiyadan kayıt kopyalanır
  ├─ source:         "shift_takeover"
  └─ sourceRecordId: orijinal kayıt ID'si
      │
      ├──[PostgreSQL] Anında insert dene → hata → queue
      └──[Sheets]     Anında sync dene   → hata → queue
```

---

## 7. Sync Queue Yapısı

> `syncQueue.js:1-165`

Her kuyruk öğesi:

```javascript
{
  id:              uuid,
  action:          "create" | "update" | "delete",
  recordId:        string,
  payload:         object,          // gönderilecek veri
  integrationType: "postgres_api" | "gsheets",
  createdAt:       ISO timestamp,
  retryCount:      number,          // kaç kez denendi
  lastError:       string,          // son hata mesajı
  status:          "pending" | "processing" | "failed"
}
```

Kuyruk yönetim fonksiyonları:

| Fonksiyon | Görevi |
|-----------|--------|
| `addToQueue()` | Öğe ekler, aynı kayıt+action tekrar eklenmez |
| `markAsProcessing()` | İşleme alındı olarak işaretler |
| `markAsFailed()` | Başarısız işaretler, retryCount++ |
| `retryItem()` | Tek öğeyi tekrar "pending" yapar |
| `retryAllFailed()` | Tüm failed → pending |
| `clearProcessed()` | Tamamlananları temizler |
| `getQueueStats()` | total/pending/processing/failed sayıları |

---

## 8. Queue İşleme (processSyncQueue)

> `App.jsx:433-509`

```
processSyncQueue(silent?) çağrılır
      │
      ├─ Entegrasyon aktif değil → dur
      ├─ isSyncing == true       → dur (çift çalışmayı önle)
      │
      ▼
isSyncing = true
      │
      ▼
retryableItems = pending + failed  (mevcut entegrasyona göre filtrele)
      │
      ▼
Her öğe için:
  ┌───────────────────────────────────────┐
  │  markAsProcessing(item.id)            │
  │           │                           │
  │  [PostgreSQL]         [Sheets]        │
  │  create → Insert      create → Insert │
  │  update → Patch       update → Upsert │
  │  delete → Delete      delete → Delete │
  │           │                           │
  │  Başarılı:            Başarılı:       │
  │  handleSyncUpdate ✓   queue'dan sil ✓ │
  │  queue'dan sil                        │
  │           │                           │
  │  Hata:                Hata:           │
  │  markAsFailed()       markAsFailed()  │
  │  handleSyncUpdate(err)                │
  └───────────────────────────────────────┘
      │
      ▼
isSyncing = false
      │
      ▼
Toast göster:
  ├─ Tümü başarılı     → "X kayıt senkronize edildi"
  ├─ Kısmen başarısız  → "X başarılı, Y tekrar deneniyor"
  └─ Tümü başarısız    → "Senkronizasyon başarısız"
```

---

## 9. Otomatik Retry — İnternet Gelince

> `App.jsx:512-516`

```
window "online" event tetiklenir
      │
      ▼
processSyncQueue(silent=true) çağrılır
      │
      ▼
Kuyrukta bekleyen tüm işlemler sessizce işlenir
```

---

## 10. Veri Dönüşümü

> `recordModel.js:1-263`

```
App formatı (camelCase)         PostgreSQL (snake_case)
─────────────────────────────────────────────────────
syncStatus          ←──────────→  sync_status
syncError           ←──────────→  sync_error
recordId            ←──────────→  record_id
scannedBy           ←──────────→  scanned_by
sourceRecordId      ←──────────→  source_record_id
updatedAt           ←──────────→  updated_at

toDbPayload()   → App → PostgreSQL
fromDbPayload() → PostgreSQL → App
```

---

## 11. Kalıcılık

> `storage.js:1-30`

```
saveState() çağrılır
      │
      ├─[Native / Capacitor] → Preferences.set("scandesk_state_v2")
      └─[Web]                → localStorage.setItem("scandesk_state_v2")

Kaydedilen alanlar:
  users, fields, records, lastSaved,
  custList, settings, integration,
  shiftTakeovers, activeSession,
  syncQueue,   ← kuyruk da kalıcı!
  theme
```

Uygulama kapanıp açılsa bile **kuyruk kaybolmaz**.

---

## 12. syncStatus Değerleri

| Değer | Anlam |
|-------|-------|
| `"pending"` | Henüz gönderilmedi |
| `"synced"` | Başarıyla gönderildi ✓ |
| `"failed"` | Gönderim başarısız, kuyrukta bekliyor |

---

## 13. İki Entegrasyonun Farkı

| Özellik | PostgreSQL API | Google Sheets |
|---------|---------------|---------------|
| Hata algılama | HTTP durum kodu ile **tam** | `no-cors` — **algılanamaz** |
| Güncelleme yöntemi | PATCH (ID ile) | Apps Script upsert (ID'ye göre) |
| Silme | DELETE endpoint | POST action:"delete" |
| Retry güvenilirliği | **Yüksek** | Düşük (başarı bilinmez) |
| Çakışma çözümü | `updatedAt` timestamp | ID eşleşmesi |

---

## 14. Sync Badge (UI)

> `App.jsx:223`

```javascript
retryableCount = getRetryableItems(syncQueue).length
```

Kuyrukta bekleyen işlem varsa arayüzde **sayaç rozeti** gösterilir, kullanıcı manuel olarak "Şimdi Dene" butonuna basabilir.

---

## Özet Akış Diyagramı

```
Kullanıcı eylemi (tarama / düzenleme / silme / import)
         │
         ▼
  Local state güncelle  ◄── kullanıcı beklemez
         │
         ▼
   Entegrasyon aktif mi?
     Hayır → dur
     Evet  →
         │
         ▼
   API / Sheets'e gönder
         │
    ┌────┴────┐
  Başarılı  Hata
    │          │
    ▼          ▼
 "synced"   "failed"
              │
          Queue'ya ekle
              │
         ┌────┴──────────────┐
    Online event         Manuel retry
         │                   │
         ▼                   ▼
   processSyncQueue() çalışır
         │
    ┌────┴────┐
  Başarılı  Hala hata
    │          │
    ▼          ▼
 Queue'dan   retryCount++
   sil ✓     bekle
```
