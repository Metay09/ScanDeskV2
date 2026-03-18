const TABLE_KEY  = "scandesk_ref_table";
const COLMAP_KEY = "scandesk_ref_col_map";

export function loadReferenceTable() {
  try { return JSON.parse(localStorage.getItem(TABLE_KEY) || "{}"); }
  catch { return {}; }
}

export function loadColMap() {
  try {
    const raw = localStorage.getItem(COLMAP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveReferenceTable(table, colMap) {
  try {
    localStorage.setItem(TABLE_KEY,  JSON.stringify(table  || {}));
    localStorage.setItem(COLMAP_KEY, JSON.stringify(colMap || null));
  } catch { /* sessiz */ }
}

export function clearReferenceTable() {
  localStorage.removeItem(TABLE_KEY);
  localStorage.removeItem(COLMAP_KEY);
}

// ── Sunucu Entegrasyonu ───────────────────────────────────────────────────────

/** Referans tabloyu sunucudan çeker. */
export async function fetchServerRefTable(cfg) {
  const r = await fetch(`${cfg.serverUrl.replace(/\/$/, "")}/api/ref-table`, {
    headers: { "x-api-key": cfg.apiKey },
  });
  if (!r.ok) throw new Error(`fetchServerRefTable ${r.status}`);
  return r.json(); // { table, colMap }
}

/** Referans tabloyu sunucuya yazar. */
export async function pushServerRefTable(cfg, table, colMap) {
  const r = await fetch(`${cfg.serverUrl.replace(/\/$/, "")}/api/ref-table`, {
    method: "PUT",
    headers: { "x-api-key": cfg.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ table, colMap }),
  });
  if (!r.ok) throw new Error(`pushServerRefTable ${r.status}`);
}
