-- ScanDesk — Veritabanı Başlangıç Şeması
-- docker-compose PostgreSQL konteyneri ilk açılışta bu dosyayı otomatik çalıştırır.

-- ── Barkod kayıtları ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taramalar (
  id                  TEXT        PRIMARY KEY,
  barcode             TEXT        NOT NULL,
  timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shift               TEXT        NOT NULL,
  customer            TEXT        DEFAULT '',
  aciklama            TEXT        DEFAULT '',
  scanned_by          TEXT        NOT NULL,
  scanned_by_username TEXT        NOT NULL,
  sync_status         TEXT        DEFAULT 'pending',
  sync_error          TEXT        DEFAULT '',
  source              TEXT        DEFAULT 'scan',
  source_record_id    TEXT        DEFAULT '',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  custom_fields       JSONB       DEFAULT '{}'::JSONB,
  -- Vardiya iş tarihi (gece yarısı geçen vardiyalar için timestamp'ten farklı olabilir)
  shift_date          DATE        DEFAULT NULL,
  -- Vardiya devir kaydı için kaynak vardiya etiketi (source='shift_takeover' ise dolu)
  inherited_from_shift TEXT       DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_taramalar_shift_ts  ON taramalar(shift, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_taramalar_barcode   ON taramalar(barcode);
CREATE INDEX IF NOT EXISTS idx_taramalar_custom    ON taramalar USING GIN (custom_fields);

-- ── Uygulama durumu (kullanıcılar, config) ────────────────────────────────────
-- key='users'      → kullanıcı listesi (JSON array)
-- key='app_config' → alanlar, müşteriler, açıklamalar, ayarlar (JSON object)
CREATE TABLE IF NOT EXISTS app_state (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
