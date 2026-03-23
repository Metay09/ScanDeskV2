/**
 * Referans Tablo Servisi
 * İnfoera Excel'inden yüklenen palet verilerini saklar ve sorgular.
 *
 * Tarih mantığı:
 *   tarihLT → Lot No varsa lot'tan hesaplanan (LT = Lot Tarihi)
 *   tarih   → Excel'deki Tarih kolonundan gelen (her zaman)
 */

const STORAGE_KEY = "scandesk_ref_table";
const META_KEY    = "scandesk_ref_table_meta";
export const MAP_KEY = "scandesk_ref_col_map";

// ── Lot → Üretim Tarihi ──────────────────────────────────────────────────────
// Lot numarası format: pozisyon 6-7 yıl, 8-9 hafta numarası, 10-11 haftanın günü
// Örnek: SKB992601050511 → yıl:26→2026, hafta:01, gün:05 → 2 Ocak 2026 Cuma
export function lotToDate(lot) {
  try {
    const s = String(lot || "").trim();
    if (s.length < 11) return null;
    if (/[-]/.test(s)) return null; // tire varsa bu format değil

    const yil   = parseInt("20" + s.slice(5, 7), 10);
    const hafta = parseInt(s.slice(7, 9), 10);
    const gun   = parseInt(s.slice(9, 11), 10);

    if (isNaN(yil) || isNaN(hafta) || isNaN(gun)) return null;
    if (hafta < 1 || hafta > 53) return null;
    if (gun < 1 || gun > 7) return null;
    if (yil < 2010 || yil > 2040) return null;

    // ISO hafta: 4 Ocak her zaman 1. haftada
    const jan4 = new Date(yil, 0, 4);
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
    const tarih = new Date(monday);
    tarih.setDate(monday.getDate() + (hafta - 1) * 7 + (gun - 1));

    const pad = n => String(n).padStart(2, "0");
    return `${tarih.getFullYear()}-${pad(tarih.getMonth() + 1)}-${pad(tarih.getDate())}`;
  } catch { return null; }
}

