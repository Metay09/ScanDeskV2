// Varsayılan kişisel kullanıcı ayarları
export const DEFAULT_USER_SETTINGS = {
  vibration: true,
  beep: true,
  autoSave: true,
  enforceBarcodeLengthMatch: true,
  recentLimit: 10,
  theme: "dark",
};

export const INITIAL_USERS = [
  {
    id: "u0",
    username: "admin",
    password: "admin123",
    role: "admin",
    name: "Admin",
    active: true,
    custList: [],
    aciklamaList: [],
    userSettings: { ...DEFAULT_USER_SETTINGS },
  },
];

// Entegrasyon varsayılan değerleri — ortam değişkenlerinden okunur.
// VITE_* değerleri build sırasında inject edilmelidir (.env veya Docker build-arg).
export const DEFAULT_POSTGRES_URL    = import.meta.env.VITE_SERVER_URL  || "";
export const DEFAULT_POSTGRES_KEY    = import.meta.env.VITE_API_KEY     || "";
export const DEFAULT_GSHEETS_URL     = import.meta.env.VITE_GSHEETS_URL || "";
export const DEFAULT_GSHEETS_ACTIVE  = true;
export const DEFAULT_POSTGRES_ACTIVE = true;

// ── Zamanlama sabitleri ─────────────────────────────────────────────────────
export const GRACE_PERIOD_SECS       = 300;       // Vardiya bitimi grace period (5 dakika)
export const TOAST_DURATION_MS       = 2800;      // Bildirim görüntüleme süresi
export const SYNC_QUEUE_DELAY_MS     = 600;       // Kuyruk boşsa bekleme süresi
export const SSE_POLLING_INTERVAL_MS = 30_000;    // Sunucu polling aralığı (30s)
export const SSE_RECONNECT_DELAY_MS  = 3_000;     // SSE yeniden bağlanma gecikmesi (3s)
export const SHIFT_CHECK_INTERVAL_MS = 15_000;    // Vardiya değişimi kontrol aralığı (15s)
export const USER_SHIFT_CHECK_MS     = 60_000;    // Kullanıcı vardiya güncelleme aralığı (1dk)
export const FLASH_RESET_DELAY_MS    = 700;       // Tarama flash sıfırlama gecikmesi
export const AUTO_SAVE_DEBOUNCE_MS   = 550;       // Otomatik kaydetme debounce süresi

// Admin (global) ayarlar — sadece admin değiştirebilir, tüm cihazlara uygulanır
export const INITIAL_SETTINGS = {
  allowExport: true,
  allowImport: true,
  allowClearData: true,
  allowAddField: true,
  allowEditField: true,
  allowDeleteField: true,
  scanDebounceMs: 800,
  enforceBarcodeLengthMatch: true,
};

export const INITIAL_FIELDS = [
  { id: "barcode", label: "Barkod", type: "Metin", required: true, locked: true },
];

export const FIELD_TYPES    = ["Metin", "Sayı", "Tarih", "Onay Kutusu"];
export const DEFAULT_CUSTS  = ["Müşteri A", "Müşteri B"];
export const DEFAULT_ACIKLAMAS = [];
export const genId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)));
