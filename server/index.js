/**
 * ScanDesk — Ana Express Sunucusu
 *
 * Görevler:
 *   1. React SPA'yı statik dosya olarak servis eder (dist/)
 *   2. Tüm API endpoint'lerini karşılar:
 *      - /api/taramalar  (CRUD — barkod kayıtları)
 *      - /api/users      (GET/PUT — kullanıcı listesi)
 *      - /api/app-config (GET/PUT — alanlar, müşteriler, açıklamalar, ayarlar)
 *
 * Ortam değişkenleri:
 *   DATABASE_URL  — PostgreSQL bağlantı dizesi (zorunlu)
 *   API_KEY       — x-api-key header değeri (zorunlu)
 *   PORT          — dinlenecek port (varsayılan: 3000)
 */

import express from "express";
import path    from "path";
import { fileURLToPath } from "url";
import pkg from "pg";

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());

function requireApiKey(req, res, next) {
  const key = process.env.API_KEY;
  if (key && req.headers["x-api-key"] !== key) {
    return res.status(403).json({ error: "Geçersiz API key" });
  }
  next();
}

// ── /api/taramalar ───────────────────────────────────────────────────────────

app.get("/api/taramalar", requireApiKey, async (req, res) => {
  try {
    const { shift, shift_date, limit = 1000 } = req.query;
    let query = "SELECT * FROM taramalar";
    const params = [];
    const conds = [];
    if (shift)      { params.push(shift);      conds.push(`shift = $${params.length}`); }
    if (shift_date) { params.push(shift_date); conds.push(`shift_date = $${params.length}`); }
    if (conds.length) query += " WHERE " + conds.join(" AND ");
    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(Number(limit));
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("[taramalar GET]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/taramalar", requireApiKey, async (req, res) => {
  try {
    const r = req.body;
    await pool.query(
      `INSERT INTO taramalar
         (id, barcode, timestamp, shift, shift_date, customer, aciklama,
          scanned_by, scanned_by_username, sync_status, sync_error,
          source, source_record_id, updated_at, custom_fields)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        r.id, r.barcode, r.timestamp || new Date(), r.shift,
        r.shift_date || null,
        r.customer || "", r.aciklama || "",
        r.scanned_by, r.scanned_by_username,
        r.sync_status || "synced", r.sync_error || "",
        r.source || "scan", r.source_record_id || "",
        r.updated_at || new Date(),
        JSON.stringify(r.custom_fields || {}),
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("[taramalar POST]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/taramalar/:id", requireApiKey, async (req, res) => {
  try {
    const r = req.body;
    await pool.query(
      `UPDATE taramalar SET
         barcode=$1, shift=$2, shift_date=$3, customer=$4, aciklama=$5,
         scanned_by=$6, scanned_by_username=$7,
         sync_status=$8, sync_error=$9, source=$10,
         source_record_id=$11, updated_at=$12,
         custom_fields=$13::jsonb
       WHERE id=$14`,
      [
        r.barcode, r.shift, r.shift_date || null,
        r.customer || "", r.aciklama || "",
        r.scanned_by, r.scanned_by_username,
        r.sync_status || "synced", r.sync_error || "",
        r.source || "scan", r.source_record_id || "",
        r.updated_at || new Date(),
        JSON.stringify(r.custom_fields || {}),
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[taramalar PATCH]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/taramalar/:id", requireApiKey, async (req, res) => {
  try {
    await pool.query("DELETE FROM taramalar WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("[taramalar DELETE]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── app_state yardımcıları ───────────────────────────────────────────────────

async function getState(key) {
  const r = await pool.query("SELECT value FROM app_state WHERE key=$1", [key]);
  return r.rows.length ? r.rows[0].value : null;
}

async function setState(key, value) {
  await pool.query(
    `INSERT INTO app_state (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value=$2::jsonb, updated_at=NOW()`,
    [key, JSON.stringify(value)]
  );
}

// ── /api/users ───────────────────────────────────────────────────────────────

app.get("/api/users", requireApiKey, async (req, res) => {
  try {
    res.json((await getState("users")) || []);
  } catch (err) {
    console.error("[users GET]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/users", requireApiKey, async (req, res) => {
  try {
    if (!Array.isArray(req.body)) return res.status(400).json({ error: "Array bekleniyor" });
    await setState("users", req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error("[users PUT]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── /api/app-config ──────────────────────────────────────────────────────────

app.get("/api/app-config", requireApiKey, async (req, res) => {
  try {
    res.json((await getState("app_config")) || {});
  } catch (err) {
    console.error("[app-config GET]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/app-config", requireApiKey, async (req, res) => {
  try {
    if (typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Nesne bekleniyor" });
    }
    await setState("app_config", req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error("[app-config PUT]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── React SPA — statik dosyalar ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

// ── Başlat ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ScanDesk sunucu çalışıyor → http://localhost:${PORT}`);
});
