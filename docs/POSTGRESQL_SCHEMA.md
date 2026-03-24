# PostgreSQL Schema Recommendations for ScanDesk

## Overview

This document provides the recommended PostgreSQL database schema for ScanDesk, designed to support the application's data model with fixed system fields and dynamic custom fields.

## Database Design Philosophy

The schema follows a two-tier approach:

1. **Fixed System Fields**: Stored as regular table columns for optimal query performance
2. **Dynamic Custom Fields**: Stored in a JSONB column for flexibility and extensibility

This design provides:
- Fast queries on system fields (using indexes)
- Flexibility for user-defined fields without schema migrations
- Type safety for critical business fields
- Support for complex queries on both fixed and dynamic data

## Recommended Schema

### Primary Table: `taramalar` (Scans)

```sql
-- Drop existing table if recreating
-- DROP TABLE IF EXISTS taramalar CASCADE;

-- Kolonlar recordModel.js FIXED_FIELDS ile birebir uyumludur.
-- Uygulama modeli (camelCase) → DB (snake_case) dönüşümü toDbPayload() ile yapılır.
CREATE TABLE taramalar (
  -- Primary identifier
  id TEXT PRIMARY KEY,

  -- Core business fields
  barcode TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Shift and organization
  shift TEXT NOT NULL,
  shift_date TEXT DEFAULT '',
  customer TEXT DEFAULT '',
  aciklama TEXT DEFAULT '',

  -- User tracking
  scanned_by TEXT NOT NULL,
  scanned_by_username TEXT NOT NULL,

  -- Sync status
  sync_status TEXT DEFAULT 'pending',
  sync_error TEXT DEFAULT '',

  -- Metadata
  source TEXT DEFAULT 'scan',
  source_record_id TEXT DEFAULT '',

  -- Timestamps
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Dynamic fields stored as JSONB
  custom_fields JSONB DEFAULT '{}'::JSONB,

  -- Constraints
  CONSTRAINT valid_shift CHECK (shift IN ('12-8', '8-4', '4-12')),
  CONSTRAINT valid_sync_status CHECK (sync_status IN ('pending', 'synced', 'failed')),
  CONSTRAINT valid_source CHECK (source IN ('scan', 'import', 'shift_takeover'))
);

-- Comments for documentation
COMMENT ON TABLE taramalar IS 'Main table for storing barcode scan records';
COMMENT ON COLUMN taramalar.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN taramalar.barcode IS 'Scanned barcode value';
COMMENT ON COLUMN taramalar.timestamp IS 'Exact time of scan';
COMMENT ON COLUMN taramalar.shift IS 'Shift identifier: 12-8, 8-4, or 4-12';
COMMENT ON COLUMN taramalar.shift_date IS 'Calendar date of the shift (YYYY-MM-DD)';
COMMENT ON COLUMN taramalar.customer IS 'Customer name/identifier';
COMMENT ON COLUMN taramalar.scanned_by IS 'Full name of user who scanned';
COMMENT ON COLUMN taramalar.scanned_by_username IS 'Username of scanner';
COMMENT ON COLUMN taramalar.sync_status IS 'Current sync status: pending, synced, or failed';
COMMENT ON COLUMN taramalar.sync_error IS 'Error message if sync failed';
COMMENT ON COLUMN taramalar.source IS 'How the record was created: scan, import, or shift_takeover';
COMMENT ON COLUMN taramalar.source_record_id IS 'Original record ID if created via shift takeover';
COMMENT ON COLUMN taramalar.custom_fields IS 'Dynamic user-defined fields stored as JSON';
```

### Recommended Indexes

```sql
-- Primary lookup: barcode + shift + date (for duplicate detection)
CREATE INDEX idx_taramalar_barcode_shift_date
  ON taramalar(barcode, shift, shift_date);

-- Shift-based queries (common filter for users)
CREATE INDEX idx_taramalar_shift_date
  ON taramalar(shift_date, shift);

-- Customer-based queries
CREATE INDEX idx_taramalar_customer
  ON taramalar(customer)
  WHERE customer IS NOT NULL AND customer != '';

-- User activity tracking
CREATE INDEX idx_taramalar_scanned_by
  ON taramalar(scanned_by_username);

-- Sync status monitoring
CREATE INDEX idx_taramalar_sync_status
  ON taramalar(sync_status)
  WHERE sync_status != 'synced';

-- Timestamp-based queries (for date range filtering)
CREATE INDEX idx_taramalar_timestamp
  ON taramalar(timestamp DESC);

-- GIN index for JSONB custom_fields (enables queries on dynamic fields)
CREATE INDEX idx_taramalar_custom_fields
  ON taramalar USING GIN (custom_fields);

-- Specific JSONB path indexes for commonly queried custom fields
-- Example: if "qty" is frequently queried
CREATE INDEX idx_taramalar_custom_qty
  ON taramalar((custom_fields->>'qty'));

-- Example: if "note" is frequently searched
CREATE INDEX idx_taramalar_custom_note
  ON taramalar USING GIN ((custom_fields->>'note') gin_trgm_ops);
-- Note: Requires pg_trgm extension for text search
```

