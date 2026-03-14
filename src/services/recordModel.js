/**
 * Data Model Transformation Layer for ScanDesk
 *
 * This module provides utilities for transforming records between different formats:
 * - Application internal model (flat structure with customFields)
 * - PostgreSQL database model (fixed columns + jsonb)
 * - Export format (flat columnar structure for Excel/CSV)
 * - Legacy format (backward compatibility)
 */

// Fixed system fields that are always present in every record
export const FIXED_FIELDS = [
  'id',
  'barcode',
  'timestamp',
  'shift',
  'customer',
  'aciklama',
  'scanned_by',
  'scanned_by_username',
  'syncStatus',
  'syncError',
  'source',
  'sourceRecordId',
  'updatedAt'
];

// Fields that existed in legacy format but should be moved to customFields
const LEGACY_DYNAMIC_FIELDS = ['qty', 'note'];

// Field name mapping: Application (camelCase) → Database (snake_case)
// This mapping ensures PostgreSQL compatibility with standard naming conventions
//
// Complete mapping documentation:
// Application Model          →  PostgreSQL Column
// ----------------              ------------------
// id                        →  id
// barcode                   →  barcode
// timestamp                 →  timestamp
// shift                     →  shift
// customer                  →  customer
// aciklama                  →  aciklama
// scanned_by                →  scanned_by
// scanned_by_username       →  scanned_by_username
// syncStatus                →  sync_status
// syncError                 →  sync_error
// source                    →  source
// sourceRecordId            →  source_record_id
// updatedAt                 →  updated_at
// customFields              →  custom_fields (JSONB)
const FIELD_TO_DB_MAPPING = {
  'id': 'id',
  'barcode': 'barcode',
  'timestamp': 'timestamp',
  'shift': 'shift',
  'customer': 'customer',
  'aciklama': 'aciklama',
  'scanned_by': 'scanned_by',
  'scanned_by_username': 'scanned_by_username',
  'syncStatus': 'sync_status',
  'syncError': 'sync_error',
  'source': 'source',
  'sourceRecordId': 'source_record_id',
  'updatedAt': 'updated_at'
};

// Reverse mapping: Database (snake_case) → Application (camelCase)
const DB_TO_FIELD_MAPPING = Object.entries(FIELD_TO_DB_MAPPING).reduce((acc, [appField, dbField]) => {
  acc[dbField] = appField;
  return acc;
}, {});

/**
 * Normalize a record to the new structure (fixed fields + customFields)
 * This handles backward compatibility with old records that have dynamic fields at root level
 *
 * @param {Object} record - Raw record object (old or new format)
 * @param {Array} fields - Field definitions from app state
 * @returns {Object} Normalized record with customFields structure
 */
export function normalizeRecord(record, fields = []) {
  if (!record || typeof record !== 'object') return record;

  // Start with fixed fields
  const normalized = {};

  // Copy all fixed system fields
  FIXED_FIELDS.forEach(field => {
    if (record[field] !== undefined) {
      normalized[field] = record[field];
    }
  });

  // Set defaults for new fields if missing
  if (!normalized.syncStatus) normalized.syncStatus = 'pending';
  if (!normalized.syncError) normalized.syncError = '';
  if (!normalized.source) normalized.source = 'scan';
  if (!normalized.updatedAt && record.timestamp) normalized.updatedAt = record.timestamp;

  // Initialize customFields
  const customFields = {};

  // If record already has customFields, use it as base
  if (record.customFields && typeof record.customFields === 'object') {
    Object.assign(customFields, record.customFields);
  }

  // Identify dynamic fields from field definitions
  const dynamicFieldIds = fields
    .filter(f => !FIXED_FIELDS.includes(f.id))
    .map(f => f.id);

  // Move any dynamic fields from root level to customFields
  // This handles both legacy records and ensures consistency
  Object.keys(record).forEach(key => {
    // Skip if it's a fixed field or already handled
    if (FIXED_FIELDS.includes(key) || key === 'customFields') {
      return;
    }

    // If it's a known dynamic field (from field definitions) or legacy field
    if (dynamicFieldIds.includes(key) || LEGACY_DYNAMIC_FIELDS.includes(key)) {
      // Only add to customFields if not already there
      if (!(key in customFields)) {
        customFields[key] = record[key];
      }
    }
  });

  // Add customFields to normalized record
  normalized.customFields = customFields;

  return normalized;
}

