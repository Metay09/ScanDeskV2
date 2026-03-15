/**
 * ScanDesk — Sunucu Senkronizasyon Router'ı
 *
 * Mevcut Express sunucunuza bu router'ı ekleyin.
 * Bu router 4 endpoint sağlar:
 *   GET  /api/users        → kullanıcı listesi
 *   PUT  /api/users        → kullanıcı listesini güncelle (tam üzerine yaz)
 *   GET  /api/app-config   → alanlar, müşteriler, açıklamalar, ayarlar
 *   PUT  /api/app-config   → yukarıdakini güncelle (tam üzerine yaz)
 *
 * Kurulum:
 *   1. Bu dosyayı sunucunuza kopyalayın
 *   2. app.js / index.js içinde:
 *        const syncRoutes = require('./sync-routes');
 *        app.use(syncRoutes);
 *   3. PostgreSQL'de aşağıdaki tabloyu oluşturun (bkz. SQL bloğu aşağıda)
 *
 * SQL (bir kez çalıştırın):
 * ─────────────────────────────────────────────────────────────────
 * CREATE TABLE IF NOT EXISTS app_state (
 *   key        TEXT PRIMARY KEY,
 *   value      JSONB NOT NULL,
 *   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 * ─────────────────────────────────────────────────────────────────
 *
 * Ortam değişkenleri (mevcut sunucunuzdakilerle aynı olmalı):
 *   DATABASE_URL  — PostgreSQL bağlantı dizesi
 *   API_KEY       — x-api-key header değeri (ScanDesk ayarlarındaki ile aynı)
 */

const express = require("express");
const router  = express.Router();

// ── Bağlantı havuzu ──────────────────────────────────────────────────────────
// Mevcut sunucunuzda zaten bir `pool` (pg.Pool) varsa, bunu kaldırın ve
// o pool'u bu dosyaya import edin / inject edin.
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── API Key doğrulama ────────────────────────────────────────────────────────
function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key || key !== process.env.API_KEY) {
    return res.status(403).json({ error: "Geçersiz API key" });
  }
  next();
}

// ── Yardımcı: app_state tablosundan değer oku ────────────────────────────────
async function getState(key) {
  const r = await pool.query("SELECT value FROM app_state WHERE key = $1", [key]);
  return r.rows.length ? r.rows[0].value : null;
}

// ── Yardımcı: app_state tablosuna yaz (upsert) ──────────────────────────────
async function setState(key, value) {
  await pool.query(
    `INSERT INTO app_state (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

// ── GET /api/users ───────────────────────────────────────────────────────────
router.get("/api/users", requireApiKey, async (req, res) => {
  try {
    const users = await getState("users");
    res.json(users || []);
  } catch (err) {
    console.error("[sync-routes] GET /api/users:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/users ───────────────────────────────────────────────────────────
router.put("/api/users", requireApiKey, express.json(), async (req, res) => {
  try {
    const users = req.body;
    if (!Array.isArray(users)) return res.status(400).json({ error: "Array bekleniyor" });
    await setState("users", users);
    res.json({ ok: true });
  } catch (err) {
    console.error("[sync-routes] PUT /api/users:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/app-config ──────────────────────────────────────────────────────
router.get("/api/app-config", requireApiKey, async (req, res) => {
  try {
    const config = await getState("app_config");
    res.json(config || {});
  } catch (err) {
    console.error("[sync-routes] GET /api/app-config:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/app-config ──────────────────────────────────────────────────────
router.put("/api/app-config", requireApiKey, express.json(), async (req, res) => {
  try {
    const config = req.body;
    if (typeof config !== "object" || Array.isArray(config)) {
      return res.status(400).json({ error: "Nesne bekleniyor" });
    }
    await setState("app_config", config);
    res.json({ ok: true });
  } catch (err) {
    console.error("[sync-routes] PUT /api/app-config:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