### Trigger for Updated Timestamp

```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_taramalar_updated_at
  BEFORE UPDATE ON taramalar
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Supporting Tables (Optional but Recommended)

#### Users Table

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_role CHECK (role IN ('admin', 'user'))
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_active ON users(active) WHERE active = TRUE;

-- Add foreign key constraint to taramalar
ALTER TABLE taramalar
  ADD CONSTRAINT fk_scanned_by_username
  FOREIGN KEY (scanned_by_username)
  REFERENCES users(username);
```

#### Customers Table

```sql
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_active ON customers(active) WHERE active = TRUE;
```

#### Field Definitions Table

```sql
CREATE TABLE field_definitions (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  required BOOLEAN DEFAULT FALSE,
  locked BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_field_type CHECK (field_type IN ('Metin', 'Sayı', 'Tarih', 'Onay Kutusu'))
);

CREATE INDEX idx_field_definitions_sort_order ON field_definitions(sort_order);

COMMENT ON TABLE field_definitions IS 'Defines the custom fields available in the application';
COMMENT ON COLUMN field_definitions.locked IS 'If true, field cannot be deleted or modified by users';
```

## Data Migration Strategy

### From Application to Database

Dönüşüm `src/services/recordModel.js` içindeki `toDbPayload()` fonksiyonu tarafından otomatik yapılır. Uygulama modeli (camelCase) → DB modeli (snake_case):

```javascript
// Uygulama modeli (camelCase)
const appRecord = {
  id: "uuid",
  barcode: "8691234567890",
  timestamp: "2026-03-10T10:15:00Z",
  shift: "8-4",
  shiftDate: "2026-03-10",
  customer: "ABC",
  aciklama: "kontrol edildi",
  scanned_by: "Metay",
  scanned_by_username: "metay",
  syncStatus: "pending",
  syncError: "",
  source: "scan",
  sourceRecordId: "",
  updatedAt: "2026-03-10T10:15:00Z",
  customFields: { qty: 12, raf: "A-12" }
};

// DB payload — toDbPayload(appRecord) çıktısı
const dbPayload = {
  id, barcode, timestamp,
  shift, shift_date,          // shiftDate → shift_date
  customer, aciklama,
  scanned_by, scanned_by_username,
  sync_status, sync_error,    // syncStatus → sync_status
  source, source_record_id,   // sourceRecordId → source_record_id
  updated_at,                 // updatedAt → updated_at
  custom_fields               // customFields → custom_fields (JSONB)
};
```

### From Database to Application

`fromDbPayload()` fonksiyonu DB satırını uygulama modeline çevirir (snake_case → camelCase).

## Query Examples

### 1. Find records by barcode in a specific shift

```sql
SELECT * FROM taramalar
WHERE barcode = '8691234567890'
  AND shift = '8-4'
  AND shift_date = '2026-03-10';
```

### 2. Get all unsynced records

```sql
SELECT * FROM taramalar
WHERE sync_status = 'pending'
ORDER BY created_at ASC
LIMIT 100;
```

### 3. Query by custom field (JSONB)

```sql
-- Find records where qty > 10
SELECT * FROM taramalar
WHERE (custom_fields->>'qty')::INTEGER > 10;

-- Find records with a specific note (case-insensitive)
SELECT * FROM taramalar
WHERE custom_fields->>'note' ILIKE '%kontrol%';

-- Find records that have a specific custom field
SELECT * FROM taramalar
WHERE custom_fields ? 'lotNo';
```

### 4. Aggregate queries

```sql
-- Count records by shift and date
SELECT shift_date, shift, COUNT(*) as record_count
FROM taramalar
GROUP BY shift_date, shift
ORDER BY shift_date DESC, shift;

-- Count records by customer
SELECT customer, COUNT(*) as record_count
FROM taramalar
WHERE customer IS NOT NULL AND customer != ''
GROUP BY customer
ORDER BY record_count DESC;
```

### 5. Duplicate detection

```sql
-- Find duplicate barcodes in same shift
SELECT barcode, shift, shift_date, COUNT(*) as count
FROM taramalar
GROUP BY barcode, shift, shift_date
HAVING COUNT(*) > 1;
```

### 6. User activity report

```sql
SELECT
  scanned_by,
  DATE(timestamp) as scan_date,
  COUNT(*) as scans_count,
  COUNT(DISTINCT barcode) as unique_barcodes
FROM taramalar
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY scanned_by, DATE(timestamp)
ORDER BY scan_date DESC, scans_count DESC;
```

## Performance Considerations

### 1. Partitioning Strategy (for large datasets)

If the dataset grows beyond millions of records, consider partitioning by date:

```sql
-- Create partitioned table
CREATE TABLE taramalar (
  -- same columns as before
) PARTITION BY RANGE (shift_date);

-- Create partitions
CREATE TABLE taramalar_2026_03 PARTITION OF taramalar
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE taramalar_2026_04 PARTITION OF taramalar
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- Automatic partition creation can be set up with pg_partman extension
```

### 2. Materialized Views for Reports