// ── Tarih normalize → YYYY-MM-DD ─────────────────────────────────────────────
export function normalizeDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    const pad = n => String(n).padStart(2, "0");
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}`;
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [d, m, y] = s.split(".");
    return `${y}-${m}-${d}`;
  }
  return s;
}

// ── Kolon aday isimleri ──────────────────────────────────────────────────────
// Her alan için olası Excel kolon başlıkları (lowercase, kısmi eşleşme)
export const COL_CANDIDATES = {
  paletKodu: ["palet kodu", "palet_kodu", "paletcode", "barcode", "barkod"],
  stokAdi:   ["stok adı", "stok adi", "stokadi", "ürün adı", "urun adi", "stok", "ürün"],
  miktar:    ["miktar", "toplam kg", "toplam k", "toplam_kg", "kg", "net kg", "quantity"],
  koliAdet:  ["koli adet", "koliadet", "toplam kutu adedi", "kutu adedi", "koli", "adet", "kutu"],
  lotNo:     ["lot no", "lot_no", "lotno", "lot numarası", "lot"],
  tarih:     ["üretim tarihi", "uretim tarihi", "tarih", "production date", "date"],
  skt:       ["son kul. tarihi", "son kullanma tarihi", "skt", "son kullanım tarihi", "exp"],
  aciklama:  ["açıklama", "aciklama", "adreslenecek k", "adreslenecek", "notlar", "note"],
  musteri:   ["müşteri", "musteri", "customer", "firma", "şirket", "sirket", "alıcı", "alici"],
};

// Alan etiket isimleri (tablo başlıklarında gösterim için)
export const COL_LABELS = {
  paletKodu: "Palet Kodu",
  stokAdi:   "Stok Adı",
  miktar:    "Miktar",
  koliAdet:  "Koli Adet",
  lotNo:     "Lot No",
  tarihLT:   "Tarih (LT)",
  tarih:     "Tarih",
  skt:       "SKT",
  aciklama:  "Açıklama",
};

// Excel başlıklarından otomatik kolon eşleştirme tahmini
export function guessColMap(headers) {
  const map = {};
  const lowers = headers.map(h => String(h || "").toLowerCase().trim());
  for (const [field, candidates] of Object.entries(COL_CANDIDATES)) {
    for (const c of candidates) {
      const idx = lowers.findIndex(h => h.includes(c));
      if (idx !== -1) {
        map[field] = headers[idx];
        break;
      }
    }
  }
  return map;
}

// ── Tek satır → referans kayıt ───────────────────────────────────────────────
function rowToRecord(row, colMap) {
  const get = (f) => {
    const col = colMap[f];
    if (!col) return "";
    const v = row[col];
    return v !== undefined && v !== null ? v : "";
  };

  const paletKodu = String(get("paletKodu") || "").trim();
  if (!paletKodu) return null;

  const lotNo = String(get("lotNo") || "").trim();

  // Ekstra kolonlar (_extra_ önekiyle colMap'e kaydedilmiş özel alanlar)
  const _extras = {};
  for (const [k, v] of Object.entries(colMap)) {
    if (k.startsWith("_extra_") && v) {
      const label = k.slice(7);
      _extras[label] = String(row[v] ?? "").trim();
    }
  }

  return {
    paletKodu,
    stokAdi:  String(get("stokAdi")  || "").trim(),
    miktar:   get("miktar")   !== "" ? String(get("miktar"))   : "",
    koliAdet: get("koliAdet") !== "" ? String(get("koliAdet")) : "",
    lotNo,
    tarihLT:  lotNo ? (lotToDate(lotNo) || "") : "",
    tarih:    normalizeDate(get("tarih")),
    skt:      normalizeDate(get("skt")),
    aciklama: String(get("aciklama") || "").trim(),
    musteri:  String(get("musteri")  || "").trim(),
    ...(Object.keys(_extras).length ? { _extras } : {}),
  };
}

// ── Tablo oluştur ────────────────────────────────────────────────────────────
export function buildTableFromRows(rows, colMap) {
  if (!Array.isArray(rows) || !colMap) return { table: {}, stats: { total: 0, skipped: 0, merged: 0 } };
  const table = {};
  let skipped = 0;
  let merged  = 0;
  for (const row of rows) {
    const rec = rowToRecord(row, colMap);
    if (!rec || !rec.paletKodu) { skipped++; continue; }
    if (table[rec.paletKodu]) {
      // Aynı palet koduna birden fazla satır → miktar ve koli topla
      merged++;
      const ex = table[rec.paletKodu];
      table[rec.paletKodu] = {
        ...ex,
        miktar:   String(Math.round(((parseFloat(ex.miktar) || 0) + (parseFloat(rec.miktar) || 0)) * 100) / 100),
        koliAdet: String((parseInt(ex.koliAdet) || 0) + (parseInt(rec.koliAdet) || 0)),
      };
    } else {
      table[rec.paletKodu] = rec;
    }
  }
  return { table, stats: { total: rows.length, skipped, merged } };
}

// ── Kaydet ───────────────────────────────────────────────────────────────────
export function saveReferenceTable(table, colMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(table));
    localStorage.setItem(MAP_KEY, JSON.stringify(colMap));
    localStorage.setItem(META_KEY, JSON.stringify({
      count: Object.keys(table).length,
      updatedAt: new Date().toISOString(),
    }));
    return true;
  } catch (err) {
    if (err?.name === "QuotaExceededError" || err?.code === 22) {
      return "quota";
    }
    console.warn("[saveReferenceTable]", err);
    return false;
  }
}

// ── Yükle ────────────────────────────────────────────────────────────────────
export function loadReferenceTable() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    return r ? JSON.parse(r) : {};
  } catch { return {}; }
}

export function loadColMap() {
  try {
    const r = localStorage.getItem(MAP_KEY);
    return r ? JSON.parse(r) : null;
  } catch { return null; }
}

export function getReferenceTableMeta() {
  try {
    const r = localStorage.getItem(META_KEY);
    return r ? JSON.parse(r) : null;
  } catch { return null; }
}

export function clearReferenceTable() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(META_KEY);
    localStorage.removeItem(MAP_KEY);
    return true;
  } catch { return false; }
}

// ── Palet koduna göre ara ─────────────────────────────────────────────────────
export function lookupPalet(table, paletKodu) {
  if (!table || !paletKodu) return null;
  return table[String(paletKodu).trim()] || null;
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