/**
 * Convert normalized record to PostgreSQL payload
 * Converts camelCase field names to snake_case for database compatibility
 * Fixed fields go to columns, customFields goes to jsonb
 *
 * @param {Object} record - Normalized record with camelCase fields
 * @returns {Object} Database payload with snake_case fields
 */
export function toDbPayload(record) {
  if (!record || typeof record !== 'object') return record;

  const payload = {};

  // Convert field names from camelCase to snake_case
  FIXED_FIELDS.forEach(field => {
    if (record[field] !== undefined) {
      const dbField = FIELD_TO_DB_MAPPING[field] || field;
      payload[dbField] = record[field];
    }
  });

  // customFields → custom_fields (snake_case for DB)
  payload.custom_fields = record.customFields || {};

  return payload;
}

/**
 * Convert PostgreSQL record back to application model
 * Converts snake_case field names from database to camelCase for application
 *
 * @param {Object} dbRecord - Record from database with snake_case fields
 * @returns {Object} Application model record with camelCase fields
 */
export function fromDbPayload(dbRecord) {
  if (!dbRecord || typeof dbRecord !== 'object') return dbRecord;

  const record = {};

  // Convert field names from snake_case to camelCase
  Object.entries(dbRecord).forEach(([dbField, value]) => {
    if (dbField === 'custom_fields') {
      // custom_fields → customFields
      record.customFields = value || {};
    } else {
      // Use mapping if available, otherwise keep as-is
      const appField = DB_TO_FIELD_MAPPING[dbField] || dbField;
      record[appField] = value;
    }
  });

  return record;
}

/**
 * Get value of a dynamic field from a record
 * Handles both old flat structure and new customFields structure
 *
 * @param {Object} record - Record object
 * @param {string} fieldId - Field identifier
 * @returns {*} Field value
 */
export function getDynamicFieldValue(record, fieldId) {
  if (!record || typeof record !== 'object') return undefined;

  // Check customFields first
  if (record.customFields && fieldId in record.customFields) {
    return record.customFields[fieldId];
  }

  // Fallback to root level (for backward compatibility)
  if (fieldId in record && !FIXED_FIELDS.includes(fieldId)) {
    return record[fieldId];
  }

  return undefined;
}

/**
 * Set value of a dynamic field in a record
 *
 * @param {Object} record - Record object
 * @param {string} fieldId - Field identifier
 * @param {*} value - Value to set
 * @returns {Object} Updated record
 */
export function setDynamicFieldValue(record, fieldId, value) {
  if (!record || typeof record !== 'object') return record;

  const updated = { ...record };

  // Ensure customFields exists
  if (!updated.customFields) {
    updated.customFields = {};
  }

  // Set the value in customFields
  updated.customFields = {
    ...updated.customFields,
    [fieldId]: value
  };

  return updated;
}

/**
 * Migrate a batch of records to the new structure
 *
 * @param {Array} records - Array of records
 * @param {Array} fields - Field definitions
 * @returns {Array} Normalized records
 */
export function migrateRecords(records, fields = []) {
  if (!Array.isArray(records)) return [];
  return records.map(r => normalizeRecord(r, fields));
}

/**
 * Check if a record is already in the new format
 *
 * @param {Object} record - Record to check
 * @returns {boolean} True if record has customFields structure
 */
export function isNormalizedRecord(record) {
  if (!record || typeof record !== 'object') return false;
  return 'customFields' in record && typeof record.customFields === 'object';
}
