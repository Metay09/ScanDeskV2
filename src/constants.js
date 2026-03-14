export const INITIAL_USERS = [
  { id: "u0", username: "admin", password: "admin123", role: "admin", name: "Admin", active: true },
];

// Entegrasyon için varsayılan değerler — kullanıcı Ayarlar'dan değiştirir
export const DEFAULT_POSTGRES_URL = "https://scandesk-api.simsekhome.site";
export const DEFAULT_POSTGRES_KEY = "scandesk_live_7f9c2d1a8b4e6f0c9a2d5e7b1c3f8a6d";
export const DEFAULT_GSHEETS_URL  = "https://script.google.com/macros/s/AKfycbywRIk85STTKY9oF9H7fu186t1WqAr26qTc_vM2w7kXd_Iq4oYpn7yu3LmPaUOHOqQj/exec";

export const INITIAL_SETTINGS = {
  autoSave: true,
  addDetailAfterScan: false,
  vibration: true,
  beep: true,
  allowExport: true,
  allowImport: true,
  allowClearData: true,
  allowAddField: true,
  allowEditField: true,
  allowDeleteField: true,
  recentLimit: 10,
  scanDebounceMs: 800,
  enforceBarcodeLengthMatch: true,
};

export const INITIAL_FIELDS = [
  { id: "barcode", label: "Barkod", type: "Metin", required: true, locked: true },
];

export const FIELD_TYPES    = ["Metin", "Sayı", "Tarih", "Onay Kutusu"];
export const DEFAULT_CUSTS  = ["Müşteri A", "Müşteri B"];
export const genId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)));