```sql
-- Daily summary view
CREATE MATERIALIZED VIEW daily_scan_summary AS
SELECT
  shift_date,
  shift,
  customer,
  COUNT(*) as total_scans,
  COUNT(DISTINCT barcode) as unique_barcodes,
  MIN(timestamp) as first_scan,
  MAX(timestamp) as last_scan
FROM taramalar
GROUP BY shift_date, shift, customer;

CREATE INDEX idx_daily_summary_date ON daily_scan_summary(shift_date DESC);

-- Refresh the view periodically (can be automated with cron or pg_cron)
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_scan_summary;
```

### 3. Vacuum and Analyze Strategy

```sql
-- Enable auto-vacuum (should be default)
ALTER TABLE taramalar SET (autovacuum_enabled = true);

-- Manual vacuum if needed
VACUUM ANALYZE taramalar;
```

## Backup and Recovery

### Regular Backups

```bash
# Full database backup
pg_dump -h localhost -U postgres -d scandesk -F c -f scandesk_backup_$(date +%Y%m%d).dump

# Table-specific backup
pg_dump -h localhost -U postgres -d scandesk -t taramalar -F c -f taramalar_backup_$(date +%Y%m%d).dump

# Restore
pg_restore -h localhost -U postgres -d scandesk scandesk_backup_20260310.dump
```

### Point-in-Time Recovery

Enable WAL archiving in postgresql.conf:

```
wal_level = replica
archive_mode = on
archive_command = 'cp %p /path/to/archive/%f'
```

## Security Recommendations

### 1. Row-Level Security (RLS)

```sql
-- Enable RLS on taramalar table
ALTER TABLE taramalar ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own shift's data
CREATE POLICY user_shift_policy ON taramalar
  FOR SELECT
  TO app_user
  USING (
    shift = current_setting('app.current_shift')::TEXT
    AND shift_date = current_setting('app.current_shift_date')::DATE
  );

-- Policy: Admins can see all data
CREATE POLICY admin_all_policy ON taramalar
  FOR ALL
  TO app_admin
  USING (true);
```

### 2. Database Roles

```sql
-- Create application roles
CREATE ROLE app_user LOGIN PASSWORD 'secure_password';
CREATE ROLE app_admin LOGIN PASSWORD 'secure_admin_password';

-- Grant appropriate permissions
GRANT CONNECT ON DATABASE scandesk TO app_user, app_admin;
GRANT USAGE ON SCHEMA public TO app_user, app_admin;

-- User permissions
GRANT SELECT, INSERT, UPDATE ON taramalar TO app_user;
GRANT SELECT ON users TO app_user;

-- Admin permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_admin;
```

## Migration from Current System

### Step 1: Export existing data

The application already stores data in localStorage/Preferences. Extract it:

```javascript
// In browser console or app code
const state = JSON.parse(localStorage.getItem('scandesk_state_v2'));
console.log(JSON.stringify(state.records));
```

### Step 2: Transform and import

```javascript
// Node.js script to import to PostgreSQL
const { Pool } = require('pg');
const { toDbPayload } = require('./src/services/recordModel');
const pool = new Pool({ connectionString: 'postgresql://...' });

const records = require('./exported_records.json');

for (const record of records) {
  const db = toDbPayload(record);
  await pool.query(`
    INSERT INTO taramalar (
      id, barcode, timestamp, shift, shift_date,
      customer, aciklama, scanned_by, scanned_by_username,
      sync_status, sync_error, source, source_record_id,
      updated_at, custom_fields
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
    )
    ON CONFLICT (id) DO NOTHING
  `, [
    db.id, db.barcode, db.timestamp, db.shift, db.shift_date,
    db.customer, db.aciklama, db.scanned_by, db.scanned_by_username,
    db.sync_status, db.sync_error, db.source, db.source_record_id,
    db.updated_at, JSON.stringify(db.custom_fields)
  ]);
}
```

## Monitoring Queries

### Table size monitoring

```sql
SELECT
  pg_size_pretty(pg_total_relation_size('taramalar')) as total_size,
  pg_size_pretty(pg_relation_size('taramalar')) as table_size,
  pg_size_pretty(pg_indexes_size('taramalar')) as indexes_size;
```

### Index usage statistics

```sql
SELECT
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND tablename = 'taramalar'
ORDER BY idx_scan DESC;
```

### Slow queries identification

```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slow queries
SELECT
  calls,
  mean_exec_time,
  max_exec_time,
  LEFT(query, 100) as query_preview
FROM pg_stat_statements
WHERE query LIKE '%taramalar%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Summary

This schema provides:

✅ **Performance**: Indexed fixed fields for fast queries
✅ **Flexibility**: JSONB for dynamic custom fields
✅ **Scalability**: Partitioning strategy for growth
✅ **Data Integrity**: Constraints and foreign keys
✅ **Auditability**: Created/updated timestamps
✅ **Backward Compatibility**: Supports existing data structure
✅ **Query Power**: Complex queries on both fixed and dynamic fields

The schema is production-ready and can be implemented immediately when backend infrastructure is available.
