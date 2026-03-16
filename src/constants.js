// Varsayılan kişisel kullanıcı ayarları
export const DEFAULT_USER_SETTINGS = {
  vibration: true,
  beep: true,
  autoSave: true,
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

// Entegrasyon için varsayılan değerler.
// VITE_SERVER_URL / VITE_API_KEY build sırasında .env'den gömülür;
// tanımlıysa uygulama ilk açılışta PostgreSQL entegrasyonunu otomatik aktif eder.
export const DEFAULT_POSTGRES_URL = import.meta.env.VITE_SERVER_URL || "";
export const DEFAULT_POSTGRES_KEY = import.meta.env.VITE_API_KEY || "";
export const DEFAULT_GSHEETS_URL  = "";
// Her iki değer de tanımlıysa entegrasyonu başlangıçta aktif aç
export const DEFAULT_POSTGRES_ACTIVE =
  !!(import.meta.env.VITE_SERVER_URL && import.meta.env.VITE_API_KEY);

// Admin (global) ayarlar — sadece admin değiştirebilir, tüm cihazlara uygulanır
export const INITIAL_SETTINGS = {
  addDetailAfterScan: false,
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
