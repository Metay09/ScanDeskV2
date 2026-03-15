// ─── Yardımcı ────────────────────────────────────────────────────────────────
const base = (cfg) => cfg.serverUrl.replace(/\/$/, "");
const authHeaders = (cfg) => ({ "x-api-key": cfg.apiKey, "Content-Type": "application/json" });

// ─── Sunucu-Senkronizasyon: Kullanıcılar ────────────────────────────────────

/** Sunucudaki kullanıcı listesini çeker. */
export async function fetchServerUsers(cfg) {
  const r = await fetch(`${base(cfg)}/api/users`, {
    headers: { "x-api-key": cfg.apiKey },
  });
  if (!r.ok) throw new Error(`fetchServerUsers ${r.status}`);
  return r.json();
}

/** Kullanıcı listesini sunucuya yazar (tam üzerine yazar). */
export async function pushServerUsers(cfg, users) {
  const r = await fetch(`${base(cfg)}/api/users`, {
    method: "PUT",
    headers: authHeaders(cfg),
    body: JSON.stringify(users),
  });
  if (!r.ok) throw new Error(`pushServerUsers ${r.status}`);
}

// ─── Sunucu-Senkronizasyon: Uygulama Yapılandırması ─────────────────────────

/**
 * Uygulama yapılandırmasını (alanlar, müşteri listesi, açıklama listesi, ayarlar)
 * sunucudan çeker. Dönen nesne: { fields, custList, aciklamaList, settings }
 */
export async function fetchServerConfig(cfg) {
  const r = await fetch(`${base(cfg)}/api/app-config`, {
    headers: { "x-api-key": cfg.apiKey },
  });
  if (!r.ok) throw new Error(`fetchServerConfig ${r.status}`);
  return r.json();
}

/** Uygulama yapılandırmasını sunucuya yazar (tam üzerine yazar). */
export async function pushServerConfig(cfg, data) {
  const r = await fetch(`${base(cfg)}/api/app-config`, {
    method: "PUT",
    headers: authHeaders(cfg),
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(`pushServerConfig ${r.status}`);
}

/** Sunucudaki tüm barkod kayıtlarını çeker. */
export async function fetchServerRecords(cfg, limit = 5000) {
  const r = await fetch(`${base(cfg)}/api/taramalar?limit=${limit}`, {
    headers: { "x-api-key": cfg.apiKey },
  });
  if (!r.ok) throw new Error(`fetchServerRecords ${r.status}`);
  return r.json();
}

// ─── PostgreSQL Kayıt CRUD ───────────────────────────────────────────────────

export async function postgresApiInsert(cfg, row) {
  const r = await fetch(`${cfg.serverUrl.replace(/\/$/, "")}/api/taramalar`, {
    method: "POST",
    headers: { "x-api-key": cfg.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`PostgreSQL API ${r.status}: ${await r.text()}`);
}

export async function postgresApiUpdate(cfg, id, row) {
  const r = await fetch(`${cfg.serverUrl.replace(/\/$/, "")}/api/taramalar/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "x-api-key": cfg.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`PostgreSQL API ${r.status}: ${await r.text()}`);
}

export async function postgresApiDelete(cfg, id) {
  const r = await fetch(`${cfg.serverUrl.replace(/\/$/, "")}/api/taramalar/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "x-api-key": cfg.apiKey },
  });
  if (!r.ok) throw new Error(`PostgreSQL API ${r.status}: ${await r.text()}`);
}

// Note: Google Apps Script requires mode:"no-cors" which returns an opaque response.
// The promise resolves when the request is sent; server-side errors cannot be detected from the client.
//
// Google Sheets Integration Logic:
// - Apps Script now supports id-based upsert: if id exists, updates row; if not, inserts new row
// - headers: ["Barkod", ...fields, "Müşteri", ...] (id not included in headers, but added by Apps Script)
// - row[0] = id (first element is always the record id)
// - Apps Script manages header: ["id", ...headers] internally

export async function sheetsInsert(cfg, headers, row) {
  await fetch(cfg.scriptUrl, {
    method: "POST", mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ headers, row }),
  });
}

// Update existing record in Google Sheets (same as insert - Apps Script handles upsert by id)
// row[0] must be the record id; if id exists in sheet, row will be updated
export async function sheetsUpdate(cfg, headers, row) {
  await fetch(cfg.scriptUrl, {
    method: "POST", mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ headers, row }),
  });
}

// Delete a single record from Google Sheets by id
export async function sheetsDelete(cfg, id) {
  await fetch(cfg.scriptUrl, {
    method: "POST", mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  });
}

// Delete multiple records from Google Sheets.
// Apps Script delete handler expects a single `id`, not an `ids` array.
// So we send one delete request per record to keep the client compatible
// with the current script deployment.
export async function sheetsDeleteBulk(cfg, ids) {
  const safeIds = Array.isArray(ids) ? ids : [ids];
  for (const id of safeIds) {
    if (!id) continue;
    await sheetsDelete(cfg, id);
  }
}

// Helper function to sync a single record to Google Sheets
// Builds the standard payload format and sends to Apps Script
// Used for create, update, and bulk sync operations
// Now includes full record structure for better data preservation
export async function syncRecordToSheets(cfg, record, fields) {
  const ef = fields.filter(f => f.id !== "barcode");
  const headers = [
    "Barkod",
    "Müşteri",
    "Açıklama",
    "Kaydeden",
    "Kullanıcı Adı",
    "Tarih",
    "Saat",
    "Vardiya",
    "Kaynak",
    "Kaynak Kayıt ID",
    "Güncellenme",
    ...ef.map(f => f.label)
  ];

  const timestamp = new Date(record.timestamp);
  const rowArr = [
    record.id,                                          // ID for upsert (not in headers, added by Apps Script)
    record.barcode,
    record.customer || "",
    record.aciklama || "",
    record.scanned_by,
    record.scanned_by_username,
    timestamp.toLocaleDateString("tr-TR"),
    timestamp.toLocaleTimeString("tr-TR"),
    record.shift || "",
    record.source || "",
    record.sourceRecordId || "",
    record.updatedAt || "",
    ...ef.map(f => record.customFields?.[f.id] ?? "")
  ];

  // Use sheetsUpdate for upsert behavior (Apps Script handles both create and update)
  await sheetsUpdate(cfg, headers, rowArr);
}
