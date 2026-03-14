export const INITIAL_USERS = [
  { id: "u0", username: "admin", password: "admin123", role: "admin", name: "Admin", active: true },
];

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
